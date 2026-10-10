import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { createGuestSession } from '../services/guest-chat.service.js';

export const guestChatRoutes = Router();

// Starting a chat creates a row, so bound it per network. Chat itself is
// limited per connection in chat-socket.ts.
const startLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { status: false, message: 'Too many chat requests from this network. Please try again later.' },
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ]{7,20}$/;

const startSchema = z.object({
  name: z.string().trim().min(2).max(60),
  contact: z
    .string()
    .trim()
    .min(5)
    .max(120)
    .refine((value) => (value.includes('@') ? EMAIL.test(value) : PHONE.test(value)), 'Enter a valid email or phone number'),
});

guestChatRoutes.post('/session', startLimiter, async (req, res) => {
  const body = startSchema.parse(req.body);
  const session = await createGuestSession({ displayName: body.name, contact: body.contact });
  res.set('Cache-Control', 'no-store');
  res.json({
    status: true,
    data: { guest_token: session.token, guest_id: session.guestId, display_name: session.displayName },
  });
});
