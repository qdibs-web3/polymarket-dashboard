const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4GQrqqS38iHMD7f.root',
    password: 'CqLDmzimj6asMiOj',
    database: 'test',
    ssl: { rejectUnauthorized: true },
    multipleStatements: true
  });

  console.log('Connected to database...');
  
  const sql = fs.readFileSync('migrations/wallet_auth_migration.sql', 'utf8');
  
  console.log('Running migration...');
  await connection.query(sql);
  
  console.log('✅ Migration complete!');
  await connection.end();
}

runMigration().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
