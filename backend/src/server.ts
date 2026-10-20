import { app } from './app.js';
import { env } from './config/env.js';
import { startRoundAutoClose } from './jobs/roundAutoClose.js';

const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function logStarted() {
  const lines = [
    `${GREEN}========================================${RESET}`,
    `${GREEN}  Waste Bank Backend Started${RESET}`,
    `${GREEN}========================================${RESET}`,
    `${CYAN}  URL   :${RESET} http://${env.host ?? 'localhost'}:${env.port}`,
    `${CYAN}  MODE  :${RESET} ${env.nodeEnv}`,
    `${CYAN}  CORS  :${RESET} ${env.corsOrigins.join(', ')}`,
    `${GREEN}========================================${RESET}`,
  ];

  console.log(lines.join('\n'));
}

if (env.host) app.listen(env.port, env.host, logStarted);
else app.listen(env.port, logStarted);

startRoundAutoClose();
