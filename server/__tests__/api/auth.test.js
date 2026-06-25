const request = require('supertest');
const app = require('../../server');

describe('Auth Endpoints', () => {
  describe('GET /api/v1/auth/me', () => {
    it('should return 401 when no session cookie is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.statusCode).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should return 403 due to missing CSRF token', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.statusCode).toBe(403);
    });
  });
});
