const { Client } = require('./backend/node_modules/pg');

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'trading_journal',
    user: 'postgres',
    password: 'postgres'
});

async function clearTrades() {
    try {
        await client.connect();
        console.log('🔄 Connecting to database...');
        
        const result = await client.query("DELETE FROM trades WHERE source = 'MT5'");
        console.log(`✅ Deleted ${result.rowCount} MT5 trades`);
        
        await client.end();
        console.log('✅ Done! Now remove and re-attach EA in MT5 to sync fresh data.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

clearTrades();
