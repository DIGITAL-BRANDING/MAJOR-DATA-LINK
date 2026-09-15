import { spawn } from 'node:child_process';

// A deployed Prisma client may select a newly-added column before the API can
// serve any request. Run `migrate deploy` before every production start so
// the database and generated client are always in lockstep. The command is
// idempotent: it only applies migrations that have not already been recorded.
// `SKIP_MIGRATIONS_ON_START` is reserved for an operator-set emergency path.
const skipMigrationsOnStart = process.env.SKIP_MIGRATIONS_ON_START === 'true';
const migrationTimeoutMs = Number(process.env.MIGRATION_TIMEOUT_MS ?? 120_000);

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    console.log(`[start] Running: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    const timeout = setTimeout(() => {
      console.error(`[start] ${command} timed out after ${timeoutMs}ms`);
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`[start] ${command} completed successfully`);
        return resolve();
      }

      const exitInfo = code !== null ? `code ${code}` : `signal ${signal}`;
      reject(new Error(`${command} exited with ${exitInfo}`));
    });
  });
}

process.on('uncaughtException', (error) => {
  console.error('[start] uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[start] unhandled rejection', reason);
  process.exit(1);
});

console.log('[start] Starting production deployment sequence');

if (skipMigrationsOnStart) {
  console.warn('[start] SKIP_MIGRATIONS_ON_START=true; migrations were intentionally skipped');
} else {
  console.log('[start] Running Prisma migrations before starting the API');
  await run('npx', ['prisma', 'migrate', 'deploy'], migrationTimeoutMs);
}

console.log('[start] Starting API server');
await import('../dist/server.js');
