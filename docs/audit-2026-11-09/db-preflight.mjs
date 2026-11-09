import mariadb from 'mariadb';

// Read-only preflight. The production/development application database is never selected.
const database = 'vcard_wig_test';
if (process.env.DATABASE_HOST !== '127.0.0.1') throw new Error('Loopback database required');
const connection = await mariadb.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database,
});
try {
  const [selected] = await connection.query('SELECT DATABASE() AS name');
  if (selected.name !== database) throw new Error('Unexpected database');
  const tables = await connection.query('SHOW TABLES');
  const [counts] = await connection.query('SELECT (SELECT COUNT(*) FROM User) AS users, (SELECT COUNT(*) FROM ContactProfile) AS profiles');
  console.log(JSON.stringify({database: selected.name, tableCount: tables.length, counts}, (_, value) => typeof value === 'bigint' ? String(value) : value));
} finally {
  await connection.end();
}
