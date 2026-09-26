import React from 'react';
import GlobalChatAlert from './global-chat-alert.js';

/**
 * AdminJS renders TopBar unconditionally, outside the page-specific
 * <Routes> (see adminjs/lib/frontend/components/app/application.js), so
 * it's the one built-in override point that survives every navigation -
 * exactly what GlobalChatAlert needs to stay mounted (and its socket
 * connected) across the whole admin panel, not just one page. `override()`
 * always passes the untouched original component in as `OriginalComponent`
 * (see adminjs/lib/frontend/hoc/allow-override.js) - this file renders it
 * as-is and never reimplements the navbar itself.
 */
export default function TopBarWithChatAlert(props: Record<string, unknown> & { OriginalComponent: React.ComponentType<Record<string, unknown>> }) {
  const { OriginalComponent, ...rest } = props;
  return (
    <>
      <OriginalComponent {...rest} />
      <GlobalChatAlert />
    </>
  );
}
