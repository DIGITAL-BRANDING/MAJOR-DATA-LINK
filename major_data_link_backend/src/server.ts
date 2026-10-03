// Prisma maps Postgres bigint amounts to JS BigInt; normalize safe kobo values
// before any response serialization (including AdminJS).
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function toJSON(
  this: bigint
) {
  return Number(this);
};

import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { attachChatSocket } from './realtime/chat-socket.js';

process.on('uncaughtException', (error) => {
  console.error('[server] uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection', reason);
  process.exit(1);
});

async function startServer() {
  try {
    // Prevent production from silently serving mock provider data.
    if (env.NODE_ENV === 'production' && env.MOCK_PROVIDER) {
      console.error(
        '[server] WARNING: NODE_ENV=production but MOCK_PROVIDER is true (unset or not "false"). ' +
          'Data plans, purchases, and the provider wallet balance are all running on MOCK data. ' +
          'Set MOCK_PROVIDER=false in the Railway environment variables to use real Alrahuz data.'
      );
    }

    // Identity verification has an independent mock-provider switch.
    if (env.NODE_ENV === 'production' && env.MOCK_TECHHUB) {
      console.error(
        '[server] WARNING: NODE_ENV=production but MOCK_TECHHUB is true (unset or not "false"). ' +
          'NIN/BVN verification requests are all running on MOCK data instead of hitting Techhub. ' +
          'Set MOCK_TECHHUB=false and TECHHUB_API_KEY in the Railway environment variables to use real Techhub data.'
      );
    }

    console.log('[server] Creating Express app');
    const app = createApp();
    const { startPartnerWebhookWorker } = await import('./services/partner-webhook.service.js');
    const { reconcilePendingPartnerVerificationTickets } = await import('./services/partner-verification.service.js');
    const stopPartnerWebhookWorker = startPartnerWebhookWorker();
    const reconcilePartnerTickets = () => void reconcilePendingPartnerVerificationTickets().catch((error) => console.error('[partner-verification] reconciliation run failed', error));
    reconcilePartnerTickets();
    const partnerTicketTimer = setInterval(reconcilePartnerTickets, 30_000);
    partnerTicketTimer.unref();

    // Watchdog: logs loudly if any wallet stops matching its ledger.
    const { startWalletDriftMonitor } = await import('./services/wallet-drift.service.js');
    startWalletDriftMonitor();

    // Seed pricing rows so admin controls include services not yet purchased.
    // This is best-effort and must not block startup.
    try {
      const { listVerificationPricesForAdmin } = await import('./services/verification.service.js');
      const { listServicePricesForAdmin } = await import('./services/result-pin.service.js');
      const [verificationPrices, resultPinPrices] = await Promise.all([
        listVerificationPricesForAdmin(),
        listServicePricesForAdmin()
      ]);
      console.log(
        `[server] Seeded service pricing rows: ${verificationPrices.length} Techhub, ${resultPinPrices.length} Alrahuz`
      );
    } catch (error) {
      console.error('[server] Failed to seed service pricing rows (non-fatal):', error);
    }

    // Socket.IO must attach to the same HTTP server that serves Express.
    const httpServer = http.createServer(app);
    attachChatSocket(httpServer);

    const server = httpServer.listen(env.PORT, '0.0.0.0', () => {
      console.log(`MAJOR DATA-LINK backend listening on port ${env.PORT}`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[server] Port ${env.PORT} is already in use`);
      } else {
        console.error('[server] listen error', err);
      }
      process.exit(1);
    });

    const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        console.log(`[server] Received ${signal}, shutting down gracefully`);
        server.close(async () => {
          stopPartnerWebhookWorker();
          clearInterval(partnerTicketTimer);
          await prisma.$disconnect();
          console.log('[server] Server closed, database disconnected');
          process.exit(0);
        });

        setTimeout(() => {
          console.error('[server] Forced shutdown after 10s timeout');
          process.exit(1);
        }, 10_000);
      });
    });
  } catch (error) {
    console.error('[server] Failed to start server', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void startServer();

