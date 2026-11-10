const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const config = require('./config');
const { UPLOAD_ROOT } = require('./services/storage');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // photos are shown by the web app
app.use(cors({
  origin(origin, cb) {
    // Mobile apps and curl send no Origin header.
    if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));
if (!config.isProd) app.use(morgan('dev'));

app.use('/uploads', express.static(UPLOAD_ROOT, { maxAge: '7d', fallthrough: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down', time: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api', require('./routes/misc'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
