import { createApp } from "./app";
import { config } from "./config";
import { prisma } from "./lib/prisma";
import { revalidateWebsite } from "./services/revalidate.service";

const server = createApp().listen(config.port, () => {
  console.log(`RentOMate API listening on http://localhost:${config.port}`);
  // On a fresh deploy the website may have been built while this API was down (empty blog).
  // Ask it to refresh once it's likely up.
  for (const delay of [15_000, 60_000]) setTimeout(revalidateWebsite, delay).unref();
});

// The website keeps proxy connections alive; Node's default 5s idle timeout would close sockets
// it is about to reuse ("socket hang up"). Keep them open longer than the proxy does.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

const shutdown = () => {
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
