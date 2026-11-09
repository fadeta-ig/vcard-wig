import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileMessages } from '../../src/i18n/profile-messages';

const mocks = vi.hoisted(() => ({request:vi.fn(),refresh:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation', () => ({useRouter:() => ({push:mocks.push,refresh:mocks.refresh})}));
vi.mock('next/image', () => ({default:({unoptimized,priority,...props}) => {
  void unoptimized; void priority;
  return React.createElement('img',props);
}}));
vi.mock('next/link', () => ({default:({children,...props}) => React.createElement('a',props,children)}));
vi.mock('../../src/lib/api-client', () => ({
  apiRequest:mocks.request,
  ApiClientError:class ApiClientError extends Error {},
}));
import { ProfileEditor } from '../../src/components/admin/profile-editor';

const companyA = {id:'company-a',name:'Company A',companyLogo:null,primaryColor:'#1E3A5F',secondaryColor:null,qrLogoEnabled:false,defaultQrForeground:'#111827',defaultQrBackground:'#FFFFFF'};
const companyB = {...companyA,id:'company-b',name:'Company B'};
const now = '2026-11-09T00:00:00.000Z';
const profile = {
  id:'profile-a',companyId:companyA.id,company:companyA,slug:'profile-a',firstName:'Audit',lastName:null,
  displayName:'Audit Profile',honorificPrefix:null,honorificSuffix:null,jobTitle:'Saved title',department:null,
  companyName:'Company A',email:'audit@example.invalid',workPhone:null,mobilePhone:null,whatsappNumber:null,
  website:null,addressLine1:null,addressLine2:null,city:null,province:null,postalCode:null,country:'Indonesia',
  shortBio:null,profilePhoto:null,profileThumbnail:null,status:'DRAFT',showPhoto:true,showEmail:true,
  showPhone:true,showAddress:true,showSocialLinks:true,sectionOrder:['CONTACT','SOCIAL','ADDRESS','BIO'],
  socialLinks:[],publishedAt:null,createdAt:now,updatedAt:now,createdBy:{id:'audit-user',name:'Audit',username:'audit'},
};
afterEach(() => {cleanup();vi.clearAllMocks();});

describe('Controlled editor audit probes; mocked network and no database', () => {
  it('retains company A draft values when refreshed with company B props', () => {
    const result = render(<ProfileEditor locale="id" company={companyA} initialProfile={null}/>);
    fireEvent.change(result.container.querySelector('#profile-first-name'),{target:{value:'Person from A'}});
    result.rerender(<ProfileEditor locale="id" company={companyB} initialProfile={null}/>);
    expect(result.container.querySelector('#profile-first-name').value).toBe('Person from A');
    expect(result.container.querySelector('#profile-company-name').value).toBe('Company A');
    expect(result.container.querySelector('.profile-form-heading p').textContent).toBe('Company B');
  });

  it('publishes the saved profile without submitting unsaved form changes', async () => {
    mocks.request.mockResolvedValue({...profile,status:'ACTIVE'});
    const result = render(<ProfileEditor locale="id" company={companyA} initialProfile={profile}/>);
    fireEvent.change(result.container.querySelector('#profile-job-title'),{target:{value:'Unsaved new title'}});
    fireEvent.click(result.getByRole('button',{name:profileMessages('id').publish}));
    expect(mocks.request).toHaveBeenCalledWith('/api/admin/profiles/profile-a/status',{method:'POST',body:{status:'ACTIVE'}});
    expect(mocks.request).toHaveBeenCalledTimes(1);
    await result.findByText(profileMessages('id').statusChanged);
  });
});
