const request = require('supertest');
const app = require('../src/app');

async function getToken() {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Reviewer',
    email: `reviewer_${Date.now()}@example.com`,
    password: 'secret123',
  });
  return res.body.token;
}

const samplePlace = {
  name: 'The Old Quarter Roastery',
  description: 'Retro-style café with great music and a nice view',
  address: '152 Trieu Viet Vuong Street',
  city: 'Hanoi',
  category: 'cafe',
  priceRange: '$$',
};

describe('Place API', () => {
  it('allows anyone to browse places without logging in', async () => {
    const res = await request(app).get('/api/places');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('rejects creating a place without a token', async () => {
    const res = await request(app).post('/api/places').send(samplePlace);
    expect(res.statusCode).toBe(401);
  });

  it('creates a place and lists it publicly afterwards', async () => {
    const token = await getToken();
    const createRes = await request(app)
      .post('/api/places')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePlace);
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.name).toBe(samplePlace.name);
    expect(createRes.body.city).toBe('Hanoi');

    const listRes = await request(app).get('/api/places?city=Hanoi');
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.length).toBe(1);
  });

  it('lets the owner update their place', async () => {
    const token = await getToken();
    const createRes = await request(app)
      .post('/api/places')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePlace);

    const updateRes = await request(app)
      .put(`/api/places/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priceRange: '$$$' });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.priceRange).toBe('$$$');
  });

  it('prevents a different user from editing or deleting someone else\'s place', async () => {
    const ownerToken = await getToken();
    const otherToken = await getToken();
    const createRes = await request(app)
      .post('/api/places')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(samplePlace);

    const updateRes = await request(app)
      .put(`/api/places/${createRes.body._id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ priceRange: '$' });
    expect(updateRes.statusCode).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/places/${createRes.body._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(deleteRes.statusCode).toBe(404);
  });

  it('deletes a place as its owner', async () => {
    const token = await getToken();
    const createRes = await request(app)
      .post('/api/places')
      .set('Authorization', `Bearer ${token}`)
      .send(samplePlace);

    const deleteRes = await request(app)
      .delete(`/api/places/${createRes.body._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.statusCode).toBe(204);
  });
});
