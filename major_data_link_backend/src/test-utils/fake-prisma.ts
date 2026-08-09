/**
 * A minimal in-memory stand-in for the Prisma client, covering only the
 * methods wallet.service.ts (and friends) actually call. This is NOT a
 * general-purpose Prisma mock - it exists so wallet debit/refund/idempotency
 * logic can be unit-tested without a real Postgres database, which this
 * environment doesn't have wired up.
 *
 * It deliberately re-implements the two "conditional update" patterns
 * (`updateMany` with a `gte` guard) that debitWallet()/manualWalletAdjustment()
 * rely on for race-safety, so tests can actually exercise the
 * insufficient-balance rejection path realistically.
 *
 * `$transaction(fn)` just calls `fn(api)` directly - there's no real
 * multi-statement atomicity here (no rollback-on-throw across the fake user/
 * transaction maps), so these tests verify *business logic* (balances,
 * status transitions, idempotency), not Postgres transaction isolation
 * itself. True concurrency/isolation guarantees need an integration test
 * against a real database - see the note in wallet.service.test.ts.
 */

export type FakeUser = {
  id: string;
  walletBalanceKobo: bigint;
  [key: string]: unknown;
};

export type FakeTransaction = {
  id: string;
  userId: string;
  status: string;
  [key: string]: unknown;
};

type WhereClause = Record<string, unknown>;

function applyUpdate(record: Record<string, unknown>, data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const op = value as { increment?: unknown; decrement?: unknown };
      if ('increment' in op) {
        record[key] = (record[key] as bigint) + BigInt(op.increment as bigint | number);
        continue;
      }
      if ('decrement' in op) {
        record[key] = (record[key] as bigint) - BigInt(op.decrement as bigint | number);
        continue;
      }
    }
    record[key] = value;
  }
}

function matchesWhere(record: Record<string, unknown>, where: WhereClause): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
      const op = expected as { gte?: bigint };
      if ('gte' in op) return (record[key] as bigint) >= (op.gte as bigint);
    }
    return record[key] === expected;
  });
}

export function createFakePrisma() {
  const users = new Map<string, FakeUser>();
  const transactions = new Map<string, FakeTransaction>();

  const userApi = {
    async create({ data }: { data: Record<string, unknown> }) {
      const user = { ...data } as FakeUser;
      users.set(user.id, user);
      return { ...user };
    },
    async findUnique({ where }: { where: WhereClause }) {
      const user = users.get(where.id as string);
      return user ? { ...user } : null;
    },
    async findUniqueOrThrow({ where }: { where: WhereClause }) {
      const user = users.get(where.id as string);
      if (!user) throw new Error(`FakePrisma: user ${where.id} not found`);
      return { ...user };
    },
    async update({ where, data }: { where: WhereClause; data: Record<string, unknown> }) {
      const user = users.get(where.id as string);
      if (!user) throw new Error(`FakePrisma: user ${where.id} not found`);
      applyUpdate(user, data);
      return { ...user };
    },
    async updateMany({ where, data }: { where: WhereClause; data: Record<string, unknown> }) {
      const user = users.get(where.id as string);
      if (!user || !matchesWhere(user, where)) return { count: 0 };
      applyUpdate(user, data);
      return { count: 1 };
    }
  };

  const transactionApi = {
    async findFirst({ where }: { where: WhereClause }) {
      for (const t of transactions.values()) {
        if (matchesWhere(t, where)) return { ...t };
      }
      return null;
    },
    async findUnique({ where }: { where: WhereClause }) {
      if (where.id) {
        const t = transactions.get(where.id as string);
        return t ? { ...t } : null;
      }
      for (const t of transactions.values()) {
        if (matchesWhere(t, where)) return { ...t };
      }
      return null;
    },
    async findUniqueOrThrow(args: { where: WhereClause }) {
      const t = await transactionApi.findUnique(args);
      if (!t) throw new Error('FakePrisma: transaction not found');
      return t;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      const t = { ...data } as FakeTransaction;
      transactions.set(t.id, t);
      return { ...t };
    },
    async update({ where, data }: { where: WhereClause; data: Record<string, unknown> }) {
      const t = transactions.get(where.id as string);
      if (!t) throw new Error('FakePrisma: transaction not found');
      applyUpdate(t, data);
      return { ...t };
    },
    async updateMany({ where, data }: { where: WhereClause; data: Record<string, unknown> }) {
      let count = 0;
      for (const t of transactions.values()) {
        if (matchesWhere(t, where)) {
          applyUpdate(t, data);
          count += 1;
        }
      }
      return { count };
    }
  };

  type FakePrismaApi = {
    user: typeof userApi;
    transaction: typeof transactionApi;
    $transaction<T>(fn: (tx: FakePrismaApi) => Promise<T>): Promise<T>;
  };

  const api: FakePrismaApi = {
    user: userApi,
    transaction: transactionApi,
    async $transaction<T>(fn: (tx: FakePrismaApi) => Promise<T>): Promise<T> {
      return fn(api);
    }
  };

  return { api, users, transactions };
}

export function makeUser(overrides: Partial<FakeUser> & { id: string; walletBalanceKobo: bigint }): FakeUser {
  return { ...overrides };
}
