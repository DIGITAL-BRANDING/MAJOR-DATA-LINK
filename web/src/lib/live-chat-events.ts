/** Lets any part of the app (e.g. the dashboard's Support button) open the live chat widget. */
export const OPEN_LIVECHAT_EVENT = 'mdl:open-livechat';

export function openLiveChat() {
  window.dispatchEvent(new Event(OPEN_LIVECHAT_EVENT));
}
