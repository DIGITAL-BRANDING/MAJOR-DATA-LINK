/**
 * Provider JSON varies between endpoints and over time: the same photograph
 * or PDF has shown up as `photo`, `image`, `user_photo_base64`, nested one or
 * two objects down, or under a key we have never seen. Instead of guessing key
 * names, these helpers look at the VALUES - a base64 string whose first bytes
 * are a JPEG/PNG/PDF signature is one, whatever it is called.
 */

const MAX_DEPTH = 8;

export type EmbeddedImage = { base64: string; format: 'jpeg' | 'png'; key: string };

/** Every plain object in the tree, shallowest first (so top-level fields win over nested ones). */
export function collectObjects(root: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  let level: unknown[] = [root];
  for (let depth = 0; depth <= MAX_DEPTH && level.length > 0; depth += 1) {
    const next: unknown[] = [];
    for (const node of level) {
      if (Array.isArray(node)) {
        next.push(...node);
      } else if (node !== null && typeof node === 'object') {
        out.push(node as Record<string, unknown>);
        next.push(...Object.values(node));
      }
    }
    level = next;
  }
  return out;
}

type Signature = 'jpeg' | 'png' | 'pdf';

function stripDataUri(value: string): string {
  return value.replace(/^\s*data:[a-z]+\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
}

function signatureOf(base64: string): Signature | undefined {
  if (base64.length < 120 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(base64.slice(0, 200))) return undefined;
  const head = Buffer.from(base64.slice(0, 16).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  return undefined;
}

function* stringsWithKeys(root: unknown, key = '', depth = 0): Generator<{ key: string; value: string }> {
  if (depth > MAX_DEPTH) return;
  if (typeof root === 'string') {
    yield { key, value: root };
  } else if (Array.isArray(root)) {
    for (const item of root) yield* stringsWithKeys(item, key, depth + 1);
  } else if (root !== null && typeof root === 'object') {
    for (const [childKey, child] of Object.entries(root)) yield* stringsWithKeys(child, childKey, depth + 1);
  }
}

const PHOTO_KEY = /photo|image|picture|passport|portrait|face|avatar|img/i;

/** The biggest base64 PDF anywhere in the response (raw base64 or a data: URI). */
export function findEmbeddedPdf(root: unknown): string | undefined {
  let best: string | undefined;
  for (const { value } of stringsWithKeys(root)) {
    const base64 = stripDataUri(value);
    if (signatureOf(base64) === 'pdf' && (!best || base64.length > best.length)) best = base64;
  }
  return best;
}

/**
 * The most likely photograph anywhere in the response: a base64 JPEG/PNG,
 * preferring a field whose name says photo/image/passport, then the largest.
 */
export function findEmbeddedImage(root: unknown): EmbeddedImage | undefined {
  let best: (EmbeddedImage & { named: boolean }) | undefined;
  for (const { key, value } of stringsWithKeys(root)) {
    const base64 = stripDataUri(value);
    const signature = signatureOf(base64);
    if (signature !== 'jpeg' && signature !== 'png') continue;
    const candidate = { base64, format: signature, key, named: PHOTO_KEY.test(key) };
    if (!best || (candidate.named && !best.named) || (candidate.named === best.named && base64.length > best.base64.length)) {
      best = candidate;
    }
  }
  return best ? { base64: best.base64, format: best.format, key: best.key } : undefined;
}
