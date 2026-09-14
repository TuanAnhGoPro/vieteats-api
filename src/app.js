const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const placeRoutes = require('./routes/placeRoutes');
const errorHandler = require('./middleware/errorHandler');
const { register, httpRequestDuration } = require('./utils/metrics');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // relaxed for the simple static demo frontend
  })
);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Track request duration for Prometheus
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

// Health check - used by Deploy/Release smoke tests and container orchestration
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Prometheus scrape endpoint - used by the Monitoring stage
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/auth', authRoutes);
app.use('/api/places', placeRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
