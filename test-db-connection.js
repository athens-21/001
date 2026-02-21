const { Pool } = require('./backend/node_modules/pg');

async function testDatabaseConnection() {
  console.log('🔍 Testing PostgreSQL Connection...\n');
  
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'trading_journal',
    user: 'postgres',
    password: 'pass12345678',
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test connection
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL!\n');
    
    // Check database version
    const versionResult = await client.query('SELECT version()');
    console.log('📌 PostgreSQL Version:');
    console.log(versionResult.rows[0].version.substring(0, 100) + '...\n');
    
    // Check current database
    const dbResult = await client.query('SELECT current_database()');
    console.log('📊 Current Database:', dbResult.rows[0].current_database);
    
    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:');
    if (tablesResult.rows.length === 0) {
      console.log('   ⚠️  No tables found (database might not be initialized)');
    } else {
      tablesResult.rows.forEach(row => {
        console.log('   ✓', row.table_name);
      });
    }
    
    // Count records in each table
    if (tablesResult.rows.length > 0) {
      console.log('\n📈 Record counts:');
      for (const row of tablesResult.rows) {
        try {
          const countResult = await client.query(`SELECT COUNT(*) FROM ${row.table_name}`);
          console.log(`   ${row.table_name}: ${countResult.rows[0].count} records`);
        } catch (err) {
          console.log(`   ${row.table_name}: Error reading count`);
        }
      }
    }
    
    client.release();
    await pool.end();
    console.log('\n✅ Database connection test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Suggestions:');
      console.log('   1. PostgreSQL service might not be running');
      console.log('   2. Check if PostgreSQL is installed');
      console.log('   3. Verify connection settings (host, port, credentials)');
    } else if (error.code === '3D000') {
      console.log('\n💡 The database "trading_journal" does not exist!');
      console.log('   Run the schema.sql file to create it.');
    } else if (error.code === '28P01') {
      console.log('\n💡 Authentication failed - check username/password');
    }
    
    process.exit(1);
  }
}

testDatabaseConnection();
