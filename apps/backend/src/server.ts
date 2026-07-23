import { createApp } from './app.js';
import { config } from './config/env.js';
import { prisma } from './config/prisma.js';
import { purgeOldVersions } from './modules/versions/versions.service.js';

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`);
});

// FR-VER-005 / SDS §26.4 — low-priority background purge, run once a day. Started only from the
// real server process, never from createApp() directly, so integration tests (which build the
// app without going through server.ts) never trigger it.
const VERSION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
  purgeOldVersions(prisma).catch((error) => {
    console.error('Version purge failed:', error);
  });
}, VERSION_PURGE_INTERVAL_MS).unref();
