const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Import routes
const authRoutes = require('./routes/auth');
const tradeRoutes = require('./routes/trades');
const accountRoutes = require('./routes/accounts');
const settingsRoutes = require('./routes/settings');
const columnRoutes = require('./routes/columns');
const commandRoutes = require('./routes/commands');
const eaRoutes = require('./routes/ea');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/journal/trades', tradeRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/ea', eaRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Trading Journal Backend',
        version: '1.0.0'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Trading Journal API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            trades: '/api/journal/trades',
            accounts: '/api/accounts',
            settings: '/api/settings',
            columns: '/api/columns',
            commands: '/api/commands',
            ea: '/api/ea',
        },
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Error:`, err);

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        timestamp,
    });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log('🚀  Trading Journal Backend Started');
    console.log('🚀 ========================================');
    console.log(`🌐  Server: http://localhost:${PORT}`);
    console.log(`🔧  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊  Database: ${process.env.DB_NAME}`);
    console.log(`🔐  CORS Origin: ${process.env.CORS_ORIGIN}`);
    console.log('🚀 ========================================');
    console.log('');
});

module.exports = app;
