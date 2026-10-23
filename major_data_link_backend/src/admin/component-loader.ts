import { ComponentLoader } from 'adminjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const componentLoader = new ComponentLoader();

// During local development tsx executes this file directly from src/, where
// AdminJS components still have their .tsx extension. In a production build
// TypeScript emits the components into dist/ as .js files. Resolve the right
// sibling extension in both environments so AdminJS can start in dev and in
// the compiled server without a missing-component error.
function componentPath(name: string): string {
  const sourcePath = fileURLToPath(new URL(`./components/${name}.tsx`, import.meta.url));
  return existsSync(sourcePath) ? `./components/${name}.tsx` : `./components/${name}.js`;
}

export const Components = {
  Dashboard: componentLoader.add('Dashboard', componentPath('dashboard'))
};

// 'TopBar' is one of AdminJS's built-in overridable component names (see
// ComponentLoader.defaultComponents) - it doesn't need wiring into any
// resource/dashboard config the way 'Dashboard' above does. Overriding it
// purely to mount GlobalChatAlert (desktop notification + chime + title
// flash for a new support-chat message) so it runs on every admin page, not
// only /admin/live-chat - see topbar-with-chat-alert.tsx.
componentLoader.override('TopBar', componentPath('topbar-with-chat-alert'));
