const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: '4GQrqqS38iHMD7f.root',
      password: 'CqLDmzimj6asMiOj',
      database: 'test',
      ssl: { rejectUnauthorized: true },
      connectTimeout: 10000
    });
    
    console.log('✅ Connected successfully!');
    const [rows] = await connection.execute('SELECT 1');
    console.log('✅ Query executed:', rows);
    await connection.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
