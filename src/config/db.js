const mongoose = require('mongoose');

async function connectDB() {
  if (process.env.NODE_ENV === 'test') return; // tests use mongodb-memory-server directly
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/vieteats';
  try {
    await mongoose.connect(uri);
    // eslint-disable-next-line no-console
    console.log('MongoDB connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
