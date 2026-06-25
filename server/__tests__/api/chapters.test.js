const request = require('supertest');
const app = require('../../server');
const db = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  pool: {
    end: jest.fn()
  }
}));

describe('Chapter Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/chapters', () => {
    it('should return 401 if user is not authenticated', async () => {
      const res = await request(app).get('/api/v1/chapters');
      expect(res.statusCode).toBe(401);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/v1/chapters/:id', () => {
    it('should return 401 if user is not authenticated', async () => {
      const res = await request(app).get('/api/v1/chapters/123');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/chapters', () => {
    it('should return 403 due to missing CSRF token', async () => {
      const res = await request(app).post('/api/v1/chapters').send({ name: 'Trip' });
      expect(res.statusCode).toBe(403);
    });
  });
});
