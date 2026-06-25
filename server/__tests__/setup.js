// Jest setup file
require('dotenv').config();

// Set environment to test
process.env.NODE_ENV = 'test';

// Mock console.log during tests if desired, or set specific env vars
// For now, we will just ensure the test DB URL is set or fallback
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
}
