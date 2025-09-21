import express from 'express';
const app = express();

app.get('/', (req, res) => {
  res.send('Hello from test server!');
});

app.listen(3001, '0.0.0.0', () => {
  console.log('Test server listening on http://0.0.0.0:3001');
});