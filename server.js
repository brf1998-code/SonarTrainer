// Minimal production server for Railway.
// Serves the built client from /dist. The simulation runs client-side in v1;
// this server is the anchor point for the phase-2 multiplayer WebSocket rooms.
import express from 'express';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(compression());
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Sonar/TMA Trainer listening on :${port}`);
});
