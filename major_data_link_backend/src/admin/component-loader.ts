import { ComponentLoader } from 'adminjs';

export const componentLoader = new ComponentLoader();

export const Components = {
  Dashboard: componentLoader.add('Dashboard', './components/dashboard.js')
};

// 'TopBar' is one of AdminJS's built-in overridable component names (see
// ComponentLoader.defaultComponents) - it doesn't need wiring into any
// resource/dashboard config the way 'Dashboard' above does. Overriding it
// purely to mount GlobalChatAlert (desktop notification + chime + title
// flash for a new support-chat message) so it runs on every admin page, not
// only /admin/live-chat - see topbar-with-chat-alert.tsx.
componentLoader.override('TopBar', './components/topbar-with-chat-alert.js');
