const request = require('supertest');
const app = require('../../server');
const db = require('../../config/db');

// Mock the database for health checks
jest.mock('../../config/db', () => ({
  query: jest.fn(),
  pool: {
    end: jest.fn()
  }
}));

describe('Health and Config Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /ping', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/ping');
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('OK');
    });
  });

  describe('GET /api/health', () => {
    it('should return status ok when DB query succeeds', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should return degraded status when DB query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('DB Connection Failed'));
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('degraded');
    });
  });

  describe('GET /api/v1/config', () => {
    it('should return googleClientId from environment', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      const res = await request(app).get('/api/v1/config');
      expect(res.statusCode).toBe(200);
      expect(res.body.googleClientId).toBe('test-client-id');
    });
  });
});
