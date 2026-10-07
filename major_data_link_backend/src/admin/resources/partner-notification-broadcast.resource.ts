import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import { fanOutPartnerBroadcast, PROMO_ILLUSTRATIONS } from '../../services/notification.service.js';
import { logAdminAction } from '../audit.js';
import type { AdminSessionUser } from '../auth.js';

/**
 * Admin "send a message to partners" feature - the partner-portal
 * counterpart of notification-broadcast.resource.ts. Same shape, same
 * compose-and-fan-out flow; the only differences are the partner-specific
 * audience choices (no KYC concept for a Partner, but it does have its own
 * ACTIVE/PENDING_REVIEW/SUSPENDED status) and that fanOutPartnerBroadcast()
 * never pushes - partners have no device tokens, so this reaches them only
 * as an in-app notification (bell + popup) in the partner portal.
 */
const canSendNotifications = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN' || admin?.role === 'FINANCE';
};

export const partnerNotificationBroadcastResource: ResourceWithOptions = {
  resource: { model: getModelByName('PartnerNotificationBroadcast'), client: prisma },
  options: {
    id: 'PartnerNotificationBroadcast',
    navigation: { name: 'Communication', icon: 'Bell' },
    listProperties: ['title', 'audience', 'showAsPopup', 'recipientCount', 'createdByAdmin', 'createdAt'],
    showProperties: [
      'id',
      'title',
      'body',
      'type',
      'audience',
      'targetPartnerIds',
      'imageKey',
      'showAsPopup',
      'recipientCount',
      'createdByAdmin',
      'createdAt'
    ],
    // Same append-only design as NotificationBroadcast - a sent broadcast is
    // a historical record of what went out and to how many partners, never
    // edited or deleted after the fact.
    editProperties: ['title', 'body', 'type', 'audience', 'targetPartnerIds', 'imageKey', 'showAsPopup'],
    filterProperties: ['audience', 'showAsPopup', 'createdByAdmin', 'createdAt'],
    properties: {
      title: { description: 'Shown as the notification title in the partner portal, e.g. "New API capability".' },
      body: { description: 'The message body partners will see in the portal’s notification bell/popup.' },
      audience: {
        availableValues: [
          { value: 'ALL_PARTNERS', label: 'All partners' },
          { value: 'ACTIVE_PARTNERS_ONLY', label: 'Active partners only' },
          { value: 'SPECIFIC_PARTNERS', label: 'Specific partners (enter IDs in Target Partner Ids)' }
        ]
      },
      targetPartnerIds: {
        type: 'string',
        description: 'Only used when Audience is "Specific partners". Comma-separated list of Partner IDs.',
        isVisible: { list: false, filter: false, show: true, edit: true }
      },
      imageKey: {
        description:
          'Optional illustration for the popup style below. Leave unset for a plain text notification.',
        availableValues: PROMO_ILLUSTRATIONS.map((i) => ({ value: i.value, label: i.label }))
      },
      showAsPopup: {
        description:
          'ON: shows as a full-screen dialog the next time each partner opens the portal (in addition to the notification list). OFF: appears in the notification list only.'
      },
      recipientCount: { isDisabled: true },
      createdByAdmin: { isVisible: { list: true, filter: true, show: true, edit: false } }
    },
    actions: {
      list: { isAccessible: canSendNotifications },
      show: { isAccessible: canSendNotifications },
      edit: { isAccessible: false },
      delete: { isAccessible: false },
      new: {
        isAccessible: canSendNotifications,
        before: async (request, context) => {
          const admin = context.currentAdmin as unknown as AdminSessionUser | undefined;
          if (!admin?.id) throw new Error('Missing admin session');

          if (request.payload) {
            request.payload.createdByAdminId = admin.id;

            // Same comma-separated-string -> JSON-array conversion as
            // notification-broadcast.resource.ts's targetUserIds.
            const raw = request.payload.targetPartnerIds;
            if (typeof raw === 'string' && raw.trim().length > 0) {
              request.payload.targetPartnerIds = JSON.stringify(
                raw.split(',').map((id: string) => id.trim()).filter(Boolean)
              );
            } else {
              request.payload.targetPartnerIds = null;
            }
          }
          return request;
        },
        after: async (response: any) => {
          const record = response.record;
          // Same AdminJS `errors` footgun as notification-broadcast.resource.ts:
          // it always serializes as an object, so an empty object is truthy -
          // must check Object.keys(...).length, not just `!record.errors`.
          const hasValidationErrors =
            Boolean(record?.baseError) || Object.keys(record?.errors ?? {}).length > 0;
          if (record?.params?.id && !hasValidationErrors) {
            const broadcast = await fanOutPartnerBroadcast(record.params.id as string);

            await logAdminAction({
              adminId: broadcast.createdByAdminId,
              action: 'SEND_PARTNER_NOTIFICATION_BROADCAST',
              targetType: 'PartnerNotificationBroadcast',
              targetId: broadcast.id,
              metadata: { title: broadcast.title, audience: broadcast.audience, recipientCount: broadcast.recipientCount }
            });

            response.notice = { message: `Sent to ${broadcast.recipientCount} partner(s).`, type: 'success' };
          }
          return response;
        }
      }
    }
  }
};
