import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { isValidDeliverySignature, listUserDeliveries, readUserDeliveryContent, signedDeliveryUrl } from '../services/user-delivery.service.js';
import { prisma } from '../lib/prisma.js';

export const deliveryRoutes = Router();
// This is intentionally available without a bearer token because Android's
// external document viewer cannot forward one. Access still requires a
// user-bound, HMAC-signed URL that expires in five minutes.
deliveryRoutes.get('/:id/content', async (req, res) => {
  const signature = typeof req.query.signature === 'string' ? req.query.signature : undefined;
  const expires = typeof req.query.expires === 'string' ? req.query.expires : undefined;
  const row = await prisma.userDelivery.findUnique({ where: { id: req.params.id }, select: { userId: true } });
  if (!row || !isValidDeliverySignature(row.userId, req.params.id, expires, signature)) return res.status(403).json({ status: false, message: 'Download link is invalid or has expired' });
  const result = await readUserDeliveryContent(row.userId, req.params.id);
  if (!result) return res.status(404).json({ status: false, message: 'Delivery not found' });
  res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': result.row.mimeType, 'Content-Length': String(result.bytes.length), 'Content-Disposition': `attachment; filename="${result.row.fileName.replace(/[\r\n"]/g, '_')}"` });
  res.send(result.bytes);
});
deliveryRoutes.use(requireAuth);
deliveryRoutes.get('/', async (req, res) => {
  const rows = await listUserDeliveries(req.user!.id);
  res.json({ status: true, data: rows.map((r) => ({ id: r.id, title: r.title, description: r.description, file_name: r.fileName, mime_type: r.mimeType, file_size: r.fileSize, reference: r.reference, created_at: r.createdAt.toISOString() })) });
});
deliveryRoutes.get('/:id/download', async (req, res) => {
  try {
    const result = await signedDeliveryUrl(req.user!.id, req.params.id);
    if (!result) return res.status(404).json({ status: false, message: 'Delivery not found' });
    const base = `${req.protocol}://${req.get('host')}`;
    res.set('Cache-Control', 'no-store').json({ status: true, data: { url: `${base}${result.path}`, file_name: result.row.fileName, mime_type: result.row.mimeType, expires_in: result.expires - Math.floor(Date.now() / 1000) } });
  } catch (error) {
    res.status(410).json({ status: false, message: error instanceof Error ? error.message : 'Delivery is unavailable' });
  }
});
