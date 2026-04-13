require('dotenv').config();
const express = require('express');
const connectDb = require('./config/db');
const apiRoutes = require('./routes'); // loads src/routes/index.js

const app = express();

// Connect to the database
connectDb();

app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

// Middleware to parse JSON requests
// app.use(express.json());
app.use((req, res, next) => {
    if (req.originalUrl === '/api/payments/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});
//health endpoin
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
})

// mount API routes
app.use('/api', apiRoutes);

//basic 404 for everything else
app.use((req, res) => res.status(404).json({ error: 'Not Found' }))

// centralized error handler
app.use((err, req, res, next) => {
    // log full error for server-side debugging
    console.error(err && err.stack ? err.stack : err);

    // if error already has a status, use it
    const status = err.status || 500;

    // never leak stack/details in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(status).json({ error: err.message || 'Server error' });
    }

    // in development include useful error details
    return res.status(status).json({
        error: err.message || 'Server error',
        details: err && err.stack ? err.stack : undefined
    });
});

const PORT = process.env.PORT || 4000

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`API running at http://localhost:${PORT} (env=${process.env.NODE_ENV})`);

    })
}

module.exports = app