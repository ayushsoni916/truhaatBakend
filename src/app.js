require('dotenv').config();
const express = require('express');

const app = express();

// Middleware to parse JSON requests
app.use(express.json());

//health endpoin
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
})

//basic 404 for everything else
app.use((req, res) => res.status(404).json({ error: 'Not Found' }))

const PORT = process.env.PORT || 4000

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`API running at http://localhost:${PORT} (env=${process.env.NODE_ENV})`);

    })
}

module.exports = app