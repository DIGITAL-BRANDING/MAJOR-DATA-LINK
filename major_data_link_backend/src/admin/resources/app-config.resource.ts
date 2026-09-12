import { getModelByName } from '@adminjs/prisma';
import type { ResourceWithOptions } from 'adminjs';
import { prisma } from '../../lib/prisma.js';
import { logAdminAction } from '../audit.js';
import type { AdminSessionUser } from '../auth.js';

const canManageAppConfig = ({ currentAdmin }: { currentAdmin?: Record<string, unknown> }) => {
  const admin = currentAdmin as unknown as AdminSessionUser | undefined;
  return admin?.role === 'SUPER_ADMIN';
};

/**
 * This one field re-points EVERY installed app at a new backend origin the
 * next time each one syncs - there is no "undo for one device" once it's
 * out. Reject anything that isn't a well-formed https:// URL with a real
 * host before it ever reaches the database, rather than trusting the
 * Flutter client's own (separate, defense-in-depth) validation to be the
 * only check. Returns an error string, or null when the value is fine to
 * save.
 */
function validateApiBaseUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return 'Must be a URL string.';

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return 'Not a valid URL - include the scheme, e.g. https://api.majordatalink.ng';
  }

  if (parsed.protocol !== 'https:') {
    return 'Must start with https:// - the app refuses cleartext http:// in production builds.';
  }
  if (!parsed.hostname) {
    return 'URL is missing a host.';
  }
  if (['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname)) {
    return 'Refusing a loopback/emulator host - that would break every real user\'s app, not just yours.';
  }
  // Trailing slash silently breaks Dio's path joining (baseUrl + '/foo'
  // becomes '...//foo'), which is an easy typo to make in a form field.
  if (value.trim().endsWith('/')) {
    return 'Remove the trailing slash, e.g. https://api.majordatalink.ng/api (not .../api/).';
  }
  return null;
}

/**
 * Singleton (id="default", self-seeded by getAppConfig() on first read) -
 * only new/delete are disabled, same as ReferralSettings/DataPlanPricing.
 * Restricted to SUPER_ADMIN (not FINANCE, unlike most other settings
 * resources) because setting minAndroidVersion too high locks EVERY user
 * on an older build out of the app at their next launch until they update -
 * a mistake here is a full outage, not a pricing tweak.
 */
export const appConfigResource: ResourceWithOptions = {
  resource: { model: getModelByName('AppConfig'), client: prisma },
  options: {
    id: 'AppConfig',
    navigation: { name: 'Settings', icon: 'Smartphone' },
    listProperties: ['minAndroidVersion', 'latestAndroidVersion', 'updatedAt'],
    showProperties: [
      'id',
      'minAndroidVersion',
      'latestAndroidVersion',
      'androidDownloadUrl',
      'updateMessage',
      'apiBaseUrl',
      'updatedAt'
    ],
    editProperties: [
      'minAndroidVersion',
      'latestAndroidVersion',
      'androidDownloadUrl',
      'updateMessage',
      'apiBaseUrl'
    ],
    properties: {
      id: { isVisible: { list: false, filter: false, show: true, edit: false } },
      minAndroidVersion: {
        description:
          'Any installed app version below this (comparing 1.2.3-style numbers, ignores the +buildNumber) is blocked at the splash screen with a "please update" screen until the user updates. Match this to pubspec.yaml\'s version field of the build you want to require.'
      },
      latestAndroidVersion: {
        description: 'Shown to the user as "Version X is available" on the update screen. Informational only - does not itself block anyone.'
      },
      androidDownloadUrl: {
        description:
          'Where the "Update Now" button sends the user. Defaults to the GitHub "latest release" link, which always points at the newest uploaded MajorDataLink.apk without needing to change here.'
      },
      updateMessage: {
        description: 'Optional custom message shown on the update screen, e.g. explaining what the update fixes. Leave empty for a generic message.'
      },
      apiBaseUrl: {
        description:
          'DANGER: overrides the backend origin EVERY installed app talks to, starting from each device\'s next cold start (see splash_screen.dart) - not instantly, and never mid-session. Leave blank to keep whatever URL is compiled into the app. Must be https://, no trailing slash, e.g. https://api.majordatalink.ng/api. Test on one internal-track device before rolling out widely - there is no way to undo this for a single user once their app has synced it.'
      },
      updatedAt: { isVisible: { list: true, filter: false, show: true, edit: false } }
    },
    actions: {
      list: { isAccessible: canManageAppConfig },
      show: { isAccessible: canManageAppConfig },
      edit: {
        isAccessible: canManageAppConfig,
        before: async (request) => {
          if (request.payload && 'apiBaseUrl' in request.payload) {
            const raw = request.payload.apiBaseUrl;
            const trimmed = typeof raw === 'string' ? raw.trim() : raw;
            const error = validateApiBaseUrl(trimmed);
            if (error) {
              throw new Error(`apiBaseUrl: ${error}`);
            }
            // Normalize '' to null so the Flutter client's "unset = use
            // compiled-in default" check (an empty check, not a null check)
            // isn't defeated by AdminJS submitting an empty string instead
            // of omitting the field entirely.
            request.payload.apiBaseUrl = trimmed === '' ? null : trimmed;
          }
          return request;
        },
        after: async (response: any, _request: unknown, context: any) => {
          const admin = context?.currentAdmin as unknown as AdminSessionUser | undefined;
          const record = response.record;
          const hasValidationErrors =
            Boolean(record?.baseError) || Object.keys(record?.errors ?? {}).length > 0;
          if (admin?.id && record?.params?.id && !hasValidationErrors) {
            await logAdminAction({
              adminId: admin.id,
              action: 'UPDATE_APP_CONFIG',
              targetType: 'AppConfig',
              targetId: record.params.id as string,
              metadata: {
                apiBaseUrl: record.params.apiBaseUrl ?? null,
                minAndroidVersion: record.params.minAndroidVersion
              }
            });
          }
          return response;
        }
      },
      new: { isAccessible: false },
      delete: { isAccessible: false },
      bulkDelete: { isAccessible: false }
    }
  }
};
