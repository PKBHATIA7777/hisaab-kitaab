const request = require('supertest');
const express = require('express');

// Dummy test to ensure Jest + Supertest works
describe('Initial Test Setup', () => {
  it('should pass a basic truthiness test', () => {
    expect(true).toBe(true);
  });

  it('supertest should be able to make a request to a mock app', async () => {
    const app = express();
    app.get('/ping', (req, res) => res.status(200).json({ message: 'pong' }));

    const response = await request(app).get('/ping');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('pong');
  });
});
