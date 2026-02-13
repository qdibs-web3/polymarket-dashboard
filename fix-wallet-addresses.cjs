const mysql = require('mysql2/promise');

async function fixWalletAddresses() {
  const connection = await mysql.createConnection({
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '4GQrqqS38iHMD7f.root',
    password: 'CqLDmzimj6asMiOj',
    database: 'test',
    ssl: { rejectUnauthorized: true }
  });

  console.log('Connected to database...');
  
  // Get users without wallet addresses
  const [users] = await connection.query(
    'SELECT id, email FROM users WHERE wallet_address IS NULL OR wallet_address = ""'
  );
  
  console.log(`Found ${users.length} users without wallet addresses`);
  
  // Option 1: Delete users without wallets (if they're test data)
  if (users.length > 0) {
    console.log('Deleting users without wallet addresses...');
    await connection.query('DELETE FROM users WHERE wallet_address IS NULL OR wallet_address = ""');
    console.log('✅ Deleted users without wallet addresses');
  }
  
  await connection.end();
}

fixWalletAddresses().catch(console.error);
