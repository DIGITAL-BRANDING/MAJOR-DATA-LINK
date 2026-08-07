import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import type { AdminSessionUser } from '../auth.js';

const canManageTickets = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return (
    admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE' || admin?.role === 'SUPPORT'
  );
};

export const supportTicketResource: ResourceWithOptions = {
  resource: { model: getModelByName('SupportTicket'), client: prisma },
  options: {
    id: 'SupportTicket',
    navigation: { name: 'Support', icon: 'MessageCircle' },
    listProperties: ['subject', 'status', 'userId', 'createdAt', 'updatedAt'],
    showProperties: ['id', 'subject', 'status', 'userId', 'createdAt', 'updatedAt'],
    editProperties: ['status'],
    filterProperties: ['status', 'userId', 'createdAt'],
    properties: {
      userId: { description: 'The user who opened this ticket.' },
      status: {
        description:
          'OPEN/PENDING = the user is waiting on a reply. Reply via the Support Ticket Messages resource, then set this to CLOSED once resolved.'
      }
    },
    actions: {
      list: { isAccessible: canManageTickets },
      show: { isAccessible: canManageTickets },
      edit: { isAccessible: canManageTickets },
      new: { isAccessible: false },
      delete: { isAccessible: false },
      bulkDelete: { isAccessible: false }
    }
  }
};

export const supportTicketMessageResource: ResourceWithOptions = {
  resource: { model: getModelByName('SupportTicketMessage'), client: prisma },
  options: {
    id: 'SupportTicketMessage',
    navigation: { name: 'Support', icon: 'MessageCircle' },
    listProperties: ['ticketId', 'senderType', 'senderName', 'message', 'createdAt'],
    showProperties: ['id', 'ticketId', 'senderType', 'senderName', 'message', 'createdAt'],
    editProperties: [],
    filterProperties: ['ticketId', 'senderType'],
    properties: {
      ticketId: { description: 'Paste the ticket ID from Support Tickets to reply to it.' },
      senderType: { isVisible: { list: true, filter: true, show: true, edit: false } },
      senderId: { isVisible: { list: false, filter: false, show: true, edit: false } },
      senderName: { isVisible: { list: true, filter: false, show: true, edit: false } }
    },
    actions: {
      list: { isAccessible: canManageTickets },
      show: { isAccessible: canManageTickets },
      edit: { isAccessible: false },
      delete: { isAccessible: false },
      bulkDelete: { isAccessible: false },
      new: {
        isAccessible: canManageTickets,
        // Replying here always comes from an admin - fill in senderType/
        // senderId/senderName automatically and reopen the ticket, so the
        // admin only ever has to type the ticket ID and the message.
        before: async (request, context) => {
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (request.payload) {
            request.payload.senderType = 'ADMIN';
            request.payload.senderId = admin?.id ?? '';
            request.payload.senderName = admin?.fullName ?? 'Support';
          }
          return request;
        },
        after: async (response, request) => {
          const ticketId = request.payload?.ticketId as string | undefined;
          if (ticketId) {
            await prisma.supportTicket.update({
              where: { id: ticketId },
              data: { status: 'PENDING' }
            });
          }
          return response;
        }
      }
    }
  }
};
