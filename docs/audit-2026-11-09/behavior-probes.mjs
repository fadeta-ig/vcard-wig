import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Controlled service probes: all Prisma operations are replaced with in-memory doubles.
// No application or test database is queried or modified by this script.
Object.assign(process.env, {
  DATABASE_HOST: '127.0.0.1', DATABASE_PORT: '3307', DATABASE_USER: 'audit-not-used',
  DATABASE_PASSWORD: '', DATABASE_NAME: 'audit_not_connected',
  APP_URL: 'http://localhost:3000', NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  UPLOAD_DIR: path.resolve('docs/audit-2026-11-09/fixtures/uploads'),
});
const { prisma } = await import('../../src/lib/prisma.ts');
const { analyticsCsv, ANALYTICS_EVENT_TYPES } = await import('../../src/services/analytics.service.ts');
const { updateProfile, changeProfileStatus } = await import('../../src/services/profile.service.ts');
const { recordClientEvent } = await import('../../src/services/analytics-event.service.ts');
const { GET: uploadGet } = await import('../../src/app/uploads/[...path]/route.ts');
const { readableBrandForeground, colorContrastRatio } = await import('../../src/lib/public-profile.ts');

const findings = [];
const counts = Object.fromEntries(ANALYTICS_EVENT_TYPES.map(key => [key, 0]));
const csv = analyticsCsv([{displayName: '=1+1', companyName: 'Audit Company', slug: 'audit-profile', counts, total: 0}]);
assert.equal(csv.split('\r\n')[1].startsWith('=1+1,'), true);
findings.push({id:'CSV_FORMULA', reproduced:true, evidence:'User-controlled displayName =1+1 remains an unescaped formula prefix in exported CSV.'});

const now = new Date();
let row = {
  id:'audit-profile', companyId:'audit-company', slug:'printed-original', firstName:'Audit', lastName:null,
  displayName:'Audit Profile', honorificPrefix:null, honorificSuffix:null, jobTitle:'Old title', department:null,
  companyName:'Audit Company', email:'audit@example.invalid', workPhone:null, mobilePhone:null, whatsappNumber:null,
  website:null, addressLine1:null, addressLine2:null, city:null, province:null, postalCode:null, country:null,
  shortBio:null, profilePhoto:null, profileThumbnail:null, status:'ACTIVE', publishedAt:now,
  showPhoto:true, showEmail:true, showPhone:true, showAddress:true, showSocialLinks:true,
  sectionOrder:['CONTACT','SOCIAL','ADDRESS','BIO'], socialLinks:[], viewCount:0, vcardDownloadCount:0,
  createdAt:now, updatedAt:now, company:{id:'audit-company', name:'Audit Company'}, createdBy:{id:'audit-user'},
};
const session = {id:'audit-session', user:{id:'audit-user', role:'SUPER_ADMIN'}};
const auditRows = [];
prisma.company.count = async () => 1;
prisma.contactProfile.findUnique = async () => structuredClone(row);
prisma.contactProfile.count = async () => 0;
prisma.contactProfile.update = async ({data}) => {
  Object.assign(row, data, {updatedAt:new Date()});
  return structuredClone(row);
};
prisma.auditLog.create = async ({data}) => {auditRows.push(data); return data;};
prisma.$transaction = async operation => typeof operation === 'function' ? operation(prisma) : Promise.all(operation);
await changeProfileStatus(session, row.id, 'ARCHIVED');
await changeProfileStatus(session, row.id, 'DRAFT');
assert.equal(row.publishedAt, null);
await updateProfile(session, row.id, {slug:'renamed-after-restore'});
assert.equal(row.slug, 'renamed-after-restore');
findings.push({id:'SLUG_AFTER_RESTORE', reproduced:true, evidence:'ACTIVE -> ARCHIVED -> DRAFT clears publishedAt; updateProfile then accepts a different slug. Old printed URL is no longer reserved by this profile.'});

row.jobTitle = 'Original'; row.department = 'Original department';
const editorB = {jobTitle:row.jobTitle, department:row.department};
await updateProfile(session, row.id, {jobTitle:'Saved by editor A', department:'Original department'});
await updateProfile(session, row.id, {...editorB, department:'Saved by editor B'});
assert.equal(row.jobTitle, 'Original');
findings.push({id:'STALE_EDITOR_OVERWRITE', reproduced:true, evidence:'A stale full-form payload overwrites editor A jobTitle without a version conflict. Service calls use an in-memory database double.'});

let storedEvents = [];
prisma.contactProfile.findFirst = async () => ({id:row.id, showEmail:true, showPhone:true, showSocialLinks:true, email:row.email, mobilePhone:null, workPhone:null, whatsappNumber:null, socialLinks:[]});
prisma.activityEvent.findFirst = async () => { await new Promise(resolve => setTimeout(resolve, 15)); return null; };
prisma.activityEvent.create = async ({data}) => {storedEvents.push(data); return data;};
const metadata = {visitorTokenHash:'a'.repeat(64), userAgent:null, referrer:null};
await Promise.all([recordClientEvent('audit-profile',{eventType:'PROFILE_VIEW'},metadata), recordClientEvent('audit-profile',{eventType:'PROFILE_VIEW'},metadata)]);
assert.equal(storedEvents.length, 2);
findings.push({id:'EVENT_DEDUPE_RACE', reproduced:true, evidence:'Two concurrent calls whose pre-insert duplicate reads both miss are both accepted; controlled interleaving with in-memory Prisma doubles, not a database load test.'});

const imageDirectory = path.resolve(process.env.UPLOAD_DIR,'profiles','audit-company','audit-profile');
const imagePath = path.join(imageDirectory,'photo-audit.webp');
await mkdir(imageDirectory, {recursive:true});
await writeFile(imagePath, await sharp({create:{width:1,height:1,channels:3,background:'#667085'}}).webp().toBuffer(), {flag:'wx'});
let databaseReads = 0;
prisma.contactProfile.findUnique = async () => { databaseReads += 1; throw new Error('Photo route unexpectedly queried a profile'); };
try {
  const response = await uploadGet(new Request('http://localhost:3000/uploads/profiles/audit-company/audit-profile/photo-audit.webp'), {params:Promise.resolve({path:['profiles','audit-company','audit-profile','photo-audit.webp']})});
  assert.equal(response.status,200); assert.equal(databaseReads,0);
  findings.push({id:'PUBLIC_ASSET_NO_PROFILE_CHECK',reproduced:true,status:response.status,databaseReads,cacheControl:response.headers.get('Cache-Control'),evidence:'Synthetic image served anonymously without checking profile/company status or showPhoto.'});
} finally {
  await unlink(imagePath);
}

findings.push({id:'BRAND_TEXT_CONTRAST',reproduced:true,exampleColor:'#FFFFFF',publicButtonForeground:readableBrandForeground('#FFFFFF'),adminButtonForeground:'#FFFFFF',adminContrast:colorContrastRatio('#FFFFFF','#FFFFFF'),evidence:'Company primaryColor permits white. Admin primary buttons hard-code white text; public buttons choose a contrasting foreground, but public company-name text also uses brand color on a white surface.'});

const result = {date:'2026-11-09',method:'Isolated source/service probes with in-memory Prisma doubles; synthetic local asset; no live DB or browser verification.',findings};
await writeFile('docs/audit-2026-11-09/behavior-probes.json', JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
await prisma.$disconnect();
