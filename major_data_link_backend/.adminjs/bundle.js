(function (React, designSystem) {
  'use strict';

  function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

  var React__default = /*#__PURE__*/_interopDefault(React);

  const ADMIN_ROOT_PATH$1 = '/admin';
  function PendingRequestsPopup() {
    const [summary, setSummary] = React.useState(null);
    const [dismissed, setDismissed] = React.useState(false);
    const previousPending = React.useRef(null);
    React.useEffect(() => {
      let active = true;
      const load = () => fetch(`${ADMIN_ROOT_PATH$1}/pending-summary`, {
        credentials: 'include'
      }).then(r => r.ok ? r.json() : Promise.reject()).then(body => {
        if (active) setSummary(body.data);
      }).catch(() => {});
      void load();
      const interval = window.setInterval(load, 45_000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }, []);
    React.useEffect(() => {
      if (summary && previousPending.current !== null && summary.total_pending > previousPending.current) setDismissed(false);
      if (summary) previousPending.current = summary.total_pending;
    }, [summary]);
    if (dismissed || !summary || summary.total_pending === 0) return null;
    return /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      style: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.55)',
        zIndex: 1000
      },
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      onClick: () => setDismissed(true)
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
      variant: "white",
      boxShadow: "card",
      p: "xl",
      style: {
        width: 'min(480px,92vw)',
        borderRadius: 14
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React__default.default.createElement(designSystem.H4, {
      mb: "default"
    }, "Requests waiting on you"), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
      mb: "lg"
    }, summary.total_pending, " unresolved request", summary.total_pending === 1 ? '' : 's', summary.total_new_last_24h ? ` • ${summary.total_new_last_24h} new today` : ''), summary.by_type.filter(row => row.pending).map(row => /*#__PURE__*/React__default.default.createElement("a", {
      key: row.type,
      href: row.href,
      style: {
        display: 'block',
        padding: '10px 0',
        borderBottom: '1px solid #eee',
        textDecoration: 'none'
      }
    }, /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
      fontWeight: "bold"
    }, row.label, ": ", row.pending, " pending \u2192"))), /*#__PURE__*/React__default.default.createElement(designSystem.Button, {
      mt: "lg",
      onClick: () => setDismissed(true),
      style: {
        width: '100%'
      }
    }, "Got it")));
  }
  // Keep the dashboard intentionally short. Every specialist tool still lives
  // in the AdminJS sidebar; these cards are the everyday work queues and the
  // few control areas an admin needs most often.
  const quickLinks = [{
    label: 'Manual Provider Dispatch',
    description: 'View full NIN and Tracking IDs, then route manual ticket requests to a provider',
    href: `${ADMIN_ROOT_PATH$1}/manual-provider-dispatch`,
    icon: 'Send'
  }, {
    label: 'Customers',
    description: 'Users, KYC status & profiles',
    resourceId: 'User',
    icon: 'Users'
  }, {
    label: 'Ledger',
    description: 'Transactions, reversals & history',
    resourceId: 'Transaction',
    icon: 'List'
  }, {
    label: 'All Manual Requests',
    description: 'One queue for every customer and Partner API request awaiting processing',
    href: `${ADMIN_ROOT_PATH$1}/manual-requests`,
    icon: 'List'
  }, {
    label: 'NIN Services',
    description: 'Update or complete many pending NIN requests from one processing list',
    href: `${ADMIN_ROOT_PATH$1}/manual-verifications?group=NIN`,
    icon: 'Fingerprint'
  }, {
    label: 'BVN Services',
    description: 'Update or complete many pending BVN requests from one processing list',
    href: `${ADMIN_ROOT_PATH$1}/manual-verifications?group=BVN`,
    icon: 'CreditCard'
  }, {
    label: 'CAC Services',
    description: 'All CAC registration and verification requests in one queue',
    href: `${ADMIN_ROOT_PATH$1}/manual-requests?group=CAC`,
    icon: 'Briefcase'
  }, {
    label: 'JAMB Services',
    description: 'All paid JAMB document and admission requests in one queue',
    href: `${ADMIN_ROOT_PATH$1}/manual-requests?group=JAMB`,
    icon: 'GraduationCap'
  }, {
    label: 'TIN & Other Services',
    description: 'TIN-ready queue plus Birth Attestation, Newspaper and new manual services',
    href: `${ADMIN_ROOT_PATH$1}/manual-requests?group=TIN_OTHER`,
    icon: 'FileText'
  }, {
    label: 'User Wallet Activity',
    description: 'Look up any customer: funding, spend & recent transactions',
    href: `${ADMIN_ROOT_PATH$1}/user-wallet`,
    icon: 'Search'
  }, {
    label: 'Customer Activity',
    description: 'Top customers, what they bought, and reward candidates',
    href: `${ADMIN_ROOT_PATH$1}/customer-activity`,
    icon: 'Award'
  }, {
    label: 'Login Activity',
    description: 'Latest customer App/Web logins and partner portal access',
    href: `${ADMIN_ROOT_PATH$1}/login-activity`,
    icon: 'LogIn'
  }, {
    label: 'User Deliveries',
    description: 'Upload completed CAC, JAMB or other service files to a customer',
    href: `${ADMIN_ROOT_PATH$1}/user-deliveries`,
    icon: 'Upload'
  }, {
    label: 'Live Chat',
    description: 'Reply to customers in real time (K-Tech Live Chat)',
    href: `${ADMIN_ROOT_PATH$1}/live-chat`,
    icon: 'MessageSquare'
  }, {
    label: 'Service Requests',
    description: 'Open and process customer support requests',
    resourceId: 'SupportTicket',
    icon: 'MessageCircle'
  }, {
    label: 'Request Replies',
    description: 'Send updates to customers while a request is being processed',
    resourceId: 'SupportTicketMessage',
    icon: 'Send'
  }, {
    label: 'Service Pricing',
    description: 'Prices and provider routing for all services',
    resourceId: 'ServicePricing',
    icon: 'Tag'
  }, {
    label: 'Bulk Pricing',
    description: 'Reprice data plans and services in one place',
    href: `${ADMIN_ROOT_PATH$1}/bulk-pricing`,
    icon: 'Sliders'
  }, {
    label: 'NIN/BVN Provider',
    description: 'Choose the provider separately for every NIN/BVN service',
    href: `${ADMIN_ROOT_PATH$1}/nin-bvn-provider`,
    icon: 'Repeat'
  }, {
    label: 'Service Status',
    description: 'Activate or deactivate each NIN/BVN and result-pin service',
    href: `${ADMIN_ROOT_PATH$1}/service-status`,
    icon: 'Power'
  }, {
    label: 'Company Wallet',
    description: 'Revenue, provider cost & net profit by service',
    href: `${ADMIN_ROOT_PATH$1}/company-wallet`,
    icon: 'TrendingUp'
  }, {
    label: 'Provider Ledger',
    description: 'Provider balances, settlements & adjustments',
    href: `${ADMIN_ROOT_PATH$1}/provider-ledger`,
    icon: 'Repeat'
  }, {
    label: 'Provider Reconciliation',
    description: 'Resolve provider transactions still processing',
    href: `${ADMIN_ROOT_PATH$1}/provider-reconciliation`,
    icon: 'AlertTriangle'
  }, {
    label: 'Data Plan Pricing',
    description: 'Set prices for data plans',
    resourceId: 'DataPlanPricing',
    icon: 'ShoppingCart'
  }, {
    label: 'Result PIN Stock',
    description: 'Add prepaid WAEC, NECO and NABTEB PINs',
    href: `${ADMIN_ROOT_PATH$1}/result-pin-stock`,
    icon: 'Package'
  }, {
    label: 'Partner Pricing',
    description: 'Set API-partner-only prices',
    href: `${ADMIN_ROOT_PATH$1}/partner-pricing`,
    icon: 'DollarSign'
  }, {
    label: 'Partner Applications',
    description: 'Review enterprise API applications and approve or reject access',
    href: `${ADMIN_ROOT_PATH$1}/partner-applications?status=PENDING_REVIEW`,
    icon: 'ClipboardCheck'
  }, {
    label: 'Partner Lookup',
    description: 'Check partner wallet, usage and funding',
    href: `${ADMIN_ROOT_PATH$1}/partner-lookup`,
    icon: 'Search'
  }, {
    label: 'Manual Partner Webhook Recovery',
    description: 'Delivery status and retry for resolved manual partner requests',
    href: `${ADMIN_ROOT_PATH$1}/partner-manual-requests/resend`,
    icon: 'Send'
  }, {
    label: 'Coupons',
    description: 'Discount codes & promotions',
    resourceId: 'Coupon',
    icon: 'CreditCard'
  }, {
    label: 'Provider Balance',
    description: 'Alrahuz, BilalSadaSub & Techhub balances',
    resourceId: 'ProviderBalanceStatus',
    icon: 'AlertTriangle'
  }, {
    label: 'Referral Settings',
    description: 'Referral reward configuration',
    resourceId: 'ReferralSettings',
    icon: 'Percent'
  }, {
    label: 'Notifications',
    description: 'Broadcast messages to users',
    resourceId: 'NotificationBroadcast',
    icon: 'Bell'
  }, {
    label: 'Email customers & partners',
    description: 'Send email announcements through Resend',
    href: `${ADMIN_ROOT_PATH$1}/email-composer`,
    icon: 'Send'
  }, {
    label: 'Partners',
    description: 'Review API partner accounts and status',
    resourceId: 'Partner',
    icon: 'Briefcase'
  }, {
    label: 'App Base URL & Updates',
    description: 'Change live app URL, version gate and update message',
    href: `${ADMIN_ROOT_PATH$1}/resources/AppConfig/records/default/edit`,
    icon: 'Settings'
  }, {
    label: 'Admin Users',
    description: 'Admin accounts & roles',
    resourceId: 'AdminUser',
    icon: 'Shield'
  }, {
    label: 'Audit Log',
    description: 'Admin activity history',
    resourceId: 'AdminAuditLog',
    icon: 'FileText'
  }];
  const Dashboard = () => /*#__PURE__*/React__default.default.createElement(designSystem.Box, null, /*#__PURE__*/React__default.default.createElement(PendingRequestsPopup, null), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    position: "relative",
    overflow: "hidden",
    py: ['lg', 'xl', 'xxl'],
    px: ['default', 'lg', 'xxl'],
    style: {
      background: 'linear-gradient(135deg, #0b2f73 0%, #1452a0 100%)'
    }
  }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    display: "flex",
    alignItems: "center",
    flexDirection: ['column', 'row'],
    style: {
      textAlign: 'inherit',
      gap: 16
    }
  }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, null, /*#__PURE__*/React__default.default.createElement("img", {
    src: "/branding/logo.png",
    alt: "K-Tech Solutions",
    style: {
      width: 'clamp(56px, 16vw, 96px)',
      height: 'clamp(56px, 16vw, 96px)',
      borderRadius: 20,
      display: 'block'
    }
  })), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React__default.default.createElement(designSystem.H2, {
    color: "white",
    fontWeight: "bold",
    style: {
      color: '#ffffff',
      fontSize: 'clamp(18px, 5vw, 28px)',
      lineHeight: 1.25
    }
  }, "Welcome to K-Tech Solutions Admin"), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
    color: "white",
    style: {
      opacity: 0.9,
      color: '#ffffff'
    }
  }, "Manage customers, requests, deliveries, transactions and pricing from one place.")))), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    px: ['default', 'lg', 'xxl'],
    py: "xl"
  }, /*#__PURE__*/React__default.default.createElement(designSystem.H4, {
    mb: "lg"
  }, "Quick links"), /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
      gap: 'clamp(10px, 2.5vw, 20px)'
    }
  }, quickLinks.map(link => /*#__PURE__*/React__default.default.createElement("a", {
    key: link.resourceId ?? link.href,
    href: link.href ?? `${ADMIN_ROOT_PATH$1}/resources/${link.resourceId}`,
    style: {
      textDecoration: 'none',
      display: 'block',
      minWidth: 0
    }
  }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    variant: "white",
    boxShadow: "card",
    p: "lg",
    style: {
      cursor: 'pointer',
      height: '100%',
      background: '#0b2f73',
      borderRadius: 12,
      overflowWrap: 'anywhere'
    }
  }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
    display: "flex",
    alignItems: "center",
    mb: "default"
  }, /*#__PURE__*/React__default.default.createElement(designSystem.Icon, {
    icon: link.icon,
    color: "#ffffff",
    bg: "rgba(96, 165, 250, 0.25)",
    rounded: true,
    size: 22,
    p: "default",
    mr: "default"
  }), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
    fontWeight: "bold",
    color: "#ffffff"
  }, link.label)), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
    fontSize: "sm",
    color: "#dbeafe"
  }, link.description)))))));

  const PACKET_TYPES = Object.create(null); // no Map = no polyfill
  PACKET_TYPES["open"] = "0";
  PACKET_TYPES["close"] = "1";
  PACKET_TYPES["ping"] = "2";
  PACKET_TYPES["pong"] = "3";
  PACKET_TYPES["message"] = "4";
  PACKET_TYPES["upgrade"] = "5";
  PACKET_TYPES["noop"] = "6";
  const PACKET_TYPES_REVERSE = Object.create(null);
  Object.keys(PACKET_TYPES).forEach((key) => {
      PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
  });
  const ERROR_PACKET = { type: "error", data: "parser error" };

  const withNativeBlob$1 = typeof Blob === "function" ||
      (typeof Blob !== "undefined" &&
          Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
  const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
  // ArrayBuffer.isView method is not defined in IE10
  const isView$1 = (obj) => {
      return typeof ArrayBuffer.isView === "function"
          ? ArrayBuffer.isView(obj)
          : obj && obj.buffer instanceof ArrayBuffer;
  };
  const encodePacket = ({ type, data }, supportsBinary, callback) => {
      if (withNativeBlob$1 && data instanceof Blob) {
          if (supportsBinary) {
              return callback(data);
          }
          else {
              return encodeBlobAsBase64(data, callback);
          }
      }
      else if (withNativeArrayBuffer$2 &&
          (data instanceof ArrayBuffer || isView$1(data))) {
          if (supportsBinary) {
              return callback(data);
          }
          else {
              return encodeBlobAsBase64(new Blob([data]), callback);
          }
      }
      // plain string
      return callback(PACKET_TYPES[type] + (data || ""));
  };
  const encodeBlobAsBase64 = (data, callback) => {
      const fileReader = new FileReader();
      fileReader.onload = function () {
          const content = fileReader.result.split(",")[1];
          callback("b" + (content || ""));
      };
      return fileReader.readAsDataURL(data);
  };
  function toArray(data) {
      if (data instanceof Uint8Array) {
          return data;
      }
      else if (data instanceof ArrayBuffer) {
          return new Uint8Array(data);
      }
      else {
          return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      }
  }
  let TEXT_ENCODER;
  function encodePacketToBinary(packet, callback) {
      if (withNativeBlob$1 && packet.data instanceof Blob) {
          return packet.data.arrayBuffer().then(toArray).then(callback);
      }
      else if (withNativeArrayBuffer$2 &&
          (packet.data instanceof ArrayBuffer || isView$1(packet.data))) {
          return callback(toArray(packet.data));
      }
      encodePacket(packet, false, (encoded) => {
          if (!TEXT_ENCODER) {
              TEXT_ENCODER = new TextEncoder();
          }
          callback(TEXT_ENCODER.encode(encoded));
      });
  }

  // imported from https://github.com/socketio/base64-arraybuffer
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // Use a lookup table to find the index.
  const lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
      lookup$1[chars.charCodeAt(i)] = i;
  }
  const decode$1 = (base64) => {
      let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
      if (base64[base64.length - 1] === '=') {
          bufferLength--;
          if (base64[base64.length - 2] === '=') {
              bufferLength--;
          }
      }
      const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
      for (i = 0; i < len; i += 4) {
          encoded1 = lookup$1[base64.charCodeAt(i)];
          encoded2 = lookup$1[base64.charCodeAt(i + 1)];
          encoded3 = lookup$1[base64.charCodeAt(i + 2)];
          encoded4 = lookup$1[base64.charCodeAt(i + 3)];
          bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
          bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
          bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
      }
      return arraybuffer;
  };

  const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
  const decodePacket = (encodedPacket, binaryType) => {
      if (typeof encodedPacket !== "string") {
          return {
              type: "message",
              data: mapBinary(encodedPacket, binaryType),
          };
      }
      const type = encodedPacket.charAt(0);
      if (type === "b") {
          return {
              type: "message",
              data: decodeBase64Packet(encodedPacket.substring(1), binaryType),
          };
      }
      const packetType = PACKET_TYPES_REVERSE[type];
      if (!packetType) {
          return ERROR_PACKET;
      }
      return encodedPacket.length > 1
          ? {
              type: PACKET_TYPES_REVERSE[type],
              data: encodedPacket.substring(1),
          }
          : {
              type: PACKET_TYPES_REVERSE[type],
          };
  };
  const decodeBase64Packet = (data, binaryType) => {
      if (withNativeArrayBuffer$1) {
          const decoded = decode$1(data);
          return mapBinary(decoded, binaryType);
      }
      else {
          return { base64: true, data }; // fallback for old browsers
      }
  };
  const mapBinary = (data, binaryType) => {
      switch (binaryType) {
          case "blob":
              if (data instanceof Blob) {
                  // from WebSocket + binaryType "blob"
                  return data;
              }
              else {
                  // from HTTP long-polling or WebTransport
                  return new Blob([data]);
              }
          case "arraybuffer":
          default:
              if (data instanceof ArrayBuffer) {
                  // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer"
                  return data;
              }
              else {
                  // from WebTransport (Uint8Array)
                  return data.buffer;
              }
      }
  };

  const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
  const encodePayload = (packets, callback) => {
      // some packets may be added to the array while encoding, so the initial length must be saved
      const length = packets.length;
      const encodedPackets = new Array(length);
      let count = 0;
      packets.forEach((packet, i) => {
          // force base64 encoding for binary packets
          encodePacket(packet, false, (encodedPacket) => {
              encodedPackets[i] = encodedPacket;
              if (++count === length) {
                  callback(encodedPackets.join(SEPARATOR));
              }
          });
      });
  };
  const decodePayload = (encodedPayload, binaryType) => {
      const encodedPackets = encodedPayload.split(SEPARATOR);
      const packets = [];
      for (let i = 0; i < encodedPackets.length; i++) {
          const decodedPacket = decodePacket(encodedPackets[i], binaryType);
          packets.push(decodedPacket);
          if (decodedPacket.type === "error") {
              break;
          }
      }
      return packets;
  };
  function createPacketEncoderStream() {
      return new TransformStream({
          transform(packet, controller) {
              encodePacketToBinary(packet, (encodedPacket) => {
                  const payloadLength = encodedPacket.length;
                  let header;
                  // inspired by the WebSocket format: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#decoding_payload_length
                  if (payloadLength < 126) {
                      header = new Uint8Array(1);
                      new DataView(header.buffer).setUint8(0, payloadLength);
                  }
                  else if (payloadLength < 65536) {
                      header = new Uint8Array(3);
                      const view = new DataView(header.buffer);
                      view.setUint8(0, 126);
                      view.setUint16(1, payloadLength);
                  }
                  else {
                      header = new Uint8Array(9);
                      const view = new DataView(header.buffer);
                      view.setUint8(0, 127);
                      view.setBigUint64(1, BigInt(payloadLength));
                  }
                  // first bit indicates whether the payload is plain text (0) or binary (1)
                  if (packet.data && typeof packet.data !== "string") {
                      header[0] |= 0x80;
                  }
                  controller.enqueue(header);
                  controller.enqueue(encodedPacket);
              });
          },
      });
  }
  let TEXT_DECODER;
  function totalLength(chunks) {
      return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
  function concatChunks(chunks, size) {
      if (chunks[0].length === size) {
          return chunks.shift();
      }
      const buffer = new Uint8Array(size);
      let j = 0;
      for (let i = 0; i < size; i++) {
          buffer[i] = chunks[0][j++];
          if (j === chunks[0].length) {
              chunks.shift();
              j = 0;
          }
      }
      if (chunks.length && j < chunks[0].length) {
          chunks[0] = chunks[0].slice(j);
      }
      return buffer;
  }
  function createPacketDecoderStream(maxPayload, binaryType) {
      if (!TEXT_DECODER) {
          TEXT_DECODER = new TextDecoder();
      }
      const chunks = [];
      let state = 0 /* State.READ_HEADER */;
      let expectedLength = -1;
      let isBinary = false;
      return new TransformStream({
          transform(chunk, controller) {
              chunks.push(chunk);
              while (true) {
                  if (state === 0 /* State.READ_HEADER */) {
                      if (totalLength(chunks) < 1) {
                          break;
                      }
                      const header = concatChunks(chunks, 1);
                      isBinary = (header[0] & 0x80) === 0x80;
                      expectedLength = header[0] & 0x7f;
                      if (expectedLength < 126) {
                          state = 3 /* State.READ_PAYLOAD */;
                      }
                      else if (expectedLength === 126) {
                          state = 1 /* State.READ_EXTENDED_LENGTH_16 */;
                      }
                      else {
                          state = 2 /* State.READ_EXTENDED_LENGTH_64 */;
                      }
                  }
                  else if (state === 1 /* State.READ_EXTENDED_LENGTH_16 */) {
                      if (totalLength(chunks) < 2) {
                          break;
                      }
                      const headerArray = concatChunks(chunks, 2);
                      expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
                      state = 3 /* State.READ_PAYLOAD */;
                  }
                  else if (state === 2 /* State.READ_EXTENDED_LENGTH_64 */) {
                      if (totalLength(chunks) < 8) {
                          break;
                      }
                      const headerArray = concatChunks(chunks, 8);
                      const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
                      const n = view.getUint32(0);
                      if (n > Math.pow(2, 53 - 32) - 1) {
                          // the maximum safe integer in JavaScript is 2^53 - 1
                          controller.enqueue(ERROR_PACKET);
                          break;
                      }
                      expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
                      state = 3 /* State.READ_PAYLOAD */;
                  }
                  else {
                      if (totalLength(chunks) < expectedLength) {
                          break;
                      }
                      const data = concatChunks(chunks, expectedLength);
                      controller.enqueue(decodePacket(isBinary ? data : TEXT_DECODER.decode(data), binaryType));
                      state = 0 /* State.READ_HEADER */;
                  }
                  if (expectedLength === 0 || expectedLength > maxPayload) {
                      controller.enqueue(ERROR_PACKET);
                      break;
                  }
              }
          },
      });
  }
  const protocol = 4;

  /**
   * Expose `Emitter`.
   */

  var Emitter_1 = Emitter;

  /**
   * Initialize a new `Emitter`.
   *
   * @api public
   */

  function Emitter(obj) {
    if (obj) return mixin(obj);
  }

  /**
   * Mixin the emitter properties.
   *
   * @param {Object} obj
   * @return {Object}
   * @api private
   */

  function mixin(obj) {
    for (var key in Emitter.prototype) {
      obj[key] = Emitter.prototype[key];
    }
    return obj;
  }

  /**
   * Listen on the given `event` with `fn`.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter.prototype.on =
  Emitter.prototype.addEventListener = function(event, fn){
    this._callbacks = this._callbacks || {};
    (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
      .push(fn);
    return this;
  };

  /**
   * Adds an `event` listener that will be invoked a single
   * time then automatically removed.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter.prototype.once = function(event, fn){
    function on() {
      this.off(event, on);
      fn.apply(this, arguments);
    }

    on.fn = fn;
    this.on(event, on);
    return this;
  };

  /**
   * Remove the given callback for `event` or all
   * registered callbacks.
   *
   * @param {String} event
   * @param {Function} fn
   * @return {Emitter}
   * @api public
   */

  Emitter.prototype.off =
  Emitter.prototype.removeListener =
  Emitter.prototype.removeAllListeners =
  Emitter.prototype.removeEventListener = function(event, fn){
    this._callbacks = this._callbacks || {};

    // all
    if (0 == arguments.length) {
      this._callbacks = {};
      return this;
    }

    // specific event
    var callbacks = this._callbacks['$' + event];
    if (!callbacks) return this;

    // remove all handlers
    if (1 == arguments.length) {
      delete this._callbacks['$' + event];
      return this;
    }

    // remove specific handler
    var cb;
    for (var i = 0; i < callbacks.length; i++) {
      cb = callbacks[i];
      if (cb === fn || cb.fn === fn) {
        callbacks.splice(i, 1);
        break;
      }
    }

    // Remove event specific arrays for event types that no
    // one is subscribed for to avoid memory leak.
    if (callbacks.length === 0) {
      delete this._callbacks['$' + event];
    }

    return this;
  };

  /**
   * Emit `event` with the given args.
   *
   * @param {String} event
   * @param {Mixed} ...
   * @return {Emitter}
   */

  Emitter.prototype.emit = function(event){
    this._callbacks = this._callbacks || {};

    var args = new Array(arguments.length - 1)
      , callbacks = this._callbacks['$' + event];

    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }

    if (callbacks) {
      callbacks = callbacks.slice(0);
      for (var i = 0, len = callbacks.length; i < len; ++i) {
        callbacks[i].apply(this, args);
      }
    }

    return this;
  };

  // alias used for reserved events (protected method)
  Emitter.prototype.emitReserved = Emitter.prototype.emit;

  /**
   * Return array of callbacks for `event`.
   *
   * @param {String} event
   * @return {Array}
   * @api public
   */

  Emitter.prototype.listeners = function(event){
    this._callbacks = this._callbacks || {};
    return this._callbacks['$' + event] || [];
  };

  /**
   * Check if this emitter has `event` handlers.
   *
   * @param {String} event
   * @return {Boolean}
   * @api public
   */

  Emitter.prototype.hasListeners = function(event){
    return !! this.listeners(event).length;
  };

  const nextTick = (() => {
      const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
      if (isPromiseAvailable) {
          return (cb) => Promise.resolve().then(cb);
      }
      else {
          return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
      }
  })();
  const globalThisShim = (() => {
      if (typeof self !== "undefined") {
          return self;
      }
      else if (typeof window !== "undefined") {
          return window;
      }
      else {
          return Function("return this")();
      }
  })();
  const defaultBinaryType = "arraybuffer";
  function createCookieJar() { }

  function pick(obj, ...attr) {
      return attr.reduce((acc, k) => {
          if (obj.hasOwnProperty(k)) {
              acc[k] = obj[k];
          }
          return acc;
      }, {});
  }
  // Keep a reference to the real timeout functions so they can be used when overridden
  const NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
  const NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
  function installTimerFunctions(obj, opts) {
      if (opts.useNativeTimers) {
          obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
          obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
      }
      else {
          obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
          obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
      }
  }
  // base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
  const BASE64_OVERHEAD = 1.33;
  // we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
  function byteLength(obj) {
      if (typeof obj === "string") {
          return utf8Length(obj);
      }
      // arraybuffer or blob
      return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
  }
  function utf8Length(str) {
      let c = 0, length = 0;
      for (let i = 0, l = str.length; i < l; i++) {
          c = str.charCodeAt(i);
          if (c < 0x80) {
              length += 1;
          }
          else if (c < 0x800) {
              length += 2;
          }
          else if (c < 0xd800 || c >= 0xe000) {
              length += 3;
          }
          else {
              i++;
              length += 4;
          }
      }
      return length;
  }
  /**
   * Generates a random 8-characters string.
   */
  function randomString() {
      return (Date.now().toString(36).substring(3) +
          Math.random().toString(36).substring(2, 5));
  }

  // imported from https://github.com/galkn/querystring
  /**
   * Compiles a querystring
   * Returns string representation of the object
   *
   * @param {Object}
   * @api private
   */
  function encode(obj) {
      let str = '';
      for (let i in obj) {
          if (obj.hasOwnProperty(i)) {
              if (str.length)
                  str += '&';
              str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
          }
      }
      return str;
  }
  /**
   * Parses a simple querystring into an object
   *
   * @param {String} qs
   * @api private
   */
  function decode(qs) {
      let qry = {};
      let pairs = qs.split('&');
      for (let i = 0, l = pairs.length; i < l; i++) {
          let pair = pairs[i].split('=');
          qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
      }
      return qry;
  }

  class TransportError extends Error {
      constructor(reason, description, context) {
          super(reason);
          this.description = description;
          this.context = context;
          this.type = "TransportError";
      }
  }
  class Transport extends Emitter_1 {
      /**
       * Transport abstract constructor.
       *
       * @param {Object} opts - options
       * @protected
       */
      constructor(opts) {
          super();
          this.writable = false;
          installTimerFunctions(this, opts);
          this.opts = opts;
          this.query = opts.query;
          this.socket = opts.socket;
          this.supportsBinary = !opts.forceBase64;
      }
      /**
       * Emits an error.
       *
       * @param {String} reason
       * @param description
       * @param context - the error context
       * @return {Transport} for chaining
       * @protected
       */
      onError(reason, description, context) {
          super.emitReserved("error", new TransportError(reason, description, context));
          return this;
      }
      /**
       * Opens the transport.
       */
      open() {
          this.readyState = "opening";
          this.doOpen();
          return this;
      }
      /**
       * Closes the transport.
       */
      close() {
          if (this.readyState === "opening" || this.readyState === "open") {
              this.doClose();
              this.onClose();
          }
          return this;
      }
      /**
       * Sends multiple packets.
       *
       * @param {Array} packets
       */
      send(packets) {
          if (this.readyState === "open") {
              this.write(packets);
          }
      }
      /**
       * Called upon open
       *
       * @protected
       */
      onOpen() {
          this.readyState = "open";
          this.writable = true;
          super.emitReserved("open");
      }
      /**
       * Called with data.
       *
       * @param {String} data
       * @protected
       */
      onData(data) {
          const packet = decodePacket(data, this.socket.binaryType);
          this.onPacket(packet);
      }
      /**
       * Called with a decoded packet.
       *
       * @protected
       */
      onPacket(packet) {
          super.emitReserved("packet", packet);
      }
      /**
       * Called upon close.
       *
       * @protected
       */
      onClose(details) {
          this.readyState = "closed";
          super.emitReserved("close", details);
      }
      /**
       * Pauses the transport, in order not to lose packets during an upgrade.
       *
       * @param onPause
       */
      pause(onPause) { }
      createUri(schema, query = {}) {
          return (schema +
              "://" +
              this._hostname() +
              this._port() +
              this.opts.path +
              this._query(query));
      }
      _hostname() {
          const hostname = this.opts.hostname;
          return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
      }
      _port() {
          if (this.opts.port &&
              ((this.opts.secure && Number(this.opts.port) !== 443) ||
                  (!this.opts.secure && Number(this.opts.port) !== 80))) {
              return ":" + this.opts.port;
          }
          else {
              return "";
          }
      }
      _query(query) {
          const encodedQuery = encode(query);
          return encodedQuery.length ? "?" + encodedQuery : "";
      }
  }

  class Polling extends Transport {
      constructor() {
          super(...arguments);
          this._polling = false;
      }
      get name() {
          return "polling";
      }
      /**
       * Opens the socket (triggers polling). We write a PING message to determine
       * when the transport is open.
       *
       * @protected
       */
      doOpen() {
          this._poll();
      }
      /**
       * Pauses polling.
       *
       * @param {Function} onPause - callback upon buffers are flushed and transport is paused
       * @package
       */
      pause(onPause) {
          this.readyState = "pausing";
          const pause = () => {
              this.readyState = "paused";
              onPause();
          };
          if (this._polling || !this.writable) {
              let total = 0;
              if (this._polling) {
                  total++;
                  this.once("pollComplete", function () {
                      --total || pause();
                  });
              }
              if (!this.writable) {
                  total++;
                  this.once("drain", function () {
                      --total || pause();
                  });
              }
          }
          else {
              pause();
          }
      }
      /**
       * Starts polling cycle.
       *
       * @private
       */
      _poll() {
          this._polling = true;
          this.doPoll();
          this.emitReserved("poll");
      }
      /**
       * Overloads onData to detect payloads.
       *
       * @protected
       */
      onData(data) {
          const callback = (packet) => {
              // if its the first message we consider the transport open
              if ("opening" === this.readyState && packet.type === "open") {
                  this.onOpen();
              }
              // if its a close packet, we close the ongoing requests
              if ("close" === packet.type) {
                  this.onClose({ description: "transport closed by the server" });
                  return false;
              }
              // otherwise bypass onData and handle the message
              this.onPacket(packet);
          };
          // decode payload
          decodePayload(data, this.socket.binaryType).forEach(callback);
          // if an event did not trigger closing
          if ("closed" !== this.readyState) {
              // if we got data we're not polling
              this._polling = false;
              this.emitReserved("pollComplete");
              if ("open" === this.readyState) {
                  this._poll();
              }
          }
      }
      /**
       * For polling, send a close packet.
       *
       * @protected
       */
      doClose() {
          const close = () => {
              this.write([{ type: "close" }]);
          };
          if ("open" === this.readyState) {
              close();
          }
          else {
              // in case we're trying to close while
              // handshaking is in progress (GH-164)
              this.once("open", close);
          }
      }
      /**
       * Writes a packets payload.
       *
       * @param {Array} packets - data packets
       * @protected
       */
      write(packets) {
          this.writable = false;
          encodePayload(packets, (data) => {
              this.doWrite(data, () => {
                  this.writable = true;
                  this.emitReserved("drain");
              });
          });
      }
      /**
       * Generates uri for connection.
       *
       * @private
       */
      uri() {
          const schema = this.opts.secure ? "https" : "http";
          const query = this.query || {};
          // cache busting is forced
          if (false !== this.opts.timestampRequests) {
              query[this.opts.timestampParam] = randomString();
          }
          if (!this.supportsBinary && !query.sid) {
              query.b64 = 1;
          }
          return this.createUri(schema, query);
      }
  }

  // imported from https://github.com/component/has-cors
  let value = false;
  try {
      value = typeof XMLHttpRequest !== 'undefined' &&
          'withCredentials' in new XMLHttpRequest();
  }
  catch (err) {
      // if XMLHttp support is disabled in IE then it will throw
      // when trying to create
  }
  const hasCORS = value;

  function empty() { }
  class BaseXHR extends Polling {
      /**
       * XHR Polling constructor.
       *
       * @param {Object} opts
       * @package
       */
      constructor(opts) {
          super(opts);
          if (typeof location !== "undefined") {
              const isSSL = "https:" === location.protocol;
              let port = location.port;
              // some user agents have empty `location.port`
              if (!port) {
                  port = isSSL ? "443" : "80";
              }
              this.xd =
                  (typeof location !== "undefined" &&
                      opts.hostname !== location.hostname) ||
                      port !== opts.port;
          }
      }
      /**
       * Sends data.
       *
       * @param {String} data - data to send.
       * @param {Function} fn - called upon flush.
       * @private
       */
      doWrite(data, fn) {
          const req = this.request({
              method: "POST",
              data: data,
          });
          req.on("success", fn);
          req.on("error", (xhrStatus, context) => {
              this.onError("xhr post error", xhrStatus, context);
          });
      }
      /**
       * Starts a poll cycle.
       *
       * @private
       */
      doPoll() {
          const req = this.request();
          req.on("data", this.onData.bind(this));
          req.on("error", (xhrStatus, context) => {
              this.onError("xhr poll error", xhrStatus, context);
          });
          this.pollXhr = req;
      }
  }
  class Request extends Emitter_1 {
      /**
       * Request constructor
       *
       * @param {Object} options
       * @package
       */
      constructor(createRequest, uri, opts) {
          super();
          this.createRequest = createRequest;
          installTimerFunctions(this, opts);
          this._opts = opts;
          this._method = opts.method || "GET";
          this._uri = uri;
          this._data = undefined !== opts.data ? opts.data : null;
          this._create();
      }
      /**
       * Creates the XHR object and sends the request.
       *
       * @private
       */
      _create() {
          var _a;
          const opts = pick(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
          opts.xdomain = !!this._opts.xd;
          const xhr = (this._xhr = this.createRequest(opts));
          try {
              xhr.open(this._method, this._uri, true);
              try {
                  if (this._opts.extraHeaders) {
                      // @ts-ignore
                      xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                      for (let i in this._opts.extraHeaders) {
                          if (this._opts.extraHeaders.hasOwnProperty(i)) {
                              xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
                          }
                      }
                  }
              }
              catch (e) { }
              if ("POST" === this._method) {
                  try {
                      xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                  }
                  catch (e) { }
              }
              try {
                  xhr.setRequestHeader("Accept", "*/*");
              }
              catch (e) { }
              (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
              // ie6 check
              if ("withCredentials" in xhr) {
                  xhr.withCredentials = this._opts.withCredentials;
              }
              if (this._opts.requestTimeout) {
                  xhr.timeout = this._opts.requestTimeout;
              }
              xhr.onreadystatechange = () => {
                  var _a;
                  if (xhr.readyState === 3) {
                      (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.parseCookies(
                      // @ts-ignore
                      xhr.getResponseHeader("set-cookie"));
                  }
                  if (4 !== xhr.readyState)
                      return;
                  if (200 === xhr.status || 1223 === xhr.status) {
                      this._onLoad();
                  }
                  else {
                      // make sure the `error` event handler that's user-set
                      // does not throw in the same tick and gets caught here
                      this.setTimeoutFn(() => {
                          this._onError(typeof xhr.status === "number" ? xhr.status : 0);
                      }, 0);
                  }
              };
              xhr.send(this._data);
          }
          catch (e) {
              // Need to defer since .create() is called directly from the constructor
              // and thus the 'error' event can only be only bound *after* this exception
              // occurs.  Therefore, also, we cannot throw here at all.
              this.setTimeoutFn(() => {
                  this._onError(e);
              }, 0);
              return;
          }
          if (typeof document !== "undefined") {
              this._index = Request.requestsCount++;
              Request.requests[this._index] = this;
          }
      }
      /**
       * Called upon error.
       *
       * @private
       */
      _onError(err) {
          this.emitReserved("error", err, this._xhr);
          this._cleanup(true);
      }
      /**
       * Cleans up house.
       *
       * @private
       */
      _cleanup(fromError) {
          if ("undefined" === typeof this._xhr || null === this._xhr) {
              return;
          }
          this._xhr.onreadystatechange = empty;
          if (fromError) {
              try {
                  this._xhr.abort();
              }
              catch (e) { }
          }
          if (typeof document !== "undefined") {
              delete Request.requests[this._index];
          }
          this._xhr = null;
      }
      /**
       * Called upon load.
       *
       * @private
       */
      _onLoad() {
          const data = this._xhr.responseText;
          if (data !== null) {
              this.emitReserved("data", data);
              this.emitReserved("success");
              this._cleanup();
          }
      }
      /**
       * Aborts the request.
       *
       * @package
       */
      abort() {
          this._cleanup();
      }
  }
  Request.requestsCount = 0;
  Request.requests = {};
  /**
   * Aborts pending requests when unloading the window. This is needed to prevent
   * memory leaks (e.g. when using IE) and to ensure that no spurious error is
   * emitted.
   */
  if (typeof document !== "undefined") {
      // @ts-ignore
      if (typeof attachEvent === "function") {
          // @ts-ignore
          attachEvent("onunload", unloadHandler);
      }
      else if (typeof addEventListener === "function") {
          const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
          addEventListener(terminationEvent, unloadHandler, false);
      }
  }
  function unloadHandler() {
      for (let i in Request.requests) {
          if (Request.requests.hasOwnProperty(i)) {
              Request.requests[i].abort();
          }
      }
  }
  const hasXHR2 = (function () {
      const xhr = newRequest({
          xdomain: false,
      });
      return xhr && xhr.responseType !== null;
  })();
  /**
   * HTTP long-polling based on the built-in `XMLHttpRequest` object.
   *
   * Usage: browser
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
   */
  class XHR extends BaseXHR {
      constructor(opts) {
          super(opts);
          const forceBase64 = opts && opts.forceBase64;
          this.supportsBinary = hasXHR2 && !forceBase64;
      }
      request(opts = {}) {
          Object.assign(opts, { xd: this.xd }, this.opts);
          return new Request(newRequest, this.uri(), opts);
      }
  }
  function newRequest(opts) {
      const xdomain = opts.xdomain;
      // XMLHttpRequest can be disabled on IE
      try {
          if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
              return new XMLHttpRequest();
          }
      }
      catch (e) { }
      if (!xdomain) {
          try {
              return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
          }
          catch (e) { }
      }
  }

  // detect ReactNative environment
  const isReactNative = typeof navigator !== "undefined" &&
      typeof navigator.product === "string" &&
      navigator.product.toLowerCase() === "reactnative";
  class BaseWS extends Transport {
      get name() {
          return "websocket";
      }
      doOpen() {
          const uri = this.uri();
          const protocols = this.opts.protocols;
          // React Native only supports the 'headers' option, and will print a warning if anything else is passed
          const opts = isReactNative
              ? {}
              : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
          if (this.opts.extraHeaders) {
              opts.headers = this.opts.extraHeaders;
          }
          try {
              this.ws = this.createSocket(uri, protocols, opts);
          }
          catch (err) {
              return this.emitReserved("error", err);
          }
          this.ws.binaryType = this.socket.binaryType;
          this.addEventListeners();
      }
      /**
       * Adds event listeners to the socket
       *
       * @private
       */
      addEventListeners() {
          this.ws.onopen = () => {
              if (this.opts.autoUnref) {
                  this.ws._socket.unref();
              }
              this.onOpen();
          };
          this.ws.onclose = (closeEvent) => this.onClose({
              description: "websocket connection closed",
              context: closeEvent,
          });
          this.ws.onmessage = (ev) => this.onData(ev.data);
          this.ws.onerror = (e) => this.onError("websocket error", e);
      }
      write(packets) {
          this.writable = false;
          // encodePacket efficient as it uses WS framing
          // no need for encodePayload
          for (let i = 0; i < packets.length; i++) {
              const packet = packets[i];
              const lastPacket = i === packets.length - 1;
              encodePacket(packet, this.supportsBinary, (data) => {
                  // Sometimes the websocket has already been closed but the browser didn't
                  // have a chance of informing us about it yet, in that case send will
                  // throw an error
                  try {
                      this.doWrite(packet, data);
                  }
                  catch (e) {
                  }
                  if (lastPacket) {
                      // fake drain
                      // defer to next tick to allow Socket to clear writeBuffer
                      nextTick(() => {
                          this.writable = true;
                          this.emitReserved("drain");
                      }, this.setTimeoutFn);
                  }
              });
          }
      }
      doClose() {
          if (typeof this.ws !== "undefined") {
              this.ws.onerror = () => { };
              this.ws.close();
              this.ws = null;
          }
      }
      /**
       * Generates uri for connection.
       *
       * @private
       */
      uri() {
          const schema = this.opts.secure ? "wss" : "ws";
          const query = this.query || {};
          // append timestamp to URI
          if (this.opts.timestampRequests) {
              query[this.opts.timestampParam] = randomString();
          }
          // communicate binary support capabilities
          if (!this.supportsBinary) {
              query.b64 = 1;
          }
          return this.createUri(schema, query);
      }
  }
  const WebSocketCtor = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
  /**
   * WebSocket transport based on the built-in `WebSocket` object.
   *
   * Usage: browser, Node.js (since v21), Deno, Bun
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
   * @see https://caniuse.com/mdn-api_websocket
   * @see https://nodejs.org/api/globals.html#websocket
   */
  class WS extends BaseWS {
      createSocket(uri, protocols, opts) {
          return !isReactNative
              ? protocols
                  ? new WebSocketCtor(uri, protocols)
                  : new WebSocketCtor(uri)
              : new WebSocketCtor(uri, protocols, opts);
      }
      doWrite(_packet, data) {
          this.ws.send(data);
      }
  }

  /**
   * WebTransport transport based on the built-in `WebTransport` object.
   *
   * Usage: browser, Node.js (with the `@fails-components/webtransport` package)
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
   * @see https://caniuse.com/webtransport
   */
  class WT extends Transport {
      get name() {
          return "webtransport";
      }
      doOpen() {
          try {
              // @ts-ignore
              this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
          }
          catch (err) {
              return this.emitReserved("error", err);
          }
          this._transport.closed
              .then(() => {
              this.onClose();
          })
              .catch((err) => {
              this.onError("webtransport error", err);
          });
          // note: we could have used async/await, but that would require some additional polyfills
          this._transport.ready.then(() => {
              this._transport.createBidirectionalStream().then((stream) => {
                  const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
                  const reader = stream.readable.pipeThrough(decoderStream).getReader();
                  const encoderStream = createPacketEncoderStream();
                  encoderStream.readable.pipeTo(stream.writable);
                  this._writer = encoderStream.writable.getWriter();
                  const read = () => {
                      reader
                          .read()
                          .then(({ done, value }) => {
                          if (done) {
                              return;
                          }
                          this.onPacket(value);
                          read();
                      })
                          .catch((err) => {
                      });
                  };
                  read();
                  const packet = { type: "open" };
                  if (this.query.sid) {
                      packet.data = `{"sid":"${this.query.sid}"}`;
                  }
                  this._writer.write(packet).then(() => this.onOpen());
              });
          });
      }
      write(packets) {
          this.writable = false;
          for (let i = 0; i < packets.length; i++) {
              const packet = packets[i];
              const lastPacket = i === packets.length - 1;
              this._writer.write(packet).then(() => {
                  if (lastPacket) {
                      nextTick(() => {
                          this.writable = true;
                          this.emitReserved("drain");
                      }, this.setTimeoutFn);
                  }
              });
          }
      }
      doClose() {
          var _a;
          (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
      }
  }

  const transports = {
      websocket: WS,
      webtransport: WT,
      polling: XHR,
  };

  // imported from https://github.com/galkn/parseuri
  /**
   * Parses a URI
   *
   * Note: we could also have used the built-in URL object, but it isn't supported on all platforms.
   *
   * See:
   * - https://developer.mozilla.org/en-US/docs/Web/API/URL
   * - https://caniuse.com/url
   * - https://www.rfc-editor.org/rfc/rfc3986#appendix-B
   *
   * History of the parse() method:
   * - first commit: https://github.com/socketio/socket.io-client/commit/4ee1d5d94b3906a9c052b459f1a818b15f38f91c
   * - export into its own module: https://github.com/socketio/engine.io-client/commit/de2c561e4564efeb78f1bdb1ba39ef81b2822cb3
   * - reimport: https://github.com/socketio/engine.io-client/commit/df32277c3f6d622eec5ed09f493cae3f3391d242
   *
   * @author Steven Levithan <stevenlevithan.com> (MIT license)
   * @api private
   */
  const re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
  const parts = [
      'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
  ];
  function parse(str) {
      if (str.length > 8000) {
          throw "URI too long";
      }
      const src = str, b = str.indexOf('['), e = str.indexOf(']');
      if (b != -1 && e != -1) {
          str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
      }
      let m = re.exec(str || ''), uri = {}, i = 14;
      while (i--) {
          uri[parts[i]] = m[i] || '';
      }
      if (b != -1 && e != -1) {
          uri.source = src;
          uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
          uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
          uri.ipv6uri = true;
      }
      uri.pathNames = pathNames(uri, uri['path']);
      uri.queryKey = queryKey(uri, uri['query']);
      return uri;
  }
  function pathNames(obj, path) {
      const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
      if (path.slice(0, 1) == '/' || path.length === 0) {
          names.splice(0, 1);
      }
      if (path.slice(-1) == '/') {
          names.splice(names.length - 1, 1);
      }
      return names;
  }
  function queryKey(uri, query) {
      const data = {};
      query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
          if ($1) {
              data[$1] = $2;
          }
      });
      return data;
  }

  const withEventListeners = typeof addEventListener === "function" &&
      typeof removeEventListener === "function";
  const OFFLINE_EVENT_LISTENERS = [];
  if (withEventListeners) {
      // within a ServiceWorker, any event handler for the 'offline' event must be added on the initial evaluation of the
      // script, so we create one single event listener here which will forward the event to the socket instances
      addEventListener("offline", () => {
          OFFLINE_EVENT_LISTENERS.forEach((listener) => listener());
      }, false);
  }
  /**
   * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
   * with one of the available low-level transports, like HTTP long-polling, WebSocket, or WebTransport.
   *
   * This class comes with an upgrade mechanism, which means that once the connection is established with the first
   * low-level transport, it will try to upgrade to a better transport.
   *
   * @example
   * import { Socket } from "engine.io-client";
   *
   * const socket = new Socket();
   *
   * socket.on("open", () => {
   *   socket.send("hello");
   * });
   *
   */
  let Socket$1 = class Socket extends Emitter_1 {
      constructor(uri, opts = {}) {
          var _a, _b;
          super();
          this.binaryType = defaultBinaryType;
          this.writeBuffer = [];
          this._prevBufferLen = 0;
          this._upgrades = [];
          this._pingInterval = -1;
          this._pingTimeout = -1;
          this._maxPayload = -1;
          /**
           * The expiration timestamp of the {@link _pingTimeoutTimer} object is tracked, in case the timer is throttled and the
           * callback is not fired on time. This can happen for example when a laptop is suspended or when a phone is locked.
           */
          this._pingTimeoutTime = Infinity;
          if (uri && "object" === typeof uri) {
              opts = uri;
              uri = null;
          }
          if (uri) {
              const parsedUri = parse(uri);
              opts.hostname = parsedUri.host;
              opts.secure =
                  parsedUri.protocol === "https" || parsedUri.protocol === "wss";
              opts.port = parsedUri.port;
              if (parsedUri.query)
                  opts.query = parsedUri.query;
          }
          else if (opts.host) {
              opts.hostname = parse(opts.host).host;
          }
          installTimerFunctions(this, opts);
          this.secure =
              null != opts.secure
                  ? opts.secure
                  : typeof location !== "undefined" && "https:" === location.protocol;
          if (opts.hostname && !opts.port) {
              // if no port is specified manually, use the protocol default
              opts.port = this.secure ? "443" : "80";
          }
          this.hostname =
              opts.hostname ||
                  (typeof location !== "undefined" ? location.hostname : "localhost");
          this.port =
              opts.port ||
                  (typeof location !== "undefined" && location.port
                      ? location.port
                      : this.secure
                          ? "443"
                          : "80");
          if (opts.transportImplementations && opts.transports) {
              throw new Error("specifying both 'transportImplementations' and 'transports' options is not supported");
          }
          if (opts.transportImplementations ||
              (((_a = opts.transports) === null || _a === void 0 ? void 0 : _a.length) && typeof opts.transports[0] === "function")) {
              // 'transports' option as an array of transport implementations is kept for backward compatibility
              this.transports = [];
              this._transportsByName = Object.create(null);
              ((_b = opts.transportImplementations) !== null && _b !== void 0 ? _b : opts.transports).forEach((t) => {
                  const transportName = t.prototype.name;
                  this.transports.push(transportName);
                  this._transportsByName[transportName] = t;
              });
          }
          else {
              this.transports = opts.transports
                  ? [...opts.transports]
                  : ["polling", "websocket", "webtransport"];
              this._transportsByName = transports;
          }
          this.opts = Object.assign({
              path: "/engine.io",
              agent: false,
              withCredentials: false,
              upgrade: true,
              timestampParam: "t",
              rememberUpgrade: false,
              addTrailingSlash: true,
              rejectUnauthorized: true,
              perMessageDeflate: {
                  threshold: 1024,
              },
              transportOptions: {},
              closeOnBeforeunload: false,
          }, opts);
          this.opts.path =
              this.opts.path.replace(/\/$/, "") +
                  (this.opts.addTrailingSlash ? "/" : "");
          if (typeof this.opts.query === "string") {
              this.opts.query = decode(this.opts.query);
          }
          if (withEventListeners) {
              if (this.opts.closeOnBeforeunload) {
                  // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                  // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                  // closed/reloaded)
                  this._beforeunloadEventListener = () => {
                      if (this.transport) {
                          // silently close the transport
                          this.transport.removeAllListeners();
                          this.transport.close();
                      }
                  };
                  addEventListener("beforeunload", this._beforeunloadEventListener, false);
              }
              if (this.hostname !== "localhost") {
                  this._offlineEventListener = () => {
                      this._onClose("transport close", {
                          description: "network connection lost",
                      });
                  };
                  OFFLINE_EVENT_LISTENERS.push(this._offlineEventListener);
              }
          }
          if (this.opts.withCredentials) {
              this._cookieJar = createCookieJar();
          }
          this._open();
      }
      /**
       * Creates transport of the given type.
       *
       * @param {String} name - transport name
       * @return {Transport}
       * @private
       */
      createTransport(name) {
          const query = Object.assign({}, this.opts.query);
          // append engine.io protocol identifier
          query.EIO = protocol;
          // transport name
          query.transport = name;
          // session id if we already have one
          if (this.id)
              query.sid = this.id;
          const opts = Object.assign({}, this.opts, {
              query,
              socket: this,
              hostname: this.hostname,
              secure: this.secure,
              port: this.port,
          }, this.opts.transportOptions[name]);
          return new this._transportsByName[name](opts);
      }
      /**
       * Initializes transport to use and starts probe.
       *
       * @private
       */
      _open() {
          if (this.transports.length === 0) {
              // Emit error on next tick so it can be listened to
              this.setTimeoutFn(() => {
                  this.emitReserved("error", "No transports available");
              }, 0);
              return;
          }
          const transportName = this.opts.rememberUpgrade &&
              Socket.priorWebsocketSuccess &&
              this.transports.indexOf("websocket") !== -1
              ? "websocket"
              : this.transports[0];
          this.readyState = "opening";
          const transport = this.createTransport(transportName);
          transport.open();
          this.setTransport(transport);
      }
      /**
       * Sets the current transport. Disables the existing one (if any).
       *
       * @private
       */
      setTransport(transport) {
          if (this.transport) {
              this.transport.removeAllListeners();
          }
          // set up transport
          this.transport = transport;
          // set up transport listeners
          transport
              .on("drain", this._onDrain.bind(this))
              .on("packet", this._onPacket.bind(this))
              .on("error", this._onError.bind(this))
              .on("close", (reason) => this._onClose("transport close", reason));
      }
      /**
       * Probes a transport.
       *
       * @param {String} name - transport name
       * @private
       */
      _probe(name) {
          let transport = this.createTransport(name);
          let failed = false;
          Socket.priorWebsocketSuccess = false;
          const onTransportOpen = () => {
              if (failed)
                  return;
              transport.send([{ type: "ping", data: "probe" }]);
              transport.once("packet", (msg) => {
                  if (failed)
                      return;
                  if ("pong" === msg.type && "probe" === msg.data) {
                      this.upgrading = true;
                      this.emitReserved("upgrading", transport);
                      if (!transport)
                          return;
                      Socket.priorWebsocketSuccess = "websocket" === transport.name;
                      this.transport.pause(() => {
                          if (failed)
                              return;
                          if ("closed" === this.readyState)
                              return;
                          cleanup();
                          this.setTransport(transport);
                          transport.send([{ type: "upgrade" }]);
                          this.emitReserved("upgrade", transport);
                          transport = null;
                          this.upgrading = false;
                          this.flush();
                      });
                  }
                  else {
                      const err = new Error("probe error");
                      // @ts-ignore
                      err.transport = transport.name;
                      this.emitReserved("upgradeError", err);
                  }
              });
          };
          function freezeTransport() {
              if (failed)
                  return;
              // Any callback called by transport should be ignored since now
              failed = true;
              cleanup();
              transport.close();
              transport = null;
          }
          // Handle any error that happens while probing
          const onerror = (err) => {
              const error = new Error("probe error: " + err);
              // @ts-ignore
              error.transport = transport.name;
              freezeTransport();
              this.emitReserved("upgradeError", error);
          };
          function onTransportClose() {
              onerror("transport closed");
          }
          // When the socket is closed while we're probing
          function onclose() {
              onerror("socket closed");
          }
          // When the socket is upgraded while we're probing
          function onupgrade(to) {
              if (transport && to.name !== transport.name) {
                  freezeTransport();
              }
          }
          // Remove all listeners on the transport and on self
          const cleanup = () => {
              transport.removeListener("open", onTransportOpen);
              transport.removeListener("error", onerror);
              transport.removeListener("close", onTransportClose);
              this.off("close", onclose);
              this.off("upgrading", onupgrade);
          };
          transport.once("open", onTransportOpen);
          transport.once("error", onerror);
          transport.once("close", onTransportClose);
          this.once("close", onclose);
          this.once("upgrading", onupgrade);
          if (this._upgrades.indexOf("webtransport") !== -1 &&
              name !== "webtransport") {
              // favor WebTransport
              this.setTimeoutFn(() => {
                  if (!failed) {
                      transport.open();
                  }
              }, 200);
          }
          else {
              transport.open();
          }
      }
      /**
       * Called when connection is deemed open.
       *
       * @private
       */
      onOpen() {
          this.readyState = "open";
          Socket.priorWebsocketSuccess = "websocket" === this.transport.name;
          this.emitReserved("open");
          this.flush();
          if ("open" === this.readyState && this.opts.upgrade) {
              for (let i = 0; i < this._upgrades.length; i++) {
                  this._probe(this._upgrades[i]);
              }
          }
      }
      /**
       * Handles a packet.
       *
       * @private
       */
      _onPacket(packet) {
          if ("opening" === this.readyState ||
              "open" === this.readyState ||
              "closing" === this.readyState) {
              this.emitReserved("packet", packet);
              // Socket is live - any packet counts
              this.emitReserved("heartbeat");
              switch (packet.type) {
                  case "open":
                      this.onHandshake(JSON.parse(packet.data));
                      break;
                  case "ping":
                      this._sendPacket("pong");
                      this.emitReserved("ping");
                      this.emitReserved("pong");
                      this._resetPingTimeout();
                      break;
                  case "error":
                      const err = new Error("server error");
                      // @ts-ignore
                      err.code = packet.data;
                      this._onError(err);
                      break;
                  case "message":
                      this.emitReserved("data", packet.data);
                      this.emitReserved("message", packet.data);
                      break;
              }
          }
      }
      /**
       * Called upon handshake completion.
       *
       * @param {Object} data - handshake obj
       * @private
       */
      onHandshake(data) {
          this.emitReserved("handshake", data);
          this.id = data.sid;
          this.transport.query.sid = data.sid;
          this._upgrades = this._filterUpgrades(data.upgrades);
          this._pingInterval = data.pingInterval;
          this._pingTimeout = data.pingTimeout;
          this._maxPayload = data.maxPayload;
          this.onOpen();
          // In case open handler closes socket
          if ("closed" === this.readyState)
              return;
          this._resetPingTimeout();
      }
      /**
       * Sets and resets ping timeout timer based on server pings.
       *
       * @private
       */
      _resetPingTimeout() {
          this.clearTimeoutFn(this._pingTimeoutTimer);
          const delay = this._pingInterval + this._pingTimeout;
          this._pingTimeoutTime = Date.now() + delay;
          this._pingTimeoutTimer = this.setTimeoutFn(() => {
              this._onClose("ping timeout");
          }, delay);
          if (this.opts.autoUnref) {
              this._pingTimeoutTimer.unref();
          }
      }
      /**
       * Called on `drain` event
       *
       * @private
       */
      _onDrain() {
          this.writeBuffer.splice(0, this._prevBufferLen);
          // setting prevBufferLen = 0 is very important
          // for example, when upgrading, upgrade packet is sent over,
          // and a nonzero prevBufferLen could cause problems on `drain`
          this._prevBufferLen = 0;
          if (0 === this.writeBuffer.length) {
              this.emitReserved("drain");
          }
          else {
              this.flush();
          }
      }
      /**
       * Flush write buffers.
       *
       * @private
       */
      flush() {
          if ("closed" !== this.readyState &&
              this.transport.writable &&
              !this.upgrading &&
              this.writeBuffer.length) {
              const packets = this._getWritablePackets();
              this.transport.send(packets);
              // keep track of current length of writeBuffer
              // splice writeBuffer and callbackBuffer on `drain`
              this._prevBufferLen = packets.length;
              this.emitReserved("flush");
          }
      }
      /**
       * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
       * long-polling)
       *
       * @private
       */
      _getWritablePackets() {
          const shouldCheckPayloadSize = this._maxPayload &&
              this.transport.name === "polling" &&
              this.writeBuffer.length > 1;
          if (!shouldCheckPayloadSize) {
              return this.writeBuffer;
          }
          let payloadSize = 1; // first packet type
          for (let i = 0; i < this.writeBuffer.length; i++) {
              const data = this.writeBuffer[i].data;
              if (data) {
                  payloadSize += byteLength(data);
              }
              if (i > 0 && payloadSize > this._maxPayload) {
                  return this.writeBuffer.slice(0, i);
              }
              payloadSize += 2; // separator + packet type
          }
          return this.writeBuffer;
      }
      /**
       * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
       *
       * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
       * `write()` method then the message would not be buffered by the Socket.IO client.
       *
       * @return {boolean}
       * @private
       */
      /* private */ _hasPingExpired() {
          if (!this._pingTimeoutTime)
              return true;
          const hasExpired = Date.now() > this._pingTimeoutTime;
          if (hasExpired) {
              this._pingTimeoutTime = 0;
              nextTick(() => {
                  this._onClose("ping timeout");
              }, this.setTimeoutFn);
          }
          return hasExpired;
      }
      /**
       * Sends a message.
       *
       * @param {String} msg - message.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @return {Socket} for chaining.
       */
      write(msg, options, fn) {
          this._sendPacket("message", msg, options, fn);
          return this;
      }
      /**
       * Sends a message. Alias of {@link Socket#write}.
       *
       * @param {String} msg - message.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @return {Socket} for chaining.
       */
      send(msg, options, fn) {
          this._sendPacket("message", msg, options, fn);
          return this;
      }
      /**
       * Sends a packet.
       *
       * @param {String} type - packet type.
       * @param {String} data.
       * @param {Object} options.
       * @param {Function} fn - callback function.
       * @private
       */
      _sendPacket(type, data, options, fn) {
          if ("function" === typeof data) {
              fn = data;
              data = undefined;
          }
          if ("function" === typeof options) {
              fn = options;
              options = null;
          }
          if ("closing" === this.readyState || "closed" === this.readyState) {
              return;
          }
          options = options || {};
          options.compress = false !== options.compress;
          const packet = {
              type: type,
              data: data,
              options: options,
          };
          this.emitReserved("packetCreate", packet);
          this.writeBuffer.push(packet);
          if (fn)
              this.once("flush", fn);
          this.flush();
      }
      /**
       * Closes the connection.
       */
      close() {
          const close = () => {
              this._onClose("forced close");
              this.transport.close();
          };
          const cleanupAndClose = () => {
              this.off("upgrade", cleanupAndClose);
              this.off("upgradeError", cleanupAndClose);
              close();
          };
          const waitForUpgrade = () => {
              // wait for upgrade to finish since we can't send packets while pausing a transport
              this.once("upgrade", cleanupAndClose);
              this.once("upgradeError", cleanupAndClose);
          };
          if ("opening" === this.readyState || "open" === this.readyState) {
              this.readyState = "closing";
              if (this.writeBuffer.length) {
                  this.once("drain", () => {
                      if (this.upgrading) {
                          waitForUpgrade();
                      }
                      else {
                          close();
                      }
                  });
              }
              else if (this.upgrading) {
                  waitForUpgrade();
              }
              else {
                  close();
              }
          }
          return this;
      }
      /**
       * Called upon transport error
       *
       * @private
       */
      _onError(err) {
          Socket.priorWebsocketSuccess = false;
          if (this.opts.tryAllTransports &&
              this.transports.length > 1 &&
              this.readyState === "opening") {
              this.transports.shift();
              return this._open();
          }
          this.emitReserved("error", err);
          this._onClose("transport error", err);
      }
      /**
       * Called upon transport close.
       *
       * @private
       */
      _onClose(reason, description) {
          if ("opening" === this.readyState ||
              "open" === this.readyState ||
              "closing" === this.readyState) {
              // clear timers
              this.clearTimeoutFn(this._pingTimeoutTimer);
              // stop event from firing again for transport
              this.transport.removeAllListeners("close");
              // ensure transport won't stay open
              this.transport.close();
              // ignore further transport communication
              this.transport.removeAllListeners();
              if (withEventListeners) {
                  if (this._beforeunloadEventListener) {
                      removeEventListener("beforeunload", this._beforeunloadEventListener, false);
                  }
                  if (this._offlineEventListener) {
                      const i = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
                      if (i !== -1) {
                          OFFLINE_EVENT_LISTENERS.splice(i, 1);
                      }
                  }
              }
              // set ready state
              this.readyState = "closed";
              // clear session id
              this.id = null;
              // emit close event
              this.emitReserved("close", reason, description);
              // clean buffers after, so users can still
              // grab the buffers on `close` event
              this.writeBuffer = [];
              this._prevBufferLen = 0;
          }
      }
      /**
       * Filters upgrades, returning only those matching client transports.
       *
       * @param {Array} upgrades - server upgrades
       * @private
       */
      _filterUpgrades(upgrades) {
          const filteredUpgrades = [];
          for (let i = 0; i < upgrades.length; i++) {
              if (~this.transports.indexOf(upgrades[i]))
                  filteredUpgrades.push(upgrades[i]);
          }
          return filteredUpgrades;
      }
  };
  Socket$1.protocol = protocol;

  Socket$1.protocol;

  /**
   * URL parser.
   *
   * @param uri - url
   * @param path - the request path of the connection
   * @param loc - An object meant to mimic window.location.
   *        Defaults to window.location.
   * @public
   */
  function url(uri, path = "", loc) {
      let obj = uri;
      // default to window.location
      loc = loc || (typeof location !== "undefined" && location);
      if (null == uri)
          uri = loc.protocol + "//" + loc.host;
      // relative path support
      if (typeof uri === "string") {
          if ("/" === uri.charAt(0)) {
              if ("/" === uri.charAt(1)) {
                  uri = loc.protocol + uri;
              }
              else {
                  uri = loc.host + uri;
              }
          }
          if (!/^(https?|wss?):\/\//.test(uri)) {
              if ("undefined" !== typeof loc) {
                  uri = loc.protocol + "//" + uri;
              }
              else {
                  uri = "https://" + uri;
              }
          }
          // parse
          obj = parse(uri);
      }
      // make sure we treat `localhost:80` and `localhost` equally
      if (!obj.port) {
          if (/^(http|ws)$/.test(obj.protocol)) {
              obj.port = "80";
          }
          else if (/^(http|ws)s$/.test(obj.protocol)) {
              obj.port = "443";
          }
      }
      obj.path = obj.path || "/";
      const ipv6 = obj.host.indexOf(":") !== -1;
      const host = ipv6 ? "[" + obj.host + "]" : obj.host;
      // define unique id
      obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
      // define href
      obj.href =
          obj.protocol +
              "://" +
              host +
              (loc && loc.port === obj.port ? "" : ":" + obj.port);
      return obj;
  }

  const withNativeArrayBuffer = typeof ArrayBuffer === "function";
  const isView = (obj) => {
      return typeof ArrayBuffer.isView === "function"
          ? ArrayBuffer.isView(obj)
          : obj.buffer instanceof ArrayBuffer;
  };
  const toString = Object.prototype.toString;
  const withNativeBlob = typeof Blob === "function" ||
      (typeof Blob !== "undefined" &&
          toString.call(Blob) === "[object BlobConstructor]");
  const withNativeFile = typeof File === "function" ||
      (typeof File !== "undefined" &&
          toString.call(File) === "[object FileConstructor]");
  /**
   * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
   *
   * @private
   */
  function isBinary(obj) {
      return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
          (withNativeBlob && obj instanceof Blob) ||
          (withNativeFile && obj instanceof File));
  }
  function hasBinary(obj, toJSON) {
      if (!obj || typeof obj !== "object") {
          return false;
      }
      if (Array.isArray(obj)) {
          for (let i = 0, l = obj.length; i < l; i++) {
              if (hasBinary(obj[i])) {
                  return true;
              }
          }
          return false;
      }
      if (isBinary(obj)) {
          return true;
      }
      if (obj.toJSON &&
          typeof obj.toJSON === "function" &&
          arguments.length === 1) {
          return hasBinary(obj.toJSON(), true);
      }
      for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
              return true;
          }
      }
      return false;
  }

  /**
   * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
   *
   * @param {Object} packet - socket.io event packet
   * @return {Object} with deconstructed packet and list of buffers
   * @public
   */
  function deconstructPacket(packet) {
      const buffers = [];
      const packetData = packet.data;
      const pack = packet;
      pack.data = _deconstructPacket(packetData, buffers);
      pack.attachments = buffers.length; // number of binary 'attachments'
      return { packet: pack, buffers: buffers };
  }
  function _deconstructPacket(data, buffers, toJSON) {
      if (!data)
          return data;
      if (isBinary(data)) {
          const placeholder = { _placeholder: true, num: buffers.length };
          buffers.push(data);
          return placeholder;
      }
      else if (Array.isArray(data)) {
          const newData = new Array(data.length);
          for (let i = 0; i < data.length; i++) {
              newData[i] = _deconstructPacket(data[i], buffers);
          }
          return newData;
      }
      else if (typeof data === "object" && !(data instanceof Date)) {
          if (data.toJSON && typeof data.toJSON === "function" && !toJSON) {
              return _deconstructPacket(data.toJSON(), buffers, true);
          }
          const newData = {};
          for (const key in data) {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                  newData[key] = _deconstructPacket(data[key], buffers);
              }
          }
          return newData;
      }
      return data;
  }
  /**
   * Reconstructs a binary packet from its placeholder packet and buffers
   *
   * @param {Object} packet - event packet with placeholders
   * @param {Array} buffers - binary buffers to put in placeholder positions
   * @return {Object} reconstructed packet
   * @public
   */
  function reconstructPacket(packet, buffers) {
      packet.data = _reconstructPacket(packet.data, buffers);
      delete packet.attachments; // no longer useful
      return packet;
  }
  function _reconstructPacket(data, buffers) {
      if (!data)
          return data;
      if (data && data._placeholder === true) {
          const isIndexValid = typeof data.num === "number" &&
              data.num >= 0 &&
              data.num < buffers.length;
          if (isIndexValid) {
              return buffers[data.num]; // appropriate buffer (should be natural order anyway)
          }
          else {
              throw new Error("illegal attachments");
          }
      }
      else if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
              data[i] = _reconstructPacket(data[i], buffers);
          }
      }
      else if (typeof data === "object") {
          for (const key in data) {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                  data[key] = _reconstructPacket(data[key], buffers);
              }
          }
      }
      return data;
  }

  /**
   * These strings must not be used as event names, as they have a special meaning.
   */
  const RESERVED_EVENTS$1 = [
      "connect", // used on the client side
      "connect_error", // used on the client side
      "disconnect", // used on both sides
      "disconnecting", // used on the server side
      "newListener", // used by the Node.js EventEmitter
      "removeListener", // used by the Node.js EventEmitter
  ];
  var PacketType;
  (function (PacketType) {
      PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
      PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
      PacketType[PacketType["EVENT"] = 2] = "EVENT";
      PacketType[PacketType["ACK"] = 3] = "ACK";
      PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
      PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
      PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
  })(PacketType || (PacketType = {}));
  /**
   * A socket.io Encoder instance
   */
  class Encoder {
      /**
       * Encoder constructor
       *
       * @param {function} replacer - custom replacer to pass down to JSON.parse
       */
      constructor(replacer) {
          this.replacer = replacer;
      }
      /**
       * Encode a packet as a single string if non-binary, or as a
       * buffer sequence, depending on packet type.
       *
       * @param {Object} obj - packet object
       */
      encode(obj) {
          if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
              if (hasBinary(obj)) {
                  return this.encodeAsBinary({
                      type: obj.type === PacketType.EVENT
                          ? PacketType.BINARY_EVENT
                          : PacketType.BINARY_ACK,
                      nsp: obj.nsp,
                      data: obj.data,
                      id: obj.id,
                  });
              }
          }
          return [this.encodeAsString(obj)];
      }
      /**
       * Encode packet as string.
       */
      encodeAsString(obj) {
          // first is type
          let str = "" + obj.type;
          // attachments if we have them
          if (obj.type === PacketType.BINARY_EVENT ||
              obj.type === PacketType.BINARY_ACK) {
              str += obj.attachments + "-";
          }
          // if we have a namespace other than `/`
          // we append it followed by a comma `,`
          if (obj.nsp && "/" !== obj.nsp) {
              str += obj.nsp + ",";
          }
          // immediately followed by the id
          if (null != obj.id) {
              str += obj.id;
          }
          // json data
          if (null != obj.data) {
              str += JSON.stringify(obj.data, this.replacer);
          }
          return str;
      }
      /**
       * Encode packet as 'buffer sequence' by removing blobs, and
       * deconstructing packet into object with placeholders and
       * a list of buffers.
       */
      encodeAsBinary(obj) {
          const deconstruction = deconstructPacket(obj);
          const pack = this.encodeAsString(deconstruction.packet);
          const buffers = deconstruction.buffers;
          buffers.unshift(pack); // add packet info to beginning of data list
          return buffers; // write all the buffers
      }
  }
  /**
   * A socket.io Decoder instance
   *
   * @return {Object} decoder
   */
  class Decoder extends Emitter_1 {
      /**
       * Decoder constructor
       */
      constructor(opts) {
          super();
          this.opts = Object.assign({
              reviver: undefined,
              maxAttachments: 10,
          }, typeof opts === "function" ? { reviver: opts } : opts);
      }
      /**
       * Decodes an encoded packet string into packet JSON.
       *
       * @param {String} obj - encoded packet
       */
      add(obj) {
          let packet;
          if (typeof obj === "string") {
              if (this.reconstructor) {
                  throw new Error("got plaintext data when reconstructing a packet");
              }
              packet = this.decodeString(obj);
              const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
              if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
                  packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
                  // binary packet's json
                  this.reconstructor = new BinaryReconstructor(packet);
              }
              else {
                  // non-binary full packet
                  super.emitReserved("decoded", packet);
              }
          }
          else if (isBinary(obj) || obj.base64) {
              // raw binary data
              if (!this.reconstructor) {
                  throw new Error("got binary data when not reconstructing a packet");
              }
              else {
                  packet = this.reconstructor.takeBinaryData(obj);
                  if (packet) {
                      // received final buffer
                      this.reconstructor = null;
                      super.emitReserved("decoded", packet);
                  }
              }
          }
          else {
              throw new Error("Unknown type: " + obj);
          }
      }
      /**
       * Decode a packet String (JSON data)
       *
       * @param {String} str
       * @return {Object} packet
       */
      decodeString(str) {
          let i = 0;
          // look up type
          const p = {
              type: Number(str.charAt(0)),
          };
          if (PacketType[p.type] === undefined) {
              throw new Error("unknown packet type " + p.type);
          }
          // look up attachments if type binary
          if (p.type === PacketType.BINARY_EVENT ||
              p.type === PacketType.BINARY_ACK) {
              const start = i + 1;
              while (str.charAt(++i) !== "-" && i != str.length) { }
              const buf = str.substring(start, i);
              if (buf != Number(buf) || str.charAt(i) !== "-") {
                  throw new Error("Illegal attachments");
              }
              const n = Number(buf);
              if (!isInteger(n) || n < 1) {
                  throw new Error("Illegal attachments");
              }
              else if (n > this.opts.maxAttachments) {
                  throw new Error("too many attachments");
              }
              p.attachments = n;
          }
          // look up namespace (if any)
          if ("/" === str.charAt(i + 1)) {
              const start = i + 1;
              while (++i) {
                  const c = str.charAt(i);
                  if ("," === c)
                      break;
                  if (i === str.length)
                      break;
              }
              p.nsp = str.substring(start, i);
          }
          else {
              p.nsp = "/";
          }
          // look up id
          const next = str.charAt(i + 1);
          if ("" !== next && Number(next) == next) {
              const start = i + 1;
              while (++i) {
                  const c = str.charAt(i);
                  if (null == c || Number(c) != c) {
                      --i;
                      break;
                  }
                  if (i === str.length)
                      break;
              }
              p.id = Number(str.substring(start, i + 1));
          }
          // look up json data
          if (str.charAt(++i)) {
              const payload = this.tryParse(str.substr(i));
              if (Decoder.isPayloadValid(p.type, payload)) {
                  p.data = payload;
              }
              else {
                  throw new Error("invalid payload");
              }
          }
          return p;
      }
      tryParse(str) {
          try {
              return JSON.parse(str, this.opts.reviver);
          }
          catch (e) {
              return false;
          }
      }
      static isPayloadValid(type, payload) {
          switch (type) {
              case PacketType.CONNECT:
                  return isObject(payload);
              case PacketType.DISCONNECT:
                  return payload === undefined;
              case PacketType.CONNECT_ERROR:
                  return typeof payload === "string" || isObject(payload);
              case PacketType.EVENT:
              case PacketType.BINARY_EVENT:
                  return (Array.isArray(payload) &&
                      (typeof payload[0] === "number" ||
                          (typeof payload[0] === "string" &&
                              RESERVED_EVENTS$1.indexOf(payload[0]) === -1)));
              case PacketType.ACK:
              case PacketType.BINARY_ACK:
                  return Array.isArray(payload);
          }
      }
      /**
       * Deallocates a parser's resources
       */
      destroy() {
          if (this.reconstructor) {
              this.reconstructor.finishedReconstruction();
              this.reconstructor = null;
          }
      }
  }
  /**
   * A manager of a binary event's 'buffer sequence'. Should
   * be constructed whenever a packet of type BINARY_EVENT is
   * decoded.
   *
   * @param {Object} packet
   * @return {BinaryReconstructor} initialized reconstructor
   */
  class BinaryReconstructor {
      constructor(packet) {
          this.packet = packet;
          this.buffers = [];
          this.reconPack = packet;
      }
      /**
       * Method to be called when binary data received from connection
       * after a BINARY_EVENT packet.
       *
       * @param {Buffer | ArrayBuffer} binData - the raw binary data received
       * @return {null | Object} returns null if more binary data is expected or
       *   a reconstructed packet object if all buffers have been received.
       */
      takeBinaryData(binData) {
          this.buffers.push(binData);
          if (this.buffers.length === this.reconPack.attachments) {
              // done with buffer list
              const packet = reconstructPacket(this.reconPack, this.buffers);
              this.finishedReconstruction();
              return packet;
          }
          return null;
      }
      /**
       * Cleans up binary packet reconstruction variables.
       */
      finishedReconstruction() {
          this.reconPack = null;
          this.buffers = [];
      }
  }
  // see https://caniuse.com/mdn-javascript_builtins_number_isinteger
  const isInteger = Number.isInteger ||
      function (value) {
          return (typeof value === "number" &&
              isFinite(value) &&
              Math.floor(value) === value);
      };
  // see https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript
  function isObject(value) {
      return Object.prototype.toString.call(value) === "[object Object]";
  }

  var parser = /*#__PURE__*/Object.freeze({
    __proto__: null,
    Decoder: Decoder,
    Encoder: Encoder,
    get PacketType () { return PacketType; }
  });

  function on(obj, ev, fn) {
      obj.on(ev, fn);
      return function subDestroy() {
          obj.off(ev, fn);
      };
  }

  /**
   * Internal events.
   * These events can't be emitted by the user.
   */
  const RESERVED_EVENTS = Object.freeze({
      connect: 1,
      connect_error: 1,
      disconnect: 1,
      disconnecting: 1,
      // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
      newListener: 1,
      removeListener: 1,
  });
  /**
   * A Socket is the fundamental class for interacting with the server.
   *
   * A Socket belongs to a certain Namespace (by default /) and uses an underlying {@link Manager} to communicate.
   *
   * @example
   * const socket = io();
   *
   * socket.on("connect", () => {
   *   console.log("connected");
   * });
   *
   * // send an event to the server
   * socket.emit("foo", "bar");
   *
   * socket.on("foobar", () => {
   *   // an event was received from the server
   * });
   *
   * // upon disconnection
   * socket.on("disconnect", (reason) => {
   *   console.log(`disconnected due to ${reason}`);
   * });
   */
  class Socket extends Emitter_1 {
      /**
       * `Socket` constructor.
       */
      constructor(io, nsp, opts) {
          super();
          /**
           * Whether the socket is currently connected to the server.
           *
           * @example
           * const socket = io();
           *
           * socket.on("connect", () => {
           *   console.log(socket.connected); // true
           * });
           *
           * socket.on("disconnect", () => {
           *   console.log(socket.connected); // false
           * });
           */
          this.connected = false;
          /**
           * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
           * be transmitted by the server.
           */
          this.recovered = false;
          /**
           * Buffer for packets received before the CONNECT packet
           */
          this.receiveBuffer = [];
          /**
           * Buffer for packets that will be sent once the socket is connected
           */
          this.sendBuffer = [];
          /**
           * The queue of packets to be sent with retry in case of failure.
           *
           * Packets are sent one by one, each waiting for the server acknowledgement, in order to guarantee the delivery order.
           * @private
           */
          this._queue = [];
          /**
           * A sequence to generate the ID of the {@link QueuedPacket}.
           * @private
           */
          this._queueSeq = 0;
          this.ids = 0;
          /**
           * A map containing acknowledgement handlers.
           *
           * The `withError` attribute is used to differentiate handlers that accept an error as first argument:
           *
           * - `socket.emit("test", (err, value) => { ... })` with `ackTimeout` option
           * - `socket.timeout(5000).emit("test", (err, value) => { ... })`
           * - `const value = await socket.emitWithAck("test")`
           *
           * From those that don't:
           *
           * - `socket.emit("test", (value) => { ... });`
           *
           * In the first case, the handlers will be called with an error when:
           *
           * - the timeout is reached
           * - the socket gets disconnected
           *
           * In the second case, the handlers will be simply discarded upon disconnection, since the client will never receive
           * an acknowledgement from the server.
           *
           * @private
           */
          this.acks = {};
          this.flags = {};
          this.io = io;
          this.nsp = nsp;
          if (opts && opts.auth) {
              this.auth = opts.auth;
          }
          this._opts = Object.assign({}, opts);
          if (this.io._autoConnect)
              this.open();
      }
      /**
       * Whether the socket is currently disconnected
       *
       * @example
       * const socket = io();
       *
       * socket.on("connect", () => {
       *   console.log(socket.disconnected); // false
       * });
       *
       * socket.on("disconnect", () => {
       *   console.log(socket.disconnected); // true
       * });
       */
      get disconnected() {
          return !this.connected;
      }
      /**
       * Subscribe to open, close and packet events
       *
       * @private
       */
      subEvents() {
          if (this.subs)
              return;
          const io = this.io;
          this.subs = [
              on(io, "open", this.onopen.bind(this)),
              on(io, "packet", this.onpacket.bind(this)),
              on(io, "error", this.onerror.bind(this)),
              on(io, "close", this.onclose.bind(this)),
          ];
      }
      /**
       * Whether the Socket will try to reconnect when its Manager connects or reconnects.
       *
       * @example
       * const socket = io();
       *
       * console.log(socket.active); // true
       *
       * socket.on("disconnect", (reason) => {
       *   if (reason === "io server disconnect") {
       *     // the disconnection was initiated by the server, you need to manually reconnect
       *     console.log(socket.active); // false
       *   }
       *   // else the socket will automatically try to reconnect
       *   console.log(socket.active); // true
       * });
       */
      get active() {
          return !!this.subs;
      }
      /**
       * "Opens" the socket.
       *
       * @example
       * const socket = io({
       *   autoConnect: false
       * });
       *
       * socket.connect();
       */
      connect() {
          if (this.connected)
              return this;
          this.subEvents();
          if (!this.io["_reconnecting"])
              this.io.open(); // ensure open
          if ("open" === this.io._readyState)
              this.onopen();
          return this;
      }
      /**
       * Alias for {@link connect()}.
       */
      open() {
          return this.connect();
      }
      /**
       * Sends a `message` event.
       *
       * This method mimics the WebSocket.send() method.
       *
       * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
       *
       * @example
       * socket.send("hello");
       *
       * // this is equivalent to
       * socket.emit("message", "hello");
       *
       * @return self
       */
      send(...args) {
          args.unshift("message");
          this.emit.apply(this, args);
          return this;
      }
      /**
       * Override `emit`.
       * If the event is in `events`, it's emitted normally.
       *
       * @example
       * socket.emit("hello", "world");
       *
       * // all serializable datastructures are supported (no need to call JSON.stringify)
       * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
       *
       * // with an acknowledgement from the server
       * socket.emit("hello", "world", (val) => {
       *   // ...
       * });
       *
       * @return self
       */
      emit(ev, ...args) {
          var _a, _b, _c;
          if (RESERVED_EVENTS.hasOwnProperty(ev)) {
              throw new Error('"' + ev.toString() + '" is a reserved event name');
          }
          args.unshift(ev);
          if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
              this._addToQueue(args);
              return this;
          }
          const packet = {
              type: PacketType.EVENT,
              data: args,
          };
          packet.options = {};
          packet.options.compress = this.flags.compress !== false;
          // event ack callback
          if ("function" === typeof args[args.length - 1]) {
              const id = this.ids++;
              const ack = args.pop();
              this._registerAckCallback(id, ack);
              packet.id = id;
          }
          const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
          const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
          const discardPacket = this.flags.volatile && !isTransportWritable;
          if (discardPacket) ;
          else if (isConnected) {
              this.notifyOutgoingListeners(packet);
              this.packet(packet);
          }
          else {
              this.sendBuffer.push(packet);
          }
          this.flags = {};
          return this;
      }
      /**
       * @private
       */
      _registerAckCallback(id, ack) {
          var _a;
          const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
          if (timeout === undefined) {
              this.acks[id] = ack;
              return;
          }
          // @ts-ignore
          const timer = this.io.setTimeoutFn(() => {
              delete this.acks[id];
              for (let i = 0; i < this.sendBuffer.length; i++) {
                  if (this.sendBuffer[i].id === id) {
                      this.sendBuffer.splice(i, 1);
                  }
              }
              ack.call(this, new Error("operation has timed out"));
          }, timeout);
          const fn = (...args) => {
              // @ts-ignore
              this.io.clearTimeoutFn(timer);
              ack.apply(this, args);
          };
          fn.withError = true;
          this.acks[id] = fn;
      }
      /**
       * Emits an event and waits for an acknowledgement
       *
       * @example
       * // without timeout
       * const response = await socket.emitWithAck("hello", "world");
       *
       * // with a specific timeout
       * try {
       *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
       * } catch (err) {
       *   // the server did not acknowledge the event in the given delay
       * }
       *
       * @return a Promise that will be fulfilled when the server acknowledges the event
       */
      emitWithAck(ev, ...args) {
          return new Promise((resolve, reject) => {
              const fn = (arg1, arg2) => {
                  return arg1 ? reject(arg1) : resolve(arg2);
              };
              fn.withError = true;
              args.push(fn);
              this.emit(ev, ...args);
          });
      }
      /**
       * Add the packet to the queue.
       * @param args
       * @private
       */
      _addToQueue(args) {
          let ack;
          if (typeof args[args.length - 1] === "function") {
              ack = args.pop();
          }
          const packet = {
              id: this._queueSeq++,
              tryCount: 0,
              pending: false,
              args,
              flags: Object.assign({ fromQueue: true }, this.flags),
          };
          args.push((err, ...responseArgs) => {
              if (packet !== this._queue[0]) ;
              const hasError = err !== null;
              if (hasError) {
                  if (packet.tryCount > this._opts.retries) {
                      this._queue.shift();
                      if (ack) {
                          ack(err);
                      }
                  }
              }
              else {
                  this._queue.shift();
                  if (ack) {
                      ack(null, ...responseArgs);
                  }
              }
              packet.pending = false;
              return this._drainQueue();
          });
          this._queue.push(packet);
          this._drainQueue();
      }
      /**
       * Send the first packet of the queue, and wait for an acknowledgement from the server.
       * @param force - whether to resend a packet that has not been acknowledged yet
       *
       * @private
       */
      _drainQueue(force = false) {
          if (!this.connected || this._queue.length === 0) {
              return;
          }
          const packet = this._queue[0];
          if (packet.pending && !force) {
              return;
          }
          packet.pending = true;
          packet.tryCount++;
          this.flags = packet.flags;
          this.emit.apply(this, packet.args);
      }
      /**
       * Sends a packet.
       *
       * @param packet
       * @private
       */
      packet(packet) {
          packet.nsp = this.nsp;
          this.io._packet(packet);
      }
      /**
       * Called upon engine `open`.
       *
       * @private
       */
      onopen() {
          if (typeof this.auth == "function") {
              this.auth((data) => {
                  this._sendConnectPacket(data);
              });
          }
          else {
              this._sendConnectPacket(this.auth);
          }
      }
      /**
       * Sends a CONNECT packet to initiate the Socket.IO session.
       *
       * @param data
       * @private
       */
      _sendConnectPacket(data) {
          this.packet({
              type: PacketType.CONNECT,
              data: this._pid
                  ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data)
                  : data,
          });
      }
      /**
       * Called upon engine or manager `error`.
       *
       * @param err
       * @private
       */
      onerror(err) {
          if (!this.connected) {
              this.emitReserved("connect_error", err);
          }
      }
      /**
       * Called upon engine `close`.
       *
       * @param reason
       * @param description
       * @private
       */
      onclose(reason, description) {
          this.connected = false;
          delete this.id;
          this.emitReserved("disconnect", reason, description);
          this._clearAcks();
      }
      /**
       * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
       * the server.
       *
       * @private
       */
      _clearAcks() {
          Object.keys(this.acks).forEach((id) => {
              const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
              if (!isBuffered) {
                  // note: handlers that do not accept an error as first argument are ignored here
                  const ack = this.acks[id];
                  delete this.acks[id];
                  if (ack.withError) {
                      ack.call(this, new Error("socket has been disconnected"));
                  }
              }
          });
      }
      /**
       * Called with socket packet.
       *
       * @param packet
       * @private
       */
      onpacket(packet) {
          const sameNamespace = packet.nsp === this.nsp;
          if (!sameNamespace)
              return;
          switch (packet.type) {
              case PacketType.CONNECT:
                  if (packet.data && packet.data.sid) {
                      this.onconnect(packet.data.sid, packet.data.pid);
                  }
                  else {
                      this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                  }
                  break;
              case PacketType.EVENT:
              case PacketType.BINARY_EVENT:
                  this.onevent(packet);
                  break;
              case PacketType.ACK:
              case PacketType.BINARY_ACK:
                  this.onack(packet);
                  break;
              case PacketType.DISCONNECT:
                  this.ondisconnect();
                  break;
              case PacketType.CONNECT_ERROR:
                  this.destroy();
                  const err = new Error(packet.data.message);
                  err.data = packet.data.data;
                  this.emitReserved("connect_error", err);
                  break;
          }
      }
      /**
       * Called upon a server event.
       *
       * @param packet
       * @private
       */
      onevent(packet) {
          const args = packet.data || [];
          if (null != packet.id) {
              args.push(this.ack(packet.id));
          }
          if (this.connected) {
              this.emitEvent(args);
          }
          else {
              this.receiveBuffer.push(Object.freeze(args));
          }
      }
      emitEvent(args) {
          if (this._anyListeners && this._anyListeners.length) {
              const listeners = this._anyListeners.slice();
              for (const listener of listeners) {
                  listener.apply(this, args);
              }
          }
          super.emit.apply(this, args);
          if (this._pid && args.length && typeof args[args.length - 1] === "string") {
              this._lastOffset = args[args.length - 1];
          }
      }
      /**
       * Produces an ack callback to emit with an event.
       *
       * @private
       */
      ack(id) {
          const self = this;
          let sent = false;
          return function (...args) {
              // prevent double callbacks
              if (sent)
                  return;
              sent = true;
              self.packet({
                  type: PacketType.ACK,
                  id: id,
                  data: args,
              });
          };
      }
      /**
       * Called upon a server acknowledgement.
       *
       * @param packet
       * @private
       */
      onack(packet) {
          const ack = this.acks[packet.id];
          if (typeof ack !== "function") {
              return;
          }
          delete this.acks[packet.id];
          // @ts-ignore FIXME ack is incorrectly inferred as 'never'
          if (ack.withError) {
              packet.data.unshift(null);
          }
          // @ts-ignore
          ack.apply(this, packet.data);
      }
      /**
       * Called upon server connect.
       *
       * @private
       */
      onconnect(id, pid) {
          this.id = id;
          this.recovered = pid && this._pid === pid;
          this._pid = pid; // defined only if connection state recovery is enabled
          this.connected = true;
          this.emitBuffered();
          this._drainQueue(true);
          this.emitReserved("connect");
      }
      /**
       * Emit buffered events (received and emitted).
       *
       * @private
       */
      emitBuffered() {
          this.receiveBuffer.forEach((args) => this.emitEvent(args));
          this.receiveBuffer = [];
          this.sendBuffer.forEach((packet) => {
              this.notifyOutgoingListeners(packet);
              this.packet(packet);
          });
          this.sendBuffer = [];
      }
      /**
       * Called upon server disconnect.
       *
       * @private
       */
      ondisconnect() {
          this.destroy();
          this.onclose("io server disconnect");
      }
      /**
       * Called upon forced client/server side disconnections,
       * this method ensures the manager stops tracking us and
       * that reconnections don't get triggered for this.
       *
       * @private
       */
      destroy() {
          if (this.subs) {
              // clean subscriptions to avoid reconnections
              this.subs.forEach((subDestroy) => subDestroy());
              this.subs = undefined;
          }
          this.io["_destroy"](this);
      }
      /**
       * Disconnects the socket manually. In that case, the socket will not try to reconnect.
       *
       * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
       *
       * @example
       * const socket = io();
       *
       * socket.on("disconnect", (reason) => {
       *   // console.log(reason); prints "io client disconnect"
       * });
       *
       * socket.disconnect();
       *
       * @return self
       */
      disconnect() {
          if (this.connected) {
              this.packet({ type: PacketType.DISCONNECT });
          }
          // remove socket from pool
          this.destroy();
          if (this.connected) {
              // fire events
              this.onclose("io client disconnect");
          }
          return this;
      }
      /**
       * Alias for {@link disconnect()}.
       *
       * @return self
       */
      close() {
          return this.disconnect();
      }
      /**
       * Sets the compress flag.
       *
       * @example
       * socket.compress(false).emit("hello");
       *
       * @param compress - if `true`, compresses the sending data
       * @return self
       */
      compress(compress) {
          this.flags.compress = compress;
          return this;
      }
      /**
       * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
       * ready to send messages.
       *
       * @example
       * socket.volatile.emit("hello"); // the server may or may not receive it
       *
       * @returns self
       */
      get volatile() {
          this.flags.volatile = true;
          return this;
      }
      /**
       * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
       * given number of milliseconds have elapsed without an acknowledgement from the server:
       *
       * @example
       * socket.timeout(5000).emit("my-event", (err) => {
       *   if (err) {
       *     // the server did not acknowledge the event in the given delay
       *   }
       * });
       *
       * @returns self
       */
      timeout(timeout) {
          this.flags.timeout = timeout;
          return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback.
       *
       * @example
       * socket.onAny((event, ...args) => {
       *   console.log(`got ${event}`);
       * });
       *
       * @param listener
       */
      onAny(listener) {
          this._anyListeners = this._anyListeners || [];
          this._anyListeners.push(listener);
          return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback. The listener is added to the beginning of the listeners array.
       *
       * @example
       * socket.prependAny((event, ...args) => {
       *   console.log(`got event ${event}`);
       * });
       *
       * @param listener
       */
      prependAny(listener) {
          this._anyListeners = this._anyListeners || [];
          this._anyListeners.unshift(listener);
          return this;
      }
      /**
       * Removes the listener that will be fired when any event is emitted.
       *
       * @example
       * const catchAllListener = (event, ...args) => {
       *   console.log(`got event ${event}`);
       * }
       *
       * socket.onAny(catchAllListener);
       *
       * // remove a specific listener
       * socket.offAny(catchAllListener);
       *
       * // or remove all listeners
       * socket.offAny();
       *
       * @param listener
       */
      offAny(listener) {
          if (!this._anyListeners) {
              return this;
          }
          if (listener) {
              const listeners = this._anyListeners;
              for (let i = 0; i < listeners.length; i++) {
                  if (listener === listeners[i]) {
                      listeners.splice(i, 1);
                      return this;
                  }
              }
          }
          else {
              this._anyListeners = [];
          }
          return this;
      }
      /**
       * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
       * e.g. to remove listeners.
       */
      listenersAny() {
          return this._anyListeners || [];
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback.
       *
       * Note: acknowledgements sent to the server are not included.
       *
       * @example
       * socket.onAnyOutgoing((event, ...args) => {
       *   console.log(`sent event ${event}`);
       * });
       *
       * @param listener
       */
      onAnyOutgoing(listener) {
          this._anyOutgoingListeners = this._anyOutgoingListeners || [];
          this._anyOutgoingListeners.push(listener);
          return this;
      }
      /**
       * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
       * callback. The listener is added to the beginning of the listeners array.
       *
       * Note: acknowledgements sent to the server are not included.
       *
       * @example
       * socket.prependAnyOutgoing((event, ...args) => {
       *   console.log(`sent event ${event}`);
       * });
       *
       * @param listener
       */
      prependAnyOutgoing(listener) {
          this._anyOutgoingListeners = this._anyOutgoingListeners || [];
          this._anyOutgoingListeners.unshift(listener);
          return this;
      }
      /**
       * Removes the listener that will be fired when any event is emitted.
       *
       * @example
       * const catchAllListener = (event, ...args) => {
       *   console.log(`sent event ${event}`);
       * }
       *
       * socket.onAnyOutgoing(catchAllListener);
       *
       * // remove a specific listener
       * socket.offAnyOutgoing(catchAllListener);
       *
       * // or remove all listeners
       * socket.offAnyOutgoing();
       *
       * @param [listener] - the catch-all listener (optional)
       */
      offAnyOutgoing(listener) {
          if (!this._anyOutgoingListeners) {
              return this;
          }
          if (listener) {
              const listeners = this._anyOutgoingListeners;
              for (let i = 0; i < listeners.length; i++) {
                  if (listener === listeners[i]) {
                      listeners.splice(i, 1);
                      return this;
                  }
              }
          }
          else {
              this._anyOutgoingListeners = [];
          }
          return this;
      }
      /**
       * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
       * e.g. to remove listeners.
       */
      listenersAnyOutgoing() {
          return this._anyOutgoingListeners || [];
      }
      /**
       * Notify the listeners for each packet sent
       *
       * @param packet
       *
       * @private
       */
      notifyOutgoingListeners(packet) {
          if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
              const listeners = this._anyOutgoingListeners.slice();
              for (const listener of listeners) {
                  listener.apply(this, packet.data);
              }
          }
      }
  }

  /**
   * Initialize backoff timer with `opts`.
   *
   * - `min` initial timeout in milliseconds [100]
   * - `max` max timeout [10000]
   * - `jitter` [0]
   * - `factor` [2]
   *
   * @param {Object} opts
   * @api public
   */
  function Backoff(opts) {
      opts = opts || {};
      this.ms = opts.min || 100;
      this.max = opts.max || 10000;
      this.factor = opts.factor || 2;
      this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
      this.attempts = 0;
  }
  /**
   * Return the backoff duration.
   *
   * @return {Number}
   * @api public
   */
  Backoff.prototype.duration = function () {
      var ms = this.ms * Math.pow(this.factor, this.attempts++);
      if (this.jitter) {
          var rand = Math.random();
          var deviation = Math.floor(rand * this.jitter * ms);
          ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
      }
      return Math.min(ms, this.max) | 0;
  };
  /**
   * Reset the number of attempts.
   *
   * @api public
   */
  Backoff.prototype.reset = function () {
      this.attempts = 0;
  };
  /**
   * Set the minimum duration
   *
   * @api public
   */
  Backoff.prototype.setMin = function (min) {
      this.ms = min;
  };
  /**
   * Set the maximum duration
   *
   * @api public
   */
  Backoff.prototype.setMax = function (max) {
      this.max = max;
  };
  /**
   * Set the jitter
   *
   * @api public
   */
  Backoff.prototype.setJitter = function (jitter) {
      this.jitter = jitter;
  };

  class Manager extends Emitter_1 {
      constructor(uri, opts) {
          var _a;
          super();
          this.nsps = {};
          this.subs = [];
          if (uri && "object" === typeof uri) {
              opts = uri;
              uri = undefined;
          }
          opts = opts || {};
          opts.path = opts.path || "/socket.io";
          this.opts = opts;
          installTimerFunctions(this, opts);
          this.reconnection(opts.reconnection !== false);
          this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
          this.reconnectionDelay(opts.reconnectionDelay || 1000);
          this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
          this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
          this.backoff = new Backoff({
              min: this.reconnectionDelay(),
              max: this.reconnectionDelayMax(),
              jitter: this.randomizationFactor(),
          });
          this.timeout(null == opts.timeout ? 20000 : opts.timeout);
          this._readyState = "closed";
          this.uri = uri;
          const _parser = opts.parser || parser;
          this.encoder = new _parser.Encoder();
          this.decoder = new _parser.Decoder();
          this._autoConnect = opts.autoConnect !== false;
          if (this._autoConnect)
              this.open();
      }
      reconnection(v) {
          if (!arguments.length)
              return this._reconnection;
          this._reconnection = !!v;
          if (!v) {
              this.skipReconnect = true;
          }
          return this;
      }
      reconnectionAttempts(v) {
          if (v === undefined)
              return this._reconnectionAttempts;
          this._reconnectionAttempts = v;
          return this;
      }
      reconnectionDelay(v) {
          var _a;
          if (v === undefined)
              return this._reconnectionDelay;
          this._reconnectionDelay = v;
          (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
          return this;
      }
      randomizationFactor(v) {
          var _a;
          if (v === undefined)
              return this._randomizationFactor;
          this._randomizationFactor = v;
          (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
          return this;
      }
      reconnectionDelayMax(v) {
          var _a;
          if (v === undefined)
              return this._reconnectionDelayMax;
          this._reconnectionDelayMax = v;
          (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
          return this;
      }
      timeout(v) {
          if (!arguments.length)
              return this._timeout;
          this._timeout = v;
          return this;
      }
      /**
       * Starts trying to reconnect if reconnection is enabled and we have not
       * started reconnecting yet
       *
       * @private
       */
      maybeReconnectOnOpen() {
          // Only try to reconnect if it's the first time we're connecting
          if (!this._reconnecting &&
              this._reconnection &&
              this.backoff.attempts === 0) {
              // keeps reconnection from firing twice for the same reconnection loop
              this.reconnect();
          }
      }
      /**
       * Sets the current transport `socket`.
       *
       * @param {Function} fn - optional, callback
       * @return self
       * @public
       */
      open(fn) {
          if (~this._readyState.indexOf("open"))
              return this;
          this.engine = new Socket$1(this.uri, this.opts);
          const socket = this.engine;
          const self = this;
          this._readyState = "opening";
          this.skipReconnect = false;
          // emit `open`
          const openSubDestroy = on(socket, "open", function () {
              self.onopen();
              fn && fn();
          });
          const onError = (err) => {
              this.cleanup();
              this._readyState = "closed";
              this.emitReserved("error", err);
              if (fn) {
                  fn(err);
              }
              else {
                  // Only do this if there is no fn to handle the error
                  this.maybeReconnectOnOpen();
              }
          };
          // emit `error`
          const errorSub = on(socket, "error", onError);
          if (false !== this._timeout) {
              const timeout = this._timeout;
              // set timer
              const timer = this.setTimeoutFn(() => {
                  openSubDestroy();
                  onError(new Error("timeout"));
                  socket.close();
              }, timeout);
              if (this.opts.autoUnref) {
                  timer.unref();
              }
              this.subs.push(() => {
                  this.clearTimeoutFn(timer);
              });
          }
          this.subs.push(openSubDestroy);
          this.subs.push(errorSub);
          return this;
      }
      /**
       * Alias for open()
       *
       * @return self
       * @public
       */
      connect(fn) {
          return this.open(fn);
      }
      /**
       * Called upon transport open.
       *
       * @private
       */
      onopen() {
          // clear old subs
          this.cleanup();
          // mark as open
          this._readyState = "open";
          this.emitReserved("open");
          // add new subs
          const socket = this.engine;
          this.subs.push(on(socket, "ping", this.onping.bind(this)), on(socket, "data", this.ondata.bind(this)), on(socket, "error", this.onerror.bind(this)), on(socket, "close", this.onclose.bind(this)), 
          // @ts-ignore
          on(this.decoder, "decoded", this.ondecoded.bind(this)));
      }
      /**
       * Called upon a ping.
       *
       * @private
       */
      onping() {
          this.emitReserved("ping");
      }
      /**
       * Called with data.
       *
       * @private
       */
      ondata(data) {
          try {
              this.decoder.add(data);
          }
          catch (e) {
              this.onclose("parse error", e);
          }
      }
      /**
       * Called when parser fully decodes a packet.
       *
       * @private
       */
      ondecoded(packet) {
          // the nextTick call prevents an exception in a user-provided event listener from triggering a disconnection due to a "parse error"
          nextTick(() => {
              this.emitReserved("packet", packet);
          }, this.setTimeoutFn);
      }
      /**
       * Called upon socket error.
       *
       * @private
       */
      onerror(err) {
          this.emitReserved("error", err);
      }
      /**
       * Creates a new socket for the given `nsp`.
       *
       * @return {Socket}
       * @public
       */
      socket(nsp, opts) {
          let socket = this.nsps[nsp];
          if (!socket) {
              socket = new Socket(this, nsp, opts);
              this.nsps[nsp] = socket;
          }
          else if (this._autoConnect && !socket.active) {
              socket.connect();
          }
          return socket;
      }
      /**
       * Called upon a socket close.
       *
       * @param socket
       * @private
       */
      _destroy(socket) {
          const nsps = Object.keys(this.nsps);
          for (const nsp of nsps) {
              const socket = this.nsps[nsp];
              if (socket.active) {
                  return;
              }
          }
          this._close();
      }
      /**
       * Writes a packet.
       *
       * @param packet
       * @private
       */
      _packet(packet) {
          const encodedPackets = this.encoder.encode(packet);
          for (let i = 0; i < encodedPackets.length; i++) {
              this.engine.write(encodedPackets[i], packet.options);
          }
      }
      /**
       * Clean up transport subscriptions and packet buffer.
       *
       * @private
       */
      cleanup() {
          this.subs.forEach((subDestroy) => subDestroy());
          this.subs.length = 0;
          this.decoder.destroy();
      }
      /**
       * Close the current socket.
       *
       * @private
       */
      _close() {
          this.skipReconnect = true;
          this._reconnecting = false;
          this.onclose("forced close");
      }
      /**
       * Alias for close()
       *
       * @private
       */
      disconnect() {
          return this._close();
      }
      /**
       * Called when:
       *
       * - the low-level engine is closed
       * - the parser encountered a badly formatted packet
       * - all sockets are disconnected
       *
       * @private
       */
      onclose(reason, description) {
          var _a;
          this.cleanup();
          (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
          this.backoff.reset();
          this._readyState = "closed";
          this.emitReserved("close", reason, description);
          if (this._reconnection && !this.skipReconnect) {
              this.reconnect();
          }
      }
      /**
       * Attempt a reconnection.
       *
       * @private
       */
      reconnect() {
          if (this._reconnecting || this.skipReconnect)
              return this;
          const self = this;
          if (this.backoff.attempts >= this._reconnectionAttempts) {
              this.backoff.reset();
              this.emitReserved("reconnect_failed");
              this._reconnecting = false;
          }
          else {
              const delay = this.backoff.duration();
              this._reconnecting = true;
              const timer = this.setTimeoutFn(() => {
                  if (self.skipReconnect)
                      return;
                  this.emitReserved("reconnect_attempt", self.backoff.attempts);
                  // check again for the case socket closed in above events
                  if (self.skipReconnect)
                      return;
                  self.open((err) => {
                      if (err) {
                          self._reconnecting = false;
                          self.reconnect();
                          this.emitReserved("reconnect_error", err);
                      }
                      else {
                          self.onreconnect();
                      }
                  });
              }, delay);
              if (this.opts.autoUnref) {
                  timer.unref();
              }
              this.subs.push(() => {
                  this.clearTimeoutFn(timer);
              });
          }
      }
      /**
       * Called upon successful reconnect.
       *
       * @private
       */
      onreconnect() {
          const attempt = this.backoff.attempts;
          this._reconnecting = false;
          this.backoff.reset();
          this.emitReserved("reconnect", attempt);
      }
  }

  /**
   * Managers cache.
   */
  const cache = {};
  function lookup(uri, opts) {
      if (typeof uri === "object") {
          opts = uri;
          uri = undefined;
      }
      opts = opts || {};
      const parsed = url(uri, opts.path || "/socket.io");
      const source = parsed.source;
      const id = parsed.id;
      const path = parsed.path;
      const sameNamespace = cache[id] && path in cache[id]["nsps"];
      const newConnection = opts.forceNew ||
          opts["force new connection"] ||
          false === opts.multiplex ||
          sameNamespace;
      let io;
      if (newConnection) {
          io = new Manager(source, opts);
      }
      else {
          if (!cache[id]) {
              cache[id] = new Manager(source, opts);
          }
          io = cache[id];
      }
      if (parsed.query && !opts.query) {
          opts.query = parsed.queryKey;
      }
      return io.socket(parsed.path, opts);
  }
  // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
  // namespace (e.g. `io.connect(...)`), for backward compatibility
  Object.assign(lookup, {
      Manager,
      Socket,
      io: lookup,
      connect: lookup,
  });

  const ADMIN_ROOT_PATH = '/admin';

  /**
   * Same two-tone chime as admin/live-chat.ts's playIncomingChime(), kept as a
   * separate copy rather than a shared import: that file is a
   * server-rendered plain HTML page with its own inline <script> (a
   * completely different runtime from this AdminJS React bundle), so there is
   * nothing to actually share it with - see the file-level comment below for
   * the fuller reasoning.
   */
  function playChime(ctx) {
    const now = ctx.currentTime;
    [0, 0.15].forEach((offset, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = index === 0 ? 740 : 988;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.14);
    });
  }

  // Title flash is module-level (not per-mount state) for the same reason as
  // admin/live-chat.ts's copy and web/src/lib/support-notify.ts on the
  // customer side: a single shared "the tab title is lying to get your
  // attention" flag, not one per component instance.
  const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : '';
  let titleFlashTimer;
  let titleFlashOn = false;
  function startTitleFlash() {
    if (titleFlashTimer !== undefined) return;
    titleFlashTimer = window.setInterval(() => {
      titleFlashOn = !titleFlashOn;
      document.title = titleFlashOn ? `🔴 New message — ${ORIGINAL_TITLE}` : ORIGINAL_TITLE;
    }, 1200);
  }
  function stopTitleFlash() {
    if (titleFlashTimer !== undefined) {
      window.clearInterval(titleFlashTimer);
      titleFlashTimer = undefined;
    }
    document.title = ORIGINAL_TITLE;
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) stopTitleFlash();
    });
    window.addEventListener('focus', stopTitleFlash);
  }
  /**
   * Rings, alerts and shows a dismissible pill for a new (or newly-unread)
   * customer/partner chat, on every AdminJS page - not only
   * /admin/live-chat, which an admin might well not have open while working a
   * different queue. Mounted once via the TopBar override (see
   * topbar-with-chat-alert.tsx), which AdminJS renders outside the
   * page-specific routes, so it survives navigation between resources
   * instead of being torn down and reconnecting a socket on every click.
   *
   * Deliberately its own Socket.IO connection rather than something shared
   * with admin/live-chat.ts: that page is a separate, non-React,
   * server-rendered document (its own <script> tag, not part of this bundle),
   * so there is no connection or module to actually share even if we wanted
   * to - and the two are never open in the same tab at once, so there is no
   * risk of the same message alerting twice.
   *
   * Uses the aggregate 'chat:queue' event (broadcast to every connected admin
   * whenever ANY conversation's unread count changes - see chat-socket.ts)
   * rather than 'chat:message': the server only delivers 'chat:message' to
   * sockets that joined that specific conversation's room, so it can never
   * tell this component about a customer it hasn't opened yet. 'chat:queue'
   * is the one signal that actually reaches every admin regardless of what
   * they're looking at.
   */
  function GlobalChatAlert() {
    const [pill, setPill] = React.useState(null);
    const [notifPermission, setNotifPermission] = React.useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    const [dismissedPrompt, setDismissedPrompt] = React.useState(false);
    const lastTotal = React.useRef(null);
    const audioCtx = React.useRef(null);
    const audioUnlocked = React.useRef(false);

    // Web Audio requires a user gesture before it can produce sound - unlock
    // it on the first click/keypress anywhere in the admin panel, same
    // approach as admin/live-chat.ts, so the very first alert of the session
    // isn't silently swallowed just because the admin hasn't touched the
    // chat page specifically.
    React.useEffect(() => {
      function unlock() {
        if (audioUnlocked.current) return;
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (!Ctor) return;
        audioCtx.current = new Ctor();
        audioUnlocked.current = true;
      }
      document.addEventListener('pointerdown', unlock, {
        once: true,
        passive: true
      });
      document.addEventListener('keydown', unlock, {
        once: true
      });
      return () => {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
    }, []);
    React.useEffect(() => {
      const socket = lookup({
        withCredentials: true
      });
      socket.on('chat:queue', rows => {
        const total = rows.reduce((sum, row) => sum + (row.unread_by_admin ?? 0), 0);
        if (lastTotal.current !== null && total > lastTotal.current) {
          setPill({
            count: total
          });
          if (document.hidden) startTitleFlash();
          if (audioCtx.current && audioCtx.current.state === 'running') playChime(audioCtx.current);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              const n = new Notification('New support message', {
                body: total === 1 ? 'A customer sent a new message.' : `${total} conversations are waiting for a reply.`,
                tag: 'live-chat-alert'
              });
              n.onclick = () => {
                window.focus();
                window.location.href = `${ADMIN_ROOT_PATH}/live-chat`;
              };
            } catch {
              // Some browsers can still throw even when permission reads
              // "granted" (focus/user-activation quirks) - the title flash
              // and pill below still carry the alert either way.
            }
          }
        } else if (total === 0) {
          setPill(null);
        }
        lastTotal.current = total;
      });
      return () => {
        socket.disconnect();
      };
    }, []);
    if (pill) {
      return /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
        style: {
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 2100,
          width: 280,
          cursor: 'pointer'
        },
        variant: "white",
        boxShadow: "card",
        p: "lg",
        onClick: () => {
          window.location.href = `${ADMIN_ROOT_PATH}/live-chat`;
        }
      }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }, /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        fontWeight: "bold"
      }, pill.count, " unread chat", pill.count === 1 ? '' : 's'), /*#__PURE__*/React__default.default.createElement("button", {
        type: "button",
        onClick: e => {
          e.stopPropagation();
          setPill(null);
        },
        style: {
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1
        },
        "aria-label": "Dismiss"
      }, "\xD7")), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        fontSize: "sm",
        mt: "default"
      }, "Click to open Live Chat"));
    }

    // No unread message right now, but the admin has never granted (or
    // denied) desktop-alert permission - offer it here too, not only on
    // /admin/live-chat, so they can opt in from wherever they land first.
    // Dismissible per session (not persisted) rather than gone forever: a
    // "maybe later" click shouldn't quietly disable the offer on every future
    // login.
    if (notifPermission === 'default' && !dismissedPrompt) {
      return /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
        style: {
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 2100,
          width: 260
        },
        variant: "white",
        boxShadow: "card",
        p: "default"
      }, /*#__PURE__*/React__default.default.createElement(designSystem.Box, {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }, /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        fontSize: "sm",
        fontWeight: "bold"
      }, "Enable chat alerts?"), /*#__PURE__*/React__default.default.createElement("button", {
        type: "button",
        onClick: () => setDismissedPrompt(true),
        style: {
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1
        },
        "aria-label": "Dismiss"
      }, "\xD7")), /*#__PURE__*/React__default.default.createElement(designSystem.Text, {
        fontSize: "sm",
        mt: "default",
        mb: "default"
      }, "Get a desktop notification when a customer sends a support message, even from other admin pages."), /*#__PURE__*/React__default.default.createElement("button", {
        type: "button",
        onClick: () => Notification.requestPermission().then(p => setNotifPermission(p)),
        style: {
          width: '100%',
          border: 'none',
          borderRadius: 6,
          background: '#2563eb',
          color: '#fff',
          fontWeight: 700,
          padding: '8px 0',
          cursor: 'pointer'
        }
      }, "Enable alerts"));
    }
    return null;
  }

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
  function TopBarWithChatAlert(props) {
    const {
      OriginalComponent,
      ...rest
    } = props;
    return /*#__PURE__*/React__default.default.createElement(React__default.default.Fragment, null, /*#__PURE__*/React__default.default.createElement(OriginalComponent, rest), /*#__PURE__*/React__default.default.createElement(GlobalChatAlert, null));
  }

  AdminJS.UserComponents = {};
  AdminJS.UserComponents.Dashboard = Dashboard;
  AdminJS.UserComponents.TopBar = TopBarWithChatAlert;

})(React, AdminJSDesignSystem);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvYWRtaW4vY29tcG9uZW50cy9kYXNoYm9hcmQudHN4IiwiLi4vbm9kZV9tb2R1bGVzL2VuZ2luZS5pby1wYXJzZXIvYnVpbGQvZXNtL2NvbW1vbnMuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLXBhcnNlci9idWlsZC9lc20vZW5jb2RlUGFja2V0LmJyb3dzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLXBhcnNlci9idWlsZC9lc20vY29udHJpYi9iYXNlNjQtYXJyYXlidWZmZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLXBhcnNlci9idWlsZC9lc20vZGVjb2RlUGFja2V0LmJyb3dzZXIuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLXBhcnNlci9idWlsZC9lc20vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvQHNvY2tldC5pby9jb21wb25lbnQtZW1pdHRlci9saWIvY2pzL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuZ2luZS5pby1jbGllbnQvYnVpbGQvZXNtL2dsb2JhbHMuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLWNsaWVudC9idWlsZC9lc20vdXRpbC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmdpbmUuaW8tY2xpZW50L2J1aWxkL2VzbS9jb250cmliL3BhcnNlcXMuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLWNsaWVudC9idWlsZC9lc20vdHJhbnNwb3J0LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuZ2luZS5pby1jbGllbnQvYnVpbGQvZXNtL3RyYW5zcG9ydHMvcG9sbGluZy5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmdpbmUuaW8tY2xpZW50L2J1aWxkL2VzbS9jb250cmliL2hhcy1jb3JzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuZ2luZS5pby1jbGllbnQvYnVpbGQvZXNtL3RyYW5zcG9ydHMvcG9sbGluZy14aHIuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLWNsaWVudC9idWlsZC9lc20vdHJhbnNwb3J0cy93ZWJzb2NrZXQuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLWNsaWVudC9idWlsZC9lc20vdHJhbnNwb3J0cy93ZWJ0cmFuc3BvcnQuanMiLCIuLi9ub2RlX21vZHVsZXMvZW5naW5lLmlvLWNsaWVudC9idWlsZC9lc20vdHJhbnNwb3J0cy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmdpbmUuaW8tY2xpZW50L2J1aWxkL2VzbS9jb250cmliL3BhcnNldXJpLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VuZ2luZS5pby1jbGllbnQvYnVpbGQvZXNtL3NvY2tldC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lbmdpbmUuaW8tY2xpZW50L2J1aWxkL2VzbS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zb2NrZXQuaW8tY2xpZW50L2J1aWxkL2VzbS91cmwuanMiLCIuLi9ub2RlX21vZHVsZXMvc29ja2V0LmlvLXBhcnNlci9idWlsZC9lc20vaXMtYmluYXJ5LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NvY2tldC5pby1wYXJzZXIvYnVpbGQvZXNtL2JpbmFyeS5qcyIsIi4uL25vZGVfbW9kdWxlcy9zb2NrZXQuaW8tcGFyc2VyL2J1aWxkL2VzbS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9zb2NrZXQuaW8tY2xpZW50L2J1aWxkL2VzbS9vbi5qcyIsIi4uL25vZGVfbW9kdWxlcy9zb2NrZXQuaW8tY2xpZW50L2J1aWxkL2VzbS9zb2NrZXQuanMiLCIuLi9ub2RlX21vZHVsZXMvc29ja2V0LmlvLWNsaWVudC9idWlsZC9lc20vY29udHJpYi9iYWNrbzIuanMiLCIuLi9ub2RlX21vZHVsZXMvc29ja2V0LmlvLWNsaWVudC9idWlsZC9lc20vbWFuYWdlci5qcyIsIi4uL25vZGVfbW9kdWxlcy9zb2NrZXQuaW8tY2xpZW50L2J1aWxkL2VzbS9pbmRleC5qcyIsIi4uL3NyYy9hZG1pbi9jb21wb25lbnRzL2dsb2JhbC1jaGF0LWFsZXJ0LnRzeCIsIi4uL3NyYy9hZG1pbi9jb21wb25lbnRzL3RvcGJhci13aXRoLWNoYXQtYWxlcnQudHN4IiwiZW50cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0LCB7IHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JztcclxuaW1wb3J0IHsgQm94LCBCdXR0b24sIEgyLCBINCwgSWNvbiwgVGV4dCB9IGZyb20gJ0BhZG1pbmpzL2Rlc2lnbi1zeXN0ZW0nO1xyXG5cclxuY29uc3QgQURNSU5fUk9PVF9QQVRIID0gJy9hZG1pbic7XHJcbnR5cGUgUGVuZGluZ1N1bW1hcnkgPSB7IHRvdGFsX3BlbmRpbmc6IG51bWJlcjsgdG90YWxfbmV3X2xhc3RfMjRoOiBudW1iZXI7IGJ5X3R5cGU6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nOyBocmVmOiBzdHJpbmc7IHBlbmRpbmc6IG51bWJlciB9PiB9O1xyXG5cclxuZnVuY3Rpb24gUGVuZGluZ1JlcXVlc3RzUG9wdXAoKSB7XHJcbiAgY29uc3QgW3N1bW1hcnksIHNldFN1bW1hcnldID0gdXNlU3RhdGU8UGVuZGluZ1N1bW1hcnkgfCBudWxsPihudWxsKTsgY29uc3QgW2Rpc21pc3NlZCwgc2V0RGlzbWlzc2VkXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBwcmV2aW91c1BlbmRpbmcgPSB1c2VSZWY8bnVtYmVyIHwgbnVsbD4obnVsbCk7XHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBhY3RpdmUgPSB0cnVlO1xyXG4gICAgY29uc3QgbG9hZCA9ICgpID0+IGZldGNoKGAke0FETUlOX1JPT1RfUEFUSH0vcGVuZGluZy1zdW1tYXJ5YCwgeyBjcmVkZW50aWFsczogJ2luY2x1ZGUnIH0pLnRoZW4oKHIpID0+IHIub2sgPyByLmpzb24oKSA6IFByb21pc2UucmVqZWN0KCkpLnRoZW4oKGJvZHkpID0+IHsgaWYgKGFjdGl2ZSkgc2V0U3VtbWFyeShib2R5LmRhdGEpOyB9KS5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgICB2b2lkIGxvYWQoKTtcclxuICAgIGNvbnN0IGludGVydmFsID0gd2luZG93LnNldEludGVydmFsKGxvYWQsIDQ1XzAwMCk7XHJcbiAgICByZXR1cm4gKCkgPT4geyBhY3RpdmUgPSBmYWxzZTsgd2luZG93LmNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpOyB9O1xyXG4gIH0sIFtdKTtcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKHN1bW1hcnkgJiYgcHJldmlvdXNQZW5kaW5nLmN1cnJlbnQgIT09IG51bGwgJiYgc3VtbWFyeS50b3RhbF9wZW5kaW5nID4gcHJldmlvdXNQZW5kaW5nLmN1cnJlbnQpIHNldERpc21pc3NlZChmYWxzZSk7XHJcbiAgICBpZiAoc3VtbWFyeSkgcHJldmlvdXNQZW5kaW5nLmN1cnJlbnQgPSBzdW1tYXJ5LnRvdGFsX3BlbmRpbmc7XHJcbiAgfSwgW3N1bW1hcnldKTtcclxuICBpZiAoZGlzbWlzc2VkIHx8ICFzdW1tYXJ5IHx8IHN1bW1hcnkudG90YWxfcGVuZGluZyA9PT0gMCkgcmV0dXJuIG51bGw7XHJcbiAgcmV0dXJuIDxCb3ggc3R5bGU9e3sgcG9zaXRpb246ICdmaXhlZCcsIGluc2V0OiAwLCBiYWNrZ3JvdW5kOiAncmdiYSgxNSwyMyw0MiwuNTUpJywgekluZGV4OiAxMDAwIH19IGRpc3BsYXk9XCJmbGV4XCIgYWxpZ25JdGVtcz1cImNlbnRlclwiIGp1c3RpZnlDb250ZW50PVwiY2VudGVyXCIgb25DbGljaz17KCkgPT4gc2V0RGlzbWlzc2VkKHRydWUpfT48Qm94IHZhcmlhbnQ9XCJ3aGl0ZVwiIGJveFNoYWRvdz1cImNhcmRcIiBwPVwieGxcIiBzdHlsZT17eyB3aWR0aDogJ21pbig0ODBweCw5MnZ3KScsIGJvcmRlclJhZGl1czogMTQgfX0gb25DbGljaz17KGU6IFJlYWN0Lk1vdXNlRXZlbnQpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9PjxINCBtYj1cImRlZmF1bHRcIj5SZXF1ZXN0cyB3YWl0aW5nIG9uIHlvdTwvSDQ+PFRleHQgbWI9XCJsZ1wiPntzdW1tYXJ5LnRvdGFsX3BlbmRpbmd9IHVucmVzb2x2ZWQgcmVxdWVzdHtzdW1tYXJ5LnRvdGFsX3BlbmRpbmcgPT09IDEgPyAnJyA6ICdzJ317c3VtbWFyeS50b3RhbF9uZXdfbGFzdF8yNGggPyBgIOKAoiAke3N1bW1hcnkudG90YWxfbmV3X2xhc3RfMjRofSBuZXcgdG9kYXlgIDogJyd9PC9UZXh0PntzdW1tYXJ5LmJ5X3R5cGUuZmlsdGVyKChyb3cpID0+IHJvdy5wZW5kaW5nKS5tYXAoKHJvdykgPT4gPGEga2V5PXtyb3cudHlwZX0gaHJlZj17cm93LmhyZWZ9IHN0eWxlPXt7IGRpc3BsYXk6ICdibG9jaycsIHBhZGRpbmc6ICcxMHB4IDAnLCBib3JkZXJCb3R0b206ICcxcHggc29saWQgI2VlZScsIHRleHREZWNvcmF0aW9uOiAnbm9uZScgfX0+PFRleHQgZm9udFdlaWdodD1cImJvbGRcIj57cm93LmxhYmVsfToge3Jvdy5wZW5kaW5nfSBwZW5kaW5nIOKGkjwvVGV4dD48L2E+KX08QnV0dG9uIG10PVwibGdcIiBvbkNsaWNrPXsoKSA9PiBzZXREaXNtaXNzZWQodHJ1ZSl9IHN0eWxlPXt7IHdpZHRoOiAnMTAwJScgfX0+R290IGl0PC9CdXR0b24+PC9Cb3g+PC9Cb3g+O1xyXG59XHJcblxyXG50eXBlIFF1aWNrTGluayA9IHtcclxuICBsYWJlbDogc3RyaW5nO1xyXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XHJcbiAgLyoqIEFkbWluSlMgcmVzb3VyY2UtYmFja2VkIHBhZ2UgLSBtdXR1YWxseSBleGNsdXNpdmUgd2l0aCBgaHJlZmAuICovXHJcbiAgcmVzb3VyY2VJZD86IHN0cmluZztcclxuICAvKiogUGxhaW4gc2VydmVyLXJlbmRlcmVkIHBhZ2UgKEJ1bGsgUHJpY2luZywgQ29tcGFueSBXYWxsZXQsIGV0YykgLSBtdXR1YWxseSBleGNsdXNpdmUgd2l0aCBgcmVzb3VyY2VJZGAuICovXHJcbiAgaHJlZj86IHN0cmluZztcclxuICBpY29uOiBzdHJpbmc7XHJcbn07XHJcblxyXG4vLyBLZWVwIHRoZSBkYXNoYm9hcmQgaW50ZW50aW9uYWxseSBzaG9ydC4gRXZlcnkgc3BlY2lhbGlzdCB0b29sIHN0aWxsIGxpdmVzXHJcbi8vIGluIHRoZSBBZG1pbkpTIHNpZGViYXI7IHRoZXNlIGNhcmRzIGFyZSB0aGUgZXZlcnlkYXkgd29yayBxdWV1ZXMgYW5kIHRoZVxyXG4vLyBmZXcgY29udHJvbCBhcmVhcyBhbiBhZG1pbiBuZWVkcyBtb3N0IG9mdGVuLlxyXG5jb25zdCBxdWlja0xpbmtzOiBRdWlja0xpbmtbXSA9IFtcbiAgeyBsYWJlbDogJ01hbnVhbCBQcm92aWRlciBEaXNwYXRjaCcsIGRlc2NyaXB0aW9uOiAnVmlldyBmdWxsIE5JTiBhbmQgVHJhY2tpbmcgSURzLCB0aGVuIHJvdXRlIG1hbnVhbCB0aWNrZXQgcmVxdWVzdHMgdG8gYSBwcm92aWRlcicsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vbWFudWFsLXByb3ZpZGVyLWRpc3BhdGNoYCwgaWNvbjogJ1NlbmQnIH0sXG4gIHsgbGFiZWw6ICdDdXN0b21lcnMnLCBkZXNjcmlwdGlvbjogJ1VzZXJzLCBLWUMgc3RhdHVzICYgcHJvZmlsZXMnLCByZXNvdXJjZUlkOiAnVXNlcicsIGljb246ICdVc2VycycgfSxcbiAgeyBsYWJlbDogJ0xlZGdlcicsIGRlc2NyaXB0aW9uOiAnVHJhbnNhY3Rpb25zLCByZXZlcnNhbHMgJiBoaXN0b3J5JywgcmVzb3VyY2VJZDogJ1RyYW5zYWN0aW9uJywgaWNvbjogJ0xpc3QnIH0sXG4gIHsgbGFiZWw6ICdBbGwgTWFudWFsIFJlcXVlc3RzJywgZGVzY3JpcHRpb246ICdPbmUgcXVldWUgZm9yIGV2ZXJ5IGN1c3RvbWVyIGFuZCBQYXJ0bmVyIEFQSSByZXF1ZXN0IGF3YWl0aW5nIHByb2Nlc3NpbmcnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L21hbnVhbC1yZXF1ZXN0c2AsIGljb246ICdMaXN0JyB9LFxuICB7IGxhYmVsOiAnTklOIFNlcnZpY2VzJywgZGVzY3JpcHRpb246ICdVcGRhdGUgb3IgY29tcGxldGUgbWFueSBwZW5kaW5nIE5JTiByZXF1ZXN0cyBmcm9tIG9uZSBwcm9jZXNzaW5nIGxpc3QnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L21hbnVhbC12ZXJpZmljYXRpb25zP2dyb3VwPU5JTmAsIGljb246ICdGaW5nZXJwcmludCcgfSxcclxuICB7IGxhYmVsOiAnQlZOIFNlcnZpY2VzJywgZGVzY3JpcHRpb246ICdVcGRhdGUgb3IgY29tcGxldGUgbWFueSBwZW5kaW5nIEJWTiByZXF1ZXN0cyBmcm9tIG9uZSBwcm9jZXNzaW5nIGxpc3QnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L21hbnVhbC12ZXJpZmljYXRpb25zP2dyb3VwPUJWTmAsIGljb246ICdDcmVkaXRDYXJkJyB9LFxyXG4gIHsgbGFiZWw6ICdDQUMgU2VydmljZXMnLCBkZXNjcmlwdGlvbjogJ0FsbCBDQUMgcmVnaXN0cmF0aW9uIGFuZCB2ZXJpZmljYXRpb24gcmVxdWVzdHMgaW4gb25lIHF1ZXVlJywgaHJlZjogYCR7QURNSU5fUk9PVF9QQVRIfS9tYW51YWwtcmVxdWVzdHM/Z3JvdXA9Q0FDYCwgaWNvbjogJ0JyaWVmY2FzZScgfSxcclxuICB7IGxhYmVsOiAnSkFNQiBTZXJ2aWNlcycsIGRlc2NyaXB0aW9uOiAnQWxsIHBhaWQgSkFNQiBkb2N1bWVudCBhbmQgYWRtaXNzaW9uIHJlcXVlc3RzIGluIG9uZSBxdWV1ZScsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vbWFudWFsLXJlcXVlc3RzP2dyb3VwPUpBTUJgLCBpY29uOiAnR3JhZHVhdGlvbkNhcCcgfSxcclxuICB7IGxhYmVsOiAnVElOICYgT3RoZXIgU2VydmljZXMnLCBkZXNjcmlwdGlvbjogJ1RJTi1yZWFkeSBxdWV1ZSBwbHVzIEJpcnRoIEF0dGVzdGF0aW9uLCBOZXdzcGFwZXIgYW5kIG5ldyBtYW51YWwgc2VydmljZXMnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L21hbnVhbC1yZXF1ZXN0cz9ncm91cD1USU5fT1RIRVJgLCBpY29uOiAnRmlsZVRleHQnIH0sXHJcbiAgeyBsYWJlbDogJ1VzZXIgV2FsbGV0IEFjdGl2aXR5JywgZGVzY3JpcHRpb246ICdMb29rIHVwIGFueSBjdXN0b21lcjogZnVuZGluZywgc3BlbmQgJiByZWNlbnQgdHJhbnNhY3Rpb25zJywgaHJlZjogYCR7QURNSU5fUk9PVF9QQVRIfS91c2VyLXdhbGxldGAsIGljb246ICdTZWFyY2gnIH0sXHJcbiAgeyBsYWJlbDogJ0N1c3RvbWVyIEFjdGl2aXR5JywgZGVzY3JpcHRpb246ICdUb3AgY3VzdG9tZXJzLCB3aGF0IHRoZXkgYm91Z2h0LCBhbmQgcmV3YXJkIGNhbmRpZGF0ZXMnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L2N1c3RvbWVyLWFjdGl2aXR5YCwgaWNvbjogJ0F3YXJkJyB9LFxyXG4gIHsgbGFiZWw6ICdMb2dpbiBBY3Rpdml0eScsIGRlc2NyaXB0aW9uOiAnTGF0ZXN0IGN1c3RvbWVyIEFwcC9XZWIgbG9naW5zIGFuZCBwYXJ0bmVyIHBvcnRhbCBhY2Nlc3MnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L2xvZ2luLWFjdGl2aXR5YCwgaWNvbjogJ0xvZ0luJyB9LFxyXG4gIHsgbGFiZWw6ICdVc2VyIERlbGl2ZXJpZXMnLCBkZXNjcmlwdGlvbjogJ1VwbG9hZCBjb21wbGV0ZWQgQ0FDLCBKQU1CIG9yIG90aGVyIHNlcnZpY2UgZmlsZXMgdG8gYSBjdXN0b21lcicsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vdXNlci1kZWxpdmVyaWVzYCwgaWNvbjogJ1VwbG9hZCcgfSxcclxuICB7IGxhYmVsOiAnTGl2ZSBDaGF0JywgZGVzY3JpcHRpb246ICdSZXBseSB0byBjdXN0b21lcnMgaW4gcmVhbCB0aW1lIChLLVRlY2ggTGl2ZSBDaGF0KScsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vbGl2ZS1jaGF0YCwgaWNvbjogJ01lc3NhZ2VTcXVhcmUnIH0sXHJcbiAgeyBsYWJlbDogJ1NlcnZpY2UgUmVxdWVzdHMnLCBkZXNjcmlwdGlvbjogJ09wZW4gYW5kIHByb2Nlc3MgY3VzdG9tZXIgc3VwcG9ydCByZXF1ZXN0cycsIHJlc291cmNlSWQ6ICdTdXBwb3J0VGlja2V0JywgaWNvbjogJ01lc3NhZ2VDaXJjbGUnIH0sXHJcbiAgeyBsYWJlbDogJ1JlcXVlc3QgUmVwbGllcycsIGRlc2NyaXB0aW9uOiAnU2VuZCB1cGRhdGVzIHRvIGN1c3RvbWVycyB3aGlsZSBhIHJlcXVlc3QgaXMgYmVpbmcgcHJvY2Vzc2VkJywgcmVzb3VyY2VJZDogJ1N1cHBvcnRUaWNrZXRNZXNzYWdlJywgaWNvbjogJ1NlbmQnIH0sXHJcbiAgeyBsYWJlbDogJ1NlcnZpY2UgUHJpY2luZycsIGRlc2NyaXB0aW9uOiAnUHJpY2VzIGFuZCBwcm92aWRlciByb3V0aW5nIGZvciBhbGwgc2VydmljZXMnLCByZXNvdXJjZUlkOiAnU2VydmljZVByaWNpbmcnLCBpY29uOiAnVGFnJyB9LFxyXG4gIHsgbGFiZWw6ICdCdWxrIFByaWNpbmcnLCBkZXNjcmlwdGlvbjogJ1JlcHJpY2UgZGF0YSBwbGFucyBhbmQgc2VydmljZXMgaW4gb25lIHBsYWNlJywgaHJlZjogYCR7QURNSU5fUk9PVF9QQVRIfS9idWxrLXByaWNpbmdgLCBpY29uOiAnU2xpZGVycycgfSxcclxuICB7IGxhYmVsOiAnTklOL0JWTiBQcm92aWRlcicsIGRlc2NyaXB0aW9uOiAnQ2hvb3NlIHRoZSBwcm92aWRlciBzZXBhcmF0ZWx5IGZvciBldmVyeSBOSU4vQlZOIHNlcnZpY2UnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L25pbi1idm4tcHJvdmlkZXJgLCBpY29uOiAnUmVwZWF0JyB9LFxyXG4gIHsgbGFiZWw6ICdTZXJ2aWNlIFN0YXR1cycsIGRlc2NyaXB0aW9uOiAnQWN0aXZhdGUgb3IgZGVhY3RpdmF0ZSBlYWNoIE5JTi9CVk4gYW5kIHJlc3VsdC1waW4gc2VydmljZScsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vc2VydmljZS1zdGF0dXNgLCBpY29uOiAnUG93ZXInIH0sXHJcbiAgeyBsYWJlbDogJ0NvbXBhbnkgV2FsbGV0JywgZGVzY3JpcHRpb246ICdSZXZlbnVlLCBwcm92aWRlciBjb3N0ICYgbmV0IHByb2ZpdCBieSBzZXJ2aWNlJywgaHJlZjogYCR7QURNSU5fUk9PVF9QQVRIfS9jb21wYW55LXdhbGxldGAsIGljb246ICdUcmVuZGluZ1VwJyB9LFxyXG4gIHsgbGFiZWw6ICdQcm92aWRlciBMZWRnZXInLCBkZXNjcmlwdGlvbjogJ1Byb3ZpZGVyIGJhbGFuY2VzLCBzZXR0bGVtZW50cyAmIGFkanVzdG1lbnRzJywgaHJlZjogYCR7QURNSU5fUk9PVF9QQVRIfS9wcm92aWRlci1sZWRnZXJgLCBpY29uOiAnUmVwZWF0JyB9LFxyXG4gIHsgbGFiZWw6ICdQcm92aWRlciBSZWNvbmNpbGlhdGlvbicsIGRlc2NyaXB0aW9uOiAnUmVzb2x2ZSBwcm92aWRlciB0cmFuc2FjdGlvbnMgc3RpbGwgcHJvY2Vzc2luZycsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vcHJvdmlkZXItcmVjb25jaWxpYXRpb25gLCBpY29uOiAnQWxlcnRUcmlhbmdsZScgfSxcclxuICB7IGxhYmVsOiAnRGF0YSBQbGFuIFByaWNpbmcnLCBkZXNjcmlwdGlvbjogJ1NldCBwcmljZXMgZm9yIGRhdGEgcGxhbnMnLCByZXNvdXJjZUlkOiAnRGF0YVBsYW5QcmljaW5nJywgaWNvbjogJ1Nob3BwaW5nQ2FydCcgfSxcclxuICB7IGxhYmVsOiAnUmVzdWx0IFBJTiBTdG9jaycsIGRlc2NyaXB0aW9uOiAnQWRkIHByZXBhaWQgV0FFQywgTkVDTyBhbmQgTkFCVEVCIFBJTnMnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L3Jlc3VsdC1waW4tc3RvY2tgLCBpY29uOiAnUGFja2FnZScgfSxcclxuICB7IGxhYmVsOiAnUGFydG5lciBQcmljaW5nJywgZGVzY3JpcHRpb246ICdTZXQgQVBJLXBhcnRuZXItb25seSBwcmljZXMnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L3BhcnRuZXItcHJpY2luZ2AsIGljb246ICdEb2xsYXJTaWduJyB9LFxyXG4gIHsgbGFiZWw6ICdQYXJ0bmVyIEFwcGxpY2F0aW9ucycsIGRlc2NyaXB0aW9uOiAnUmV2aWV3IGVudGVycHJpc2UgQVBJIGFwcGxpY2F0aW9ucyBhbmQgYXBwcm92ZSBvciByZWplY3QgYWNjZXNzJywgaHJlZjogYCR7QURNSU5fUk9PVF9QQVRIfS9wYXJ0bmVyLWFwcGxpY2F0aW9ucz9zdGF0dXM9UEVORElOR19SRVZJRVdgLCBpY29uOiAnQ2xpcGJvYXJkQ2hlY2snIH0sXHJcbiAgeyBsYWJlbDogJ1BhcnRuZXIgTG9va3VwJywgZGVzY3JpcHRpb246ICdDaGVjayBwYXJ0bmVyIHdhbGxldCwgdXNhZ2UgYW5kIGZ1bmRpbmcnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L3BhcnRuZXItbG9va3VwYCwgaWNvbjogJ1NlYXJjaCcgfSxcclxuICB7IGxhYmVsOiAnTWFudWFsIFBhcnRuZXIgV2ViaG9vayBSZWNvdmVyeScsIGRlc2NyaXB0aW9uOiAnRGVsaXZlcnkgc3RhdHVzIGFuZCByZXRyeSBmb3IgcmVzb2x2ZWQgbWFudWFsIHBhcnRuZXIgcmVxdWVzdHMnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L3BhcnRuZXItbWFudWFsLXJlcXVlc3RzL3Jlc2VuZGAsIGljb246ICdTZW5kJyB9LFxuICB7IGxhYmVsOiAnQ291cG9ucycsIGRlc2NyaXB0aW9uOiAnRGlzY291bnQgY29kZXMgJiBwcm9tb3Rpb25zJywgcmVzb3VyY2VJZDogJ0NvdXBvbicsIGljb246ICdDcmVkaXRDYXJkJyB9LFxyXG4gIHsgbGFiZWw6ICdQcm92aWRlciBCYWxhbmNlJywgZGVzY3JpcHRpb246ICdBbHJhaHV6LCBCaWxhbFNhZGFTdWIgJiBUZWNoaHViIGJhbGFuY2VzJywgcmVzb3VyY2VJZDogJ1Byb3ZpZGVyQmFsYW5jZVN0YXR1cycsIGljb246ICdBbGVydFRyaWFuZ2xlJyB9LFxyXG4gIHsgbGFiZWw6ICdSZWZlcnJhbCBTZXR0aW5ncycsIGRlc2NyaXB0aW9uOiAnUmVmZXJyYWwgcmV3YXJkIGNvbmZpZ3VyYXRpb24nLCByZXNvdXJjZUlkOiAnUmVmZXJyYWxTZXR0aW5ncycsIGljb246ICdQZXJjZW50JyB9LFxyXG4gIHsgbGFiZWw6ICdOb3RpZmljYXRpb25zJywgZGVzY3JpcHRpb246ICdCcm9hZGNhc3QgbWVzc2FnZXMgdG8gdXNlcnMnLCByZXNvdXJjZUlkOiAnTm90aWZpY2F0aW9uQnJvYWRjYXN0JywgaWNvbjogJ0JlbGwnIH0sXHJcbiAgeyBsYWJlbDogJ0VtYWlsIGN1c3RvbWVycyAmIHBhcnRuZXJzJywgZGVzY3JpcHRpb246ICdTZW5kIGVtYWlsIGFubm91bmNlbWVudHMgdGhyb3VnaCBSZXNlbmQnLCBocmVmOiBgJHtBRE1JTl9ST09UX1BBVEh9L2VtYWlsLWNvbXBvc2VyYCwgaWNvbjogJ1NlbmQnIH0sXHJcbiAgeyBsYWJlbDogJ1BhcnRuZXJzJywgZGVzY3JpcHRpb246ICdSZXZpZXcgQVBJIHBhcnRuZXIgYWNjb3VudHMgYW5kIHN0YXR1cycsIHJlc291cmNlSWQ6ICdQYXJ0bmVyJywgaWNvbjogJ0JyaWVmY2FzZScgfSxcclxuICB7IGxhYmVsOiAnQXBwIEJhc2UgVVJMICYgVXBkYXRlcycsIGRlc2NyaXB0aW9uOiAnQ2hhbmdlIGxpdmUgYXBwIFVSTCwgdmVyc2lvbiBnYXRlIGFuZCB1cGRhdGUgbWVzc2FnZScsIGhyZWY6IGAke0FETUlOX1JPT1RfUEFUSH0vcmVzb3VyY2VzL0FwcENvbmZpZy9yZWNvcmRzL2RlZmF1bHQvZWRpdGAsIGljb246ICdTZXR0aW5ncycgfSxcclxuICB7IGxhYmVsOiAnQWRtaW4gVXNlcnMnLCBkZXNjcmlwdGlvbjogJ0FkbWluIGFjY291bnRzICYgcm9sZXMnLCByZXNvdXJjZUlkOiAnQWRtaW5Vc2VyJywgaWNvbjogJ1NoaWVsZCcgfSxcclxuICB7IGxhYmVsOiAnQXVkaXQgTG9nJywgZGVzY3JpcHRpb246ICdBZG1pbiBhY3Rpdml0eSBoaXN0b3J5JywgcmVzb3VyY2VJZDogJ0FkbWluQXVkaXRMb2cnLCBpY29uOiAnRmlsZVRleHQnIH1cclxuXTtcclxuXHJcbmNvbnN0IERhc2hib2FyZDogUmVhY3QuRkMgPSAoKSA9PiAoXHJcbiAgPEJveD5cclxuICAgIDxQZW5kaW5nUmVxdWVzdHNQb3B1cCAvPlxyXG4gICAgPEJveFxyXG4gICAgICBwb3NpdGlvbj1cInJlbGF0aXZlXCJcclxuICAgICAgb3ZlcmZsb3c9XCJoaWRkZW5cIlxyXG4gICAgICBweT17WydsZycsICd4bCcsICd4eGwnXX1cclxuICAgICAgcHg9e1snZGVmYXVsdCcsICdsZycsICd4eGwnXX1cclxuICAgICAgc3R5bGU9e3sgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCgxMzVkZWcsICMwYjJmNzMgMCUsICMxNDUyYTAgMTAwJSknIH19XHJcbiAgICA+XHJcbiAgICAgIDxCb3ggZGlzcGxheT1cImZsZXhcIiBhbGlnbkl0ZW1zPVwiY2VudGVyXCIgZmxleERpcmVjdGlvbj17Wydjb2x1bW4nLCAncm93J119IHN0eWxlPXt7IHRleHRBbGlnbjogJ2luaGVyaXQnLCBnYXA6IDE2IH19PlxyXG4gICAgICAgIDxCb3g+XHJcbiAgICAgICAgICA8aW1nXHJcbiAgICAgICAgICAgIHNyYz1cIi9icmFuZGluZy9sb2dvLnBuZ1wiXHJcbiAgICAgICAgICAgIGFsdD1cIkstVGVjaCBTb2x1dGlvbnNcIlxyXG4gICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogJ2NsYW1wKDU2cHgsIDE2dncsIDk2cHgpJywgaGVpZ2h0OiAnY2xhbXAoNTZweCwgMTZ2dywgOTZweCknLCBib3JkZXJSYWRpdXM6IDIwLCBkaXNwbGF5OiAnYmxvY2snIH19XHJcbiAgICAgICAgICAvPlxyXG4gICAgICAgIDwvQm94PlxyXG4gICAgICAgIDxCb3ggc3R5bGU9e3sgbWluV2lkdGg6IDAgfX0+XHJcbiAgICAgICAgICA8SDIgY29sb3I9XCJ3aGl0ZVwiIGZvbnRXZWlnaHQ9XCJib2xkXCIgc3R5bGU9e3sgY29sb3I6ICcjZmZmZmZmJywgZm9udFNpemU6ICdjbGFtcCgxOHB4LCA1dncsIDI4cHgpJywgbGluZUhlaWdodDogMS4yNSB9fT5cclxuICAgICAgICAgICAgV2VsY29tZSB0byBLLVRlY2ggU29sdXRpb25zIEFkbWluXHJcbiAgICAgICAgICA8L0gyPlxyXG4gICAgICAgICAgPFRleHQgY29sb3I9XCJ3aGl0ZVwiIHN0eWxlPXt7IG9wYWNpdHk6IDAuOSwgY29sb3I6ICcjZmZmZmZmJyB9fT5cclxuICAgICAgICAgICAgTWFuYWdlIGN1c3RvbWVycywgcmVxdWVzdHMsIGRlbGl2ZXJpZXMsIHRyYW5zYWN0aW9ucyBhbmQgcHJpY2luZyBmcm9tIG9uZSBwbGFjZS5cclxuICAgICAgICAgIDwvVGV4dD5cclxuICAgICAgICA8L0JveD5cclxuICAgICAgPC9Cb3g+XHJcbiAgICA8L0JveD5cclxuXHJcbiAgICA8Qm94IHB4PXtbJ2RlZmF1bHQnLCAnbGcnLCAneHhsJ119IHB5PVwieGxcIj5cclxuICAgICAgPEg0IG1iPVwibGdcIj5RdWljayBsaW5rczwvSDQ+XHJcbiAgICAgIDxCb3ggc3R5bGU9e3sgZGlzcGxheTogJ2dyaWQnLCBncmlkVGVtcGxhdGVDb2x1bW5zOiAncmVwZWF0KGF1dG8tZmlsbCwgbWlubWF4KG1pbigxMDAlLCAyNjBweCksIDFmcikpJywgZ2FwOiAnY2xhbXAoMTBweCwgMi41dncsIDIwcHgpJyB9fT5cclxuICAgICAgICB7cXVpY2tMaW5rcy5tYXAoKGxpbmspID0+IChcclxuICAgICAgICAgIDxhXHJcbiAgICAgICAgICAgIGtleT17bGluay5yZXNvdXJjZUlkID8/IGxpbmsuaHJlZn1cclxuICAgICAgICAgICAgaHJlZj17bGluay5ocmVmID8/IGAke0FETUlOX1JPT1RfUEFUSH0vcmVzb3VyY2VzLyR7bGluay5yZXNvdXJjZUlkfWB9XHJcbiAgICAgICAgICAgIHN0eWxlPXt7IHRleHREZWNvcmF0aW9uOiAnbm9uZScsIGRpc3BsYXk6ICdibG9jaycsIG1pbldpZHRoOiAwIH19XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxCb3ggdmFyaWFudD1cIndoaXRlXCIgYm94U2hhZG93PVwiY2FyZFwiIHA9XCJsZ1wiIHN0eWxlPXt7IGN1cnNvcjogJ3BvaW50ZXInLCBoZWlnaHQ6ICcxMDAlJywgYmFja2dyb3VuZDogJyMwYjJmNzMnLCBib3JkZXJSYWRpdXM6IDEyLCBvdmVyZmxvd1dyYXA6ICdhbnl3aGVyZScgfX0+XHJcbiAgICAgICAgICAgICAgPEJveCBkaXNwbGF5PVwiZmxleFwiIGFsaWduSXRlbXM9XCJjZW50ZXJcIiBtYj1cImRlZmF1bHRcIj5cclxuICAgICAgICAgICAgICAgIDxJY29uXHJcbiAgICAgICAgICAgICAgICAgIGljb249e2xpbmsuaWNvbn1cclxuICAgICAgICAgICAgICAgICAgY29sb3I9XCIjZmZmZmZmXCJcclxuICAgICAgICAgICAgICAgICAgYmc9XCJyZ2JhKDk2LCAxNjUsIDI1MCwgMC4yNSlcIlxyXG4gICAgICAgICAgICAgICAgICByb3VuZGVkXHJcbiAgICAgICAgICAgICAgICAgIHNpemU9ezIyfVxyXG4gICAgICAgICAgICAgICAgICBwPVwiZGVmYXVsdFwiXHJcbiAgICAgICAgICAgICAgICAgIG1yPVwiZGVmYXVsdFwiXHJcbiAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPFRleHQgZm9udFdlaWdodD1cImJvbGRcIiBjb2xvcj1cIiNmZmZmZmZcIj5cclxuICAgICAgICAgICAgICAgICAge2xpbmsubGFiZWx9XHJcbiAgICAgICAgICAgICAgICA8L1RleHQ+XHJcbiAgICAgICAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgICAgICAgPFRleHQgZm9udFNpemU9XCJzbVwiIGNvbG9yPVwiI2RiZWFmZVwiPlxyXG4gICAgICAgICAgICAgICAge2xpbmsuZGVzY3JpcHRpb259XHJcbiAgICAgICAgICAgICAgPC9UZXh0PlxyXG4gICAgICAgICAgICA8L0JveD5cclxuICAgICAgICAgIDwvYT5cclxuICAgICAgICApKX1cclxuICAgICAgPC9Cb3g+XHJcbiAgICA8L0JveD5cclxuICA8L0JveD5cclxuKTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IERhc2hib2FyZDtcclxuXHJcbiIsImNvbnN0IFBBQ0tFVF9UWVBFUyA9IE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIG5vIE1hcCA9IG5vIHBvbHlmaWxsXG5QQUNLRVRfVFlQRVNbXCJvcGVuXCJdID0gXCIwXCI7XG5QQUNLRVRfVFlQRVNbXCJjbG9zZVwiXSA9IFwiMVwiO1xuUEFDS0VUX1RZUEVTW1wicGluZ1wiXSA9IFwiMlwiO1xuUEFDS0VUX1RZUEVTW1wicG9uZ1wiXSA9IFwiM1wiO1xuUEFDS0VUX1RZUEVTW1wibWVzc2FnZVwiXSA9IFwiNFwiO1xuUEFDS0VUX1RZUEVTW1widXBncmFkZVwiXSA9IFwiNVwiO1xuUEFDS0VUX1RZUEVTW1wibm9vcFwiXSA9IFwiNlwiO1xuY29uc3QgUEFDS0VUX1RZUEVTX1JFVkVSU0UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuT2JqZWN0LmtleXMoUEFDS0VUX1RZUEVTKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBQQUNLRVRfVFlQRVNfUkVWRVJTRVtQQUNLRVRfVFlQRVNba2V5XV0gPSBrZXk7XG59KTtcbmNvbnN0IEVSUk9SX1BBQ0tFVCA9IHsgdHlwZTogXCJlcnJvclwiLCBkYXRhOiBcInBhcnNlciBlcnJvclwiIH07XG5leHBvcnQgeyBQQUNLRVRfVFlQRVMsIFBBQ0tFVF9UWVBFU19SRVZFUlNFLCBFUlJPUl9QQUNLRVQgfTtcbiIsImltcG9ydCB7IFBBQ0tFVF9UWVBFUyB9IGZyb20gXCIuL2NvbW1vbnMuanNcIjtcbmNvbnN0IHdpdGhOYXRpdmVCbG9iID0gdHlwZW9mIEJsb2IgPT09IFwiZnVuY3Rpb25cIiB8fFxuICAgICh0eXBlb2YgQmxvYiAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoQmxvYikgPT09IFwiW29iamVjdCBCbG9iQ29uc3RydWN0b3JdXCIpO1xuY29uc3Qgd2l0aE5hdGl2ZUFycmF5QnVmZmVyID0gdHlwZW9mIEFycmF5QnVmZmVyID09PSBcImZ1bmN0aW9uXCI7XG4vLyBBcnJheUJ1ZmZlci5pc1ZpZXcgbWV0aG9kIGlzIG5vdCBkZWZpbmVkIGluIElFMTBcbmNvbnN0IGlzVmlldyA9IChvYmopID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIEFycmF5QnVmZmVyLmlzVmlldyA9PT0gXCJmdW5jdGlvblwiXG4gICAgICAgID8gQXJyYXlCdWZmZXIuaXNWaWV3KG9iailcbiAgICAgICAgOiBvYmogJiYgb2JqLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyO1xufTtcbmNvbnN0IGVuY29kZVBhY2tldCA9ICh7IHR5cGUsIGRhdGEgfSwgc3VwcG9ydHNCaW5hcnksIGNhbGxiYWNrKSA9PiB7XG4gICAgaWYgKHdpdGhOYXRpdmVCbG9iICYmIGRhdGEgaW5zdGFuY2VvZiBCbG9iKSB7XG4gICAgICAgIGlmIChzdXBwb3J0c0JpbmFyeSkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGVuY29kZUJsb2JBc0Jhc2U2NChkYXRhLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAod2l0aE5hdGl2ZUFycmF5QnVmZmVyICYmXG4gICAgICAgIChkYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgfHwgaXNWaWV3KGRhdGEpKSkge1xuICAgICAgICBpZiAoc3VwcG9ydHNCaW5hcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhkYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGVCbG9iQXNCYXNlNjQobmV3IEJsb2IoW2RhdGFdKSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vIHBsYWluIHN0cmluZ1xuICAgIHJldHVybiBjYWxsYmFjayhQQUNLRVRfVFlQRVNbdHlwZV0gKyAoZGF0YSB8fCBcIlwiKSk7XG59O1xuY29uc3QgZW5jb2RlQmxvYkFzQmFzZTY0ID0gKGRhdGEsIGNhbGxiYWNrKSA9PiB7XG4gICAgY29uc3QgZmlsZVJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgZmlsZVJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmaWxlUmVhZGVyLnJlc3VsdC5zcGxpdChcIixcIilbMV07XG4gICAgICAgIGNhbGxiYWNrKFwiYlwiICsgKGNvbnRlbnQgfHwgXCJcIikpO1xuICAgIH07XG4gICAgcmV0dXJuIGZpbGVSZWFkZXIucmVhZEFzRGF0YVVSTChkYXRhKTtcbn07XG5mdW5jdGlvbiB0b0FycmF5KGRhdGEpIHtcbiAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGVsc2UgaWYgKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCwgZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG59XG5sZXQgVEVYVF9FTkNPREVSO1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZVBhY2tldFRvQmluYXJ5KHBhY2tldCwgY2FsbGJhY2spIHtcbiAgICBpZiAod2l0aE5hdGl2ZUJsb2IgJiYgcGFja2V0LmRhdGEgaW5zdGFuY2VvZiBCbG9iKSB7XG4gICAgICAgIHJldHVybiBwYWNrZXQuZGF0YS5hcnJheUJ1ZmZlcigpLnRoZW4odG9BcnJheSkudGhlbihjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHdpdGhOYXRpdmVBcnJheUJ1ZmZlciAmJlxuICAgICAgICAocGFja2V0LmRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlciB8fCBpc1ZpZXcocGFja2V0LmRhdGEpKSkge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2sodG9BcnJheShwYWNrZXQuZGF0YSkpO1xuICAgIH1cbiAgICBlbmNvZGVQYWNrZXQocGFja2V0LCBmYWxzZSwgKGVuY29kZWQpID0+IHtcbiAgICAgICAgaWYgKCFURVhUX0VOQ09ERVIpIHtcbiAgICAgICAgICAgIFRFWFRfRU5DT0RFUiA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKFRFWFRfRU5DT0RFUi5lbmNvZGUoZW5jb2RlZCkpO1xuICAgIH0pO1xufVxuZXhwb3J0IHsgZW5jb2RlUGFja2V0IH07XG4iLCIvLyBpbXBvcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NrZXRpby9iYXNlNjQtYXJyYXlidWZmZXJcbmNvbnN0IGNoYXJzID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuLy8gVXNlIGEgbG9va3VwIHRhYmxlIHRvIGZpbmQgdGhlIGluZGV4LlxuY29uc3QgbG9va3VwID0gdHlwZW9mIFVpbnQ4QXJyYXkgPT09ICd1bmRlZmluZWQnID8gW10gOiBuZXcgVWludDhBcnJheSgyNTYpO1xuZm9yIChsZXQgaSA9IDA7IGkgPCBjaGFycy5sZW5ndGg7IGkrKykge1xuICAgIGxvb2t1cFtjaGFycy5jaGFyQ29kZUF0KGkpXSA9IGk7XG59XG5leHBvcnQgY29uc3QgZW5jb2RlID0gKGFycmF5YnVmZmVyKSA9PiB7XG4gICAgbGV0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlidWZmZXIpLCBpLCBsZW4gPSBieXRlcy5sZW5ndGgsIGJhc2U2NCA9ICcnO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkgKz0gMykge1xuICAgICAgICBiYXNlNjQgKz0gY2hhcnNbYnl0ZXNbaV0gPj4gMl07XG4gICAgICAgIGJhc2U2NCArPSBjaGFyc1soKGJ5dGVzW2ldICYgMykgPDwgNCkgfCAoYnl0ZXNbaSArIDFdID4+IDQpXTtcbiAgICAgICAgYmFzZTY0ICs9IGNoYXJzWygoYnl0ZXNbaSArIDFdICYgMTUpIDw8IDIpIHwgKGJ5dGVzW2kgKyAyXSA+PiA2KV07XG4gICAgICAgIGJhc2U2NCArPSBjaGFyc1tieXRlc1tpICsgMl0gJiA2M107XG4gICAgfVxuICAgIGlmIChsZW4gJSAzID09PSAyKSB7XG4gICAgICAgIGJhc2U2NCA9IGJhc2U2NC5zdWJzdHJpbmcoMCwgYmFzZTY0Lmxlbmd0aCAtIDEpICsgJz0nO1xuICAgIH1cbiAgICBlbHNlIGlmIChsZW4gJSAzID09PSAxKSB7XG4gICAgICAgIGJhc2U2NCA9IGJhc2U2NC5zdWJzdHJpbmcoMCwgYmFzZTY0Lmxlbmd0aCAtIDIpICsgJz09JztcbiAgICB9XG4gICAgcmV0dXJuIGJhc2U2NDtcbn07XG5leHBvcnQgY29uc3QgZGVjb2RlID0gKGJhc2U2NCkgPT4ge1xuICAgIGxldCBidWZmZXJMZW5ndGggPSBiYXNlNjQubGVuZ3RoICogMC43NSwgbGVuID0gYmFzZTY0Lmxlbmd0aCwgaSwgcCA9IDAsIGVuY29kZWQxLCBlbmNvZGVkMiwgZW5jb2RlZDMsIGVuY29kZWQ0O1xuICAgIGlmIChiYXNlNjRbYmFzZTY0Lmxlbmd0aCAtIDFdID09PSAnPScpIHtcbiAgICAgICAgYnVmZmVyTGVuZ3RoLS07XG4gICAgICAgIGlmIChiYXNlNjRbYmFzZTY0Lmxlbmd0aCAtIDJdID09PSAnPScpIHtcbiAgICAgICAgICAgIGJ1ZmZlckxlbmd0aC0tO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGFycmF5YnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlckxlbmd0aCksIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXlidWZmZXIpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgICAgICBlbmNvZGVkMSA9IGxvb2t1cFtiYXNlNjQuY2hhckNvZGVBdChpKV07XG4gICAgICAgIGVuY29kZWQyID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAxKV07XG4gICAgICAgIGVuY29kZWQzID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAyKV07XG4gICAgICAgIGVuY29kZWQ0ID0gbG9va3VwW2Jhc2U2NC5jaGFyQ29kZUF0KGkgKyAzKV07XG4gICAgICAgIGJ5dGVzW3ArK10gPSAoZW5jb2RlZDEgPDwgMikgfCAoZW5jb2RlZDIgPj4gNCk7XG4gICAgICAgIGJ5dGVzW3ArK10gPSAoKGVuY29kZWQyICYgMTUpIDw8IDQpIHwgKGVuY29kZWQzID4+IDIpO1xuICAgICAgICBieXRlc1twKytdID0gKChlbmNvZGVkMyAmIDMpIDw8IDYpIHwgKGVuY29kZWQ0ICYgNjMpO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXlidWZmZXI7XG59O1xuIiwiaW1wb3J0IHsgRVJST1JfUEFDS0VULCBQQUNLRVRfVFlQRVNfUkVWRVJTRSwgfSBmcm9tIFwiLi9jb21tb25zLmpzXCI7XG5pbXBvcnQgeyBkZWNvZGUgfSBmcm9tIFwiLi9jb250cmliL2Jhc2U2NC1hcnJheWJ1ZmZlci5qc1wiO1xuY29uc3Qgd2l0aE5hdGl2ZUFycmF5QnVmZmVyID0gdHlwZW9mIEFycmF5QnVmZmVyID09PSBcImZ1bmN0aW9uXCI7XG5leHBvcnQgY29uc3QgZGVjb2RlUGFja2V0ID0gKGVuY29kZWRQYWNrZXQsIGJpbmFyeVR5cGUpID0+IHtcbiAgICBpZiAodHlwZW9mIGVuY29kZWRQYWNrZXQgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgZGF0YTogbWFwQmluYXJ5KGVuY29kZWRQYWNrZXQsIGJpbmFyeVR5cGUpLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25zdCB0eXBlID0gZW5jb2RlZFBhY2tldC5jaGFyQXQoMCk7XG4gICAgaWYgKHR5cGUgPT09IFwiYlwiKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgIGRhdGE6IGRlY29kZUJhc2U2NFBhY2tldChlbmNvZGVkUGFja2V0LnN1YnN0cmluZygxKSwgYmluYXJ5VHlwZSksXG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbnN0IHBhY2tldFR5cGUgPSBQQUNLRVRfVFlQRVNfUkVWRVJTRVt0eXBlXTtcbiAgICBpZiAoIXBhY2tldFR5cGUpIHtcbiAgICAgICAgcmV0dXJuIEVSUk9SX1BBQ0tFVDtcbiAgICB9XG4gICAgcmV0dXJuIGVuY29kZWRQYWNrZXQubGVuZ3RoID4gMVxuICAgICAgICA/IHtcbiAgICAgICAgICAgIHR5cGU6IFBBQ0tFVF9UWVBFU19SRVZFUlNFW3R5cGVdLFxuICAgICAgICAgICAgZGF0YTogZW5jb2RlZFBhY2tldC5zdWJzdHJpbmcoMSksXG4gICAgICAgIH1cbiAgICAgICAgOiB7XG4gICAgICAgICAgICB0eXBlOiBQQUNLRVRfVFlQRVNfUkVWRVJTRVt0eXBlXSxcbiAgICAgICAgfTtcbn07XG5jb25zdCBkZWNvZGVCYXNlNjRQYWNrZXQgPSAoZGF0YSwgYmluYXJ5VHlwZSkgPT4ge1xuICAgIGlmICh3aXRoTmF0aXZlQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgY29uc3QgZGVjb2RlZCA9IGRlY29kZShkYXRhKTtcbiAgICAgICAgcmV0dXJuIG1hcEJpbmFyeShkZWNvZGVkLCBiaW5hcnlUeXBlKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiB7IGJhc2U2NDogdHJ1ZSwgZGF0YSB9OyAvLyBmYWxsYmFjayBmb3Igb2xkIGJyb3dzZXJzXG4gICAgfVxufTtcbmNvbnN0IG1hcEJpbmFyeSA9IChkYXRhLCBiaW5hcnlUeXBlKSA9PiB7XG4gICAgc3dpdGNoIChiaW5hcnlUeXBlKSB7XG4gICAgICAgIGNhc2UgXCJibG9iXCI6XG4gICAgICAgICAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIEJsb2IpIHtcbiAgICAgICAgICAgICAgICAvLyBmcm9tIFdlYlNvY2tldCArIGJpbmFyeVR5cGUgXCJibG9iXCJcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGZyb20gSFRUUCBsb25nLXBvbGxpbmcgb3IgV2ViVHJhbnNwb3J0XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBCbG9iKFtkYXRhXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIGNhc2UgXCJhcnJheWJ1ZmZlclwiOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIC8vIGZyb20gSFRUUCBsb25nLXBvbGxpbmcgKGJhc2U2NCkgb3IgV2ViU29ja2V0ICsgYmluYXJ5VHlwZSBcImFycmF5YnVmZmVyXCJcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGZyb20gV2ViVHJhbnNwb3J0IChVaW50OEFycmF5KVxuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhLmJ1ZmZlcjtcbiAgICAgICAgICAgIH1cbiAgICB9XG59O1xuIiwiaW1wb3J0IHsgZW5jb2RlUGFja2V0LCBlbmNvZGVQYWNrZXRUb0JpbmFyeSB9IGZyb20gXCIuL2VuY29kZVBhY2tldC5qc1wiO1xuaW1wb3J0IHsgZGVjb2RlUGFja2V0IH0gZnJvbSBcIi4vZGVjb2RlUGFja2V0LmpzXCI7XG5pbXBvcnQgeyBFUlJPUl9QQUNLRVQsIH0gZnJvbSBcIi4vY29tbW9ucy5qc1wiO1xuY29uc3QgU0VQQVJBVE9SID0gU3RyaW5nLmZyb21DaGFyQ29kZSgzMCk7IC8vIHNlZSBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9EZWxpbWl0ZXIjQVNDSUlfZGVsaW1pdGVkX3RleHRcbmNvbnN0IGVuY29kZVBheWxvYWQgPSAocGFja2V0cywgY2FsbGJhY2spID0+IHtcbiAgICAvLyBzb21lIHBhY2tldHMgbWF5IGJlIGFkZGVkIHRvIHRoZSBhcnJheSB3aGlsZSBlbmNvZGluZywgc28gdGhlIGluaXRpYWwgbGVuZ3RoIG11c3QgYmUgc2F2ZWRcbiAgICBjb25zdCBsZW5ndGggPSBwYWNrZXRzLmxlbmd0aDtcbiAgICBjb25zdCBlbmNvZGVkUGFja2V0cyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgcGFja2V0cy5mb3JFYWNoKChwYWNrZXQsIGkpID0+IHtcbiAgICAgICAgLy8gZm9yY2UgYmFzZTY0IGVuY29kaW5nIGZvciBiaW5hcnkgcGFja2V0c1xuICAgICAgICBlbmNvZGVQYWNrZXQocGFja2V0LCBmYWxzZSwgKGVuY29kZWRQYWNrZXQpID0+IHtcbiAgICAgICAgICAgIGVuY29kZWRQYWNrZXRzW2ldID0gZW5jb2RlZFBhY2tldDtcbiAgICAgICAgICAgIGlmICgrK2NvdW50ID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlbmNvZGVkUGFja2V0cy5qb2luKFNFUEFSQVRPUikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KTtcbn07XG5jb25zdCBkZWNvZGVQYXlsb2FkID0gKGVuY29kZWRQYXlsb2FkLCBiaW5hcnlUeXBlKSA9PiB7XG4gICAgY29uc3QgZW5jb2RlZFBhY2tldHMgPSBlbmNvZGVkUGF5bG9hZC5zcGxpdChTRVBBUkFUT1IpO1xuICAgIGNvbnN0IHBhY2tldHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVuY29kZWRQYWNrZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGRlY29kZWRQYWNrZXQgPSBkZWNvZGVQYWNrZXQoZW5jb2RlZFBhY2tldHNbaV0sIGJpbmFyeVR5cGUpO1xuICAgICAgICBwYWNrZXRzLnB1c2goZGVjb2RlZFBhY2tldCk7XG4gICAgICAgIGlmIChkZWNvZGVkUGFja2V0LnR5cGUgPT09IFwiZXJyb3JcIikge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHBhY2tldHM7XG59O1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhY2tldEVuY29kZXJTdHJlYW0oKSB7XG4gICAgcmV0dXJuIG5ldyBUcmFuc2Zvcm1TdHJlYW0oe1xuICAgICAgICB0cmFuc2Zvcm0ocGFja2V0LCBjb250cm9sbGVyKSB7XG4gICAgICAgICAgICBlbmNvZGVQYWNrZXRUb0JpbmFyeShwYWNrZXQsIChlbmNvZGVkUGFja2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF5bG9hZExlbmd0aCA9IGVuY29kZWRQYWNrZXQubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGxldCBoZWFkZXI7XG4gICAgICAgICAgICAgICAgLy8gaW5zcGlyZWQgYnkgdGhlIFdlYlNvY2tldCBmb3JtYXQ6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XZWJTb2NrZXRzX0FQSS9Xcml0aW5nX1dlYlNvY2tldF9zZXJ2ZXJzI2RlY29kaW5nX3BheWxvYWRfbGVuZ3RoXG4gICAgICAgICAgICAgICAgaWYgKHBheWxvYWRMZW5ndGggPCAxMjYpIHtcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyID0gbmV3IFVpbnQ4QXJyYXkoMSk7XG4gICAgICAgICAgICAgICAgICAgIG5ldyBEYXRhVmlldyhoZWFkZXIuYnVmZmVyKS5zZXRVaW50OCgwLCBwYXlsb2FkTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAocGF5bG9hZExlbmd0aCA8IDY1NTM2KSB7XG4gICAgICAgICAgICAgICAgICAgIGhlYWRlciA9IG5ldyBVaW50OEFycmF5KDMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGhlYWRlci5idWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB2aWV3LnNldFVpbnQ4KDAsIDEyNik7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcuc2V0VWludDE2KDEsIHBheWxvYWRMZW5ndGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyID0gbmV3IFVpbnQ4QXJyYXkoOSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZpZXcgPSBuZXcgRGF0YVZpZXcoaGVhZGVyLmJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIHZpZXcuc2V0VWludDgoMCwgMTI3KTtcbiAgICAgICAgICAgICAgICAgICAgdmlldy5zZXRCaWdVaW50NjQoMSwgQmlnSW50KHBheWxvYWRMZW5ndGgpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgYml0IGluZGljYXRlcyB3aGV0aGVyIHRoZSBwYXlsb2FkIGlzIHBsYWluIHRleHQgKDApIG9yIGJpbmFyeSAoMSlcbiAgICAgICAgICAgICAgICBpZiAocGFja2V0LmRhdGEgJiYgdHlwZW9mIHBhY2tldC5kYXRhICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclswXSB8PSAweDgwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUoaGVhZGVyKTtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUoZW5jb2RlZFBhY2tldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICB9KTtcbn1cbmxldCBURVhUX0RFQ09ERVI7XG5mdW5jdGlvbiB0b3RhbExlbmd0aChjaHVua3MpIHtcbiAgICByZXR1cm4gY2h1bmtzLnJlZHVjZSgoYWNjLCBjaHVuaykgPT4gYWNjICsgY2h1bmsubGVuZ3RoLCAwKTtcbn1cbmZ1bmN0aW9uIGNvbmNhdENodW5rcyhjaHVua3MsIHNpemUpIHtcbiAgICBpZiAoY2h1bmtzWzBdLmxlbmd0aCA9PT0gc2l6ZSkge1xuICAgICAgICByZXR1cm4gY2h1bmtzLnNoaWZ0KCk7XG4gICAgfVxuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHNpemUpO1xuICAgIGxldCBqID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkrKykge1xuICAgICAgICBidWZmZXJbaV0gPSBjaHVua3NbMF1baisrXTtcbiAgICAgICAgaWYgKGogPT09IGNodW5rc1swXS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNodW5rcy5zaGlmdCgpO1xuICAgICAgICAgICAgaiA9IDA7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNodW5rcy5sZW5ndGggJiYgaiA8IGNodW5rc1swXS5sZW5ndGgpIHtcbiAgICAgICAgY2h1bmtzWzBdID0gY2h1bmtzWzBdLnNsaWNlKGopO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhY2tldERlY29kZXJTdHJlYW0obWF4UGF5bG9hZCwgYmluYXJ5VHlwZSkge1xuICAgIGlmICghVEVYVF9ERUNPREVSKSB7XG4gICAgICAgIFRFWFRfREVDT0RFUiA9IG5ldyBUZXh0RGVjb2RlcigpO1xuICAgIH1cbiAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICBsZXQgc3RhdGUgPSAwIC8qIFN0YXRlLlJFQURfSEVBREVSICovO1xuICAgIGxldCBleHBlY3RlZExlbmd0aCA9IC0xO1xuICAgIGxldCBpc0JpbmFyeSA9IGZhbHNlO1xuICAgIHJldHVybiBuZXcgVHJhbnNmb3JtU3RyZWFtKHtcbiAgICAgICAgdHJhbnNmb3JtKGNodW5rLCBjb250cm9sbGVyKSB7XG4gICAgICAgICAgICBjaHVua3MucHVzaChjaHVuayk7XG4gICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0ZSA9PT0gMCAvKiBTdGF0ZS5SRUFEX0hFQURFUiAqLykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodG90YWxMZW5ndGgoY2h1bmtzKSA8IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IGNvbmNhdENodW5rcyhjaHVua3MsIDEpO1xuICAgICAgICAgICAgICAgICAgICBpc0JpbmFyeSA9IChoZWFkZXJbMF0gJiAweDgwKSA9PT0gMHg4MDtcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRMZW5ndGggPSBoZWFkZXJbMF0gJiAweDdmO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXhwZWN0ZWRMZW5ndGggPCAxMjYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlID0gMyAvKiBTdGF0ZS5SRUFEX1BBWUxPQUQgKi87XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoZXhwZWN0ZWRMZW5ndGggPT09IDEyNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSAxIC8qIFN0YXRlLlJFQURfRVhURU5ERURfTEVOR1RIXzE2ICovO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSAyIC8qIFN0YXRlLlJFQURfRVhURU5ERURfTEVOR1RIXzY0ICovO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHN0YXRlID09PSAxIC8qIFN0YXRlLlJFQURfRVhURU5ERURfTEVOR1RIXzE2ICovKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b3RhbExlbmd0aChjaHVua3MpIDwgMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyQXJyYXkgPSBjb25jYXRDaHVua3MoY2h1bmtzLCAyKTtcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRMZW5ndGggPSBuZXcgRGF0YVZpZXcoaGVhZGVyQXJyYXkuYnVmZmVyLCBoZWFkZXJBcnJheS5ieXRlT2Zmc2V0LCBoZWFkZXJBcnJheS5sZW5ndGgpLmdldFVpbnQxNigwKTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSAzIC8qIFN0YXRlLlJFQURfUEFZTE9BRCAqLztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoc3RhdGUgPT09IDIgLyogU3RhdGUuUkVBRF9FWFRFTkRFRF9MRU5HVEhfNjQgKi8pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvdGFsTGVuZ3RoKGNodW5rcykgPCA4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJBcnJheSA9IGNvbmNhdENodW5rcyhjaHVua3MsIDgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2aWV3ID0gbmV3IERhdGFWaWV3KGhlYWRlckFycmF5LmJ1ZmZlciwgaGVhZGVyQXJyYXkuYnl0ZU9mZnNldCwgaGVhZGVyQXJyYXkubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbiA9IHZpZXcuZ2V0VWludDMyKDApO1xuICAgICAgICAgICAgICAgICAgICBpZiAobiA+IE1hdGgucG93KDIsIDUzIC0gMzIpIC0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIG1heGltdW0gc2FmZSBpbnRlZ2VyIGluIEphdmFTY3JpcHQgaXMgMl41MyAtIDFcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShFUlJPUl9QQUNLRVQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRMZW5ndGggPSBuICogTWF0aC5wb3coMiwgMzIpICsgdmlldy5nZXRVaW50MzIoNCk7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlID0gMyAvKiBTdGF0ZS5SRUFEX1BBWUxPQUQgKi87XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAodG90YWxMZW5ndGgoY2h1bmtzKSA8IGV4cGVjdGVkTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gY29uY2F0Q2h1bmtzKGNodW5rcywgZXhwZWN0ZWRMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUoZGVjb2RlUGFja2V0KGlzQmluYXJ5ID8gZGF0YSA6IFRFWFRfREVDT0RFUi5kZWNvZGUoZGF0YSksIGJpbmFyeVR5cGUpKTtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUgPSAwIC8qIFN0YXRlLlJFQURfSEVBREVSICovO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZXhwZWN0ZWRMZW5ndGggPT09IDAgfHwgZXhwZWN0ZWRMZW5ndGggPiBtYXhQYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShFUlJPUl9QQUNLRVQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgfSk7XG59XG5leHBvcnQgY29uc3QgcHJvdG9jb2wgPSA0O1xuZXhwb3J0IHsgZW5jb2RlUGFja2V0LCBlbmNvZGVQYXlsb2FkLCBkZWNvZGVQYWNrZXQsIGRlY29kZVBheWxvYWQsIH07XG4iLCJcbi8qKlxuICogRXhwb3NlIGBFbWl0dGVyYC5cbiAqL1xuXG5leHBvcnRzLkVtaXR0ZXIgPSBFbWl0dGVyO1xuXG4vKipcbiAqIEluaXRpYWxpemUgYSBuZXcgYEVtaXR0ZXJgLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcbiAgaWYgKG9iaikgcmV0dXJuIG1peGluKG9iaik7XG59XG5cbi8qKlxuICogTWl4aW4gdGhlIGVtaXR0ZXIgcHJvcGVydGllcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBtaXhpbihvYmopIHtcbiAgZm9yICh2YXIga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XG4gICAgb2JqW2tleV0gPSBFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xuICB9XG4gIHJldHVybiBvYmo7XG59XG5cbi8qKlxuICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5vbiA9XG5FbWl0dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuICAodGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF0gfHwgW10pXG4gICAgLnB1c2goZm4pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBhbiBgZXZlbnRgIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGEgc2luZ2xlXG4gKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pe1xuICBmdW5jdGlvbiBvbigpIHtcbiAgICB0aGlzLm9mZihldmVudCwgb24pO1xuICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICBvbi5mbiA9IGZuO1xuICB0aGlzLm9uKGV2ZW50LCBvbik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7RW1pdHRlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUub2ZmID1cbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID1cbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9XG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXG4gIC8vIGFsbFxuICBpZiAoMCA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fY2FsbGJhY2tzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBzcGVjaWZpYyBldmVudFxuICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcbiAgaWYgKCFjYWxsYmFja3MpIHJldHVybiB0aGlzO1xuXG4gIC8vIHJlbW92ZSBhbGwgaGFuZGxlcnNcbiAgaWYgKDEgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gcmVtb3ZlIHNwZWNpZmljIGhhbmRsZXJcbiAgdmFyIGNiO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgIGNiID0gY2FsbGJhY2tzW2ldO1xuICAgIGlmIChjYiA9PT0gZm4gfHwgY2IuZm4gPT09IGZuKSB7XG4gICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIGV2ZW50IHNwZWNpZmljIGFycmF5cyBmb3IgZXZlbnQgdHlwZXMgdGhhdCBub1xuICAvLyBvbmUgaXMgc3Vic2NyaWJlZCBmb3IgdG8gYXZvaWQgbWVtb3J5IGxlYWsuXG4gIGlmIChjYWxsYmFja3MubGVuZ3RoID09PSAwKSB7XG4gICAgZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1snJCcgKyBldmVudF07XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRW1pdCBgZXZlbnRgIHdpdGggdGhlIGdpdmVuIGFyZ3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge01peGVkfSAuLi5cbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXG4gIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKVxuICAgICwgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzWyckJyArIGV2ZW50XTtcblxuICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICB9XG5cbiAgaWYgKGNhbGxiYWNrcykge1xuICAgIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICBjYWxsYmFja3NbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBhbGlhcyB1c2VkIGZvciByZXNlcnZlZCBldmVudHMgKHByb3RlY3RlZCBtZXRob2QpXG5FbWl0dGVyLnByb3RvdHlwZS5lbWl0UmVzZXJ2ZWQgPSBFbWl0dGVyLnByb3RvdHlwZS5lbWl0O1xuXG4vKipcbiAqIFJldHVybiBhcnJheSBvZiBjYWxsYmFja3MgZm9yIGBldmVudGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24oZXZlbnQpe1xuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG4gIHJldHVybiB0aGlzLl9jYWxsYmFja3NbJyQnICsgZXZlbnRdIHx8IFtdO1xufTtcblxuLyoqXG4gKiBDaGVjayBpZiB0aGlzIGVtaXR0ZXIgaGFzIGBldmVudGAgaGFuZGxlcnMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XG4gIHJldHVybiAhISB0aGlzLmxpc3RlbmVycyhldmVudCkubGVuZ3RoO1xufTtcbiIsImV4cG9ydCBjb25zdCBuZXh0VGljayA9ICgoKSA9PiB7XG4gICAgY29uc3QgaXNQcm9taXNlQXZhaWxhYmxlID0gdHlwZW9mIFByb21pc2UgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgUHJvbWlzZS5yZXNvbHZlID09PSBcImZ1bmN0aW9uXCI7XG4gICAgaWYgKGlzUHJvbWlzZUF2YWlsYWJsZSkge1xuICAgICAgICByZXR1cm4gKGNiKSA9PiBQcm9taXNlLnJlc29sdmUoKS50aGVuKGNiKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiAoY2IsIHNldFRpbWVvdXRGbikgPT4gc2V0VGltZW91dEZuKGNiLCAwKTtcbiAgICB9XG59KSgpO1xuZXhwb3J0IGNvbnN0IGdsb2JhbFRoaXNTaGltID0gKCgpID0+IHtcbiAgICBpZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgcmV0dXJuIHdpbmRvdztcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHJldHVybiBGdW5jdGlvbihcInJldHVybiB0aGlzXCIpKCk7XG4gICAgfVxufSkoKTtcbmV4cG9ydCBjb25zdCBkZWZhdWx0QmluYXJ5VHlwZSA9IFwiYXJyYXlidWZmZXJcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb29raWVKYXIoKSB7IH1cbiIsImltcG9ydCB7IGdsb2JhbFRoaXNTaGltIGFzIGdsb2JhbFRoaXMgfSBmcm9tIFwiLi9nbG9iYWxzLm5vZGUuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBwaWNrKG9iaiwgLi4uYXR0cikge1xuICAgIHJldHVybiBhdHRyLnJlZHVjZSgoYWNjLCBrKSA9PiB7XG4gICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoaykpIHtcbiAgICAgICAgICAgIGFjY1trXSA9IG9ialtrXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcbn1cbi8vIEtlZXAgYSByZWZlcmVuY2UgdG8gdGhlIHJlYWwgdGltZW91dCBmdW5jdGlvbnMgc28gdGhleSBjYW4gYmUgdXNlZCB3aGVuIG92ZXJyaWRkZW5cbmNvbnN0IE5BVElWRV9TRVRfVElNRU9VVCA9IGdsb2JhbFRoaXMuc2V0VGltZW91dDtcbmNvbnN0IE5BVElWRV9DTEVBUl9USU1FT1VUID0gZ2xvYmFsVGhpcy5jbGVhclRpbWVvdXQ7XG5leHBvcnQgZnVuY3Rpb24gaW5zdGFsbFRpbWVyRnVuY3Rpb25zKG9iaiwgb3B0cykge1xuICAgIGlmIChvcHRzLnVzZU5hdGl2ZVRpbWVycykge1xuICAgICAgICBvYmouc2V0VGltZW91dEZuID0gTkFUSVZFX1NFVF9USU1FT1VULmJpbmQoZ2xvYmFsVGhpcyk7XG4gICAgICAgIG9iai5jbGVhclRpbWVvdXRGbiA9IE5BVElWRV9DTEVBUl9USU1FT1VULmJpbmQoZ2xvYmFsVGhpcyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBvYmouc2V0VGltZW91dEZuID0gZ2xvYmFsVGhpcy5zZXRUaW1lb3V0LmJpbmQoZ2xvYmFsVGhpcyk7XG4gICAgICAgIG9iai5jbGVhclRpbWVvdXRGbiA9IGdsb2JhbFRoaXMuY2xlYXJUaW1lb3V0LmJpbmQoZ2xvYmFsVGhpcyk7XG4gICAgfVxufVxuLy8gYmFzZTY0IGVuY29kZWQgYnVmZmVycyBhcmUgYWJvdXQgMzMlIGJpZ2dlciAoaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvQmFzZTY0KVxuY29uc3QgQkFTRTY0X09WRVJIRUFEID0gMS4zMztcbi8vIHdlIGNvdWxkIGFsc28gaGF2ZSB1c2VkIGBuZXcgQmxvYihbb2JqXSkuc2l6ZWAsIGJ1dCBpdCBpc24ndCBzdXBwb3J0ZWQgaW4gSUU5XG5leHBvcnQgZnVuY3Rpb24gYnl0ZUxlbmd0aChvYmopIHtcbiAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICByZXR1cm4gdXRmOExlbmd0aChvYmopO1xuICAgIH1cbiAgICAvLyBhcnJheWJ1ZmZlciBvciBibG9iXG4gICAgcmV0dXJuIE1hdGguY2VpbCgob2JqLmJ5dGVMZW5ndGggfHwgb2JqLnNpemUpICogQkFTRTY0X09WRVJIRUFEKTtcbn1cbmZ1bmN0aW9uIHV0ZjhMZW5ndGgoc3RyKSB7XG4gICAgbGV0IGMgPSAwLCBsZW5ndGggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwLCBsID0gc3RyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIGlmIChjIDwgMHg4MCkge1xuICAgICAgICAgICAgbGVuZ3RoICs9IDE7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoYyA8IDB4ODAwKSB7XG4gICAgICAgICAgICBsZW5ndGggKz0gMjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChjIDwgMHhkODAwIHx8IGMgPj0gMHhlMDAwKSB7XG4gICAgICAgICAgICBsZW5ndGggKz0gMztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGxlbmd0aCArPSA0O1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBsZW5ndGg7XG59XG4vKipcbiAqIEdlbmVyYXRlcyBhIHJhbmRvbSA4LWNoYXJhY3RlcnMgc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmFuZG9tU3RyaW5nKCkge1xuICAgIHJldHVybiAoRGF0ZS5ub3coKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDMpICtcbiAgICAgICAgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDIsIDUpKTtcbn1cbiIsIi8vIGltcG9ydGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2dhbGtuL3F1ZXJ5c3RyaW5nXG4vKipcbiAqIENvbXBpbGVzIGEgcXVlcnlzdHJpbmdcbiAqIFJldHVybnMgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge09iamVjdH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW5jb2RlKG9iaikge1xuICAgIGxldCBzdHIgPSAnJztcbiAgICBmb3IgKGxldCBpIGluIG9iaikge1xuICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgICAgICBpZiAoc3RyLmxlbmd0aClcbiAgICAgICAgICAgICAgICBzdHIgKz0gJyYnO1xuICAgICAgICAgICAgc3RyICs9IGVuY29kZVVSSUNvbXBvbmVudChpKSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChvYmpbaV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzdHI7XG59XG4vKipcbiAqIFBhcnNlcyBhIHNpbXBsZSBxdWVyeXN0cmluZyBpbnRvIGFuIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBxc1xuICogQGFwaSBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGUocXMpIHtcbiAgICBsZXQgcXJ5ID0ge307XG4gICAgbGV0IHBhaXJzID0gcXMuc3BsaXQoJyYnKTtcbiAgICBmb3IgKGxldCBpID0gMCwgbCA9IHBhaXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBsZXQgcGFpciA9IHBhaXJzW2ldLnNwbGl0KCc9Jyk7XG4gICAgICAgIHFyeVtkZWNvZGVVUklDb21wb25lbnQocGFpclswXSldID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhaXJbMV0pO1xuICAgIH1cbiAgICByZXR1cm4gcXJ5O1xufVxuIiwiaW1wb3J0IHsgZGVjb2RlUGFja2V0IH0gZnJvbSBcImVuZ2luZS5pby1wYXJzZXJcIjtcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tIFwiQHNvY2tldC5pby9jb21wb25lbnQtZW1pdHRlclwiO1xuaW1wb3J0IHsgaW5zdGFsbFRpbWVyRnVuY3Rpb25zIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgZW5jb2RlIH0gZnJvbSBcIi4vY29udHJpYi9wYXJzZXFzLmpzXCI7XG5leHBvcnQgY2xhc3MgVHJhbnNwb3J0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gICAgY29uc3RydWN0b3IocmVhc29uLCBkZXNjcmlwdGlvbiwgY29udGV4dCkge1xuICAgICAgICBzdXBlcihyZWFzb24pO1xuICAgICAgICB0aGlzLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gICAgICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gICAgICAgIHRoaXMudHlwZSA9IFwiVHJhbnNwb3J0RXJyb3JcIjtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVHJhbnNwb3J0IGV4dGVuZHMgRW1pdHRlciB7XG4gICAgLyoqXG4gICAgICogVHJhbnNwb3J0IGFic3RyYWN0IGNvbnN0cnVjdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdHMgLSBvcHRpb25zXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuICAgICAgICBpbnN0YWxsVGltZXJGdW5jdGlvbnModGhpcywgb3B0cyk7XG4gICAgICAgIHRoaXMub3B0cyA9IG9wdHM7XG4gICAgICAgIHRoaXMucXVlcnkgPSBvcHRzLnF1ZXJ5O1xuICAgICAgICB0aGlzLnNvY2tldCA9IG9wdHMuc29ja2V0O1xuICAgICAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gIW9wdHMuZm9yY2VCYXNlNjQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEVtaXRzIGFuIGVycm9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvblxuICAgICAqIEBwYXJhbSBkZXNjcmlwdGlvblxuICAgICAqIEBwYXJhbSBjb250ZXh0IC0gdGhlIGVycm9yIGNvbnRleHRcbiAgICAgKiBAcmV0dXJuIHtUcmFuc3BvcnR9IGZvciBjaGFpbmluZ1xuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKi9cbiAgICBvbkVycm9yKHJlYXNvbiwgZGVzY3JpcHRpb24sIGNvbnRleHQpIHtcbiAgICAgICAgc3VwZXIuZW1pdFJlc2VydmVkKFwiZXJyb3JcIiwgbmV3IFRyYW5zcG9ydEVycm9yKHJlYXNvbiwgZGVzY3JpcHRpb24sIGNvbnRleHQpKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE9wZW5zIHRoZSB0cmFuc3BvcnQuXG4gICAgICovXG4gICAgb3BlbigpIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJvcGVuaW5nXCI7XG4gICAgICAgIHRoaXMuZG9PcGVuKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIHRyYW5zcG9ydC5cbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gXCJvcGVuaW5nXCIgfHwgdGhpcy5yZWFkeVN0YXRlID09PSBcIm9wZW5cIikge1xuICAgICAgICAgICAgdGhpcy5kb0Nsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLm9uQ2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2VuZHMgbXVsdGlwbGUgcGFja2V0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHNcbiAgICAgKi9cbiAgICBzZW5kKHBhY2tldHMpIHtcbiAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gXCJvcGVuXCIpIHtcbiAgICAgICAgICAgIHRoaXMud3JpdGUocGFja2V0cyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyB0aGlzIG1pZ2h0IGhhcHBlbiBpZiB0aGUgdHJhbnNwb3J0IHdhcyBzaWxlbnRseSBjbG9zZWQgaW4gdGhlIGJlZm9yZXVubG9hZCBldmVudCBoYW5kbGVyXG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gb3BlblxuICAgICAqXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIG9uT3BlbigpIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJvcGVuXCI7XG4gICAgICAgIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuICAgICAgICBzdXBlci5lbWl0UmVzZXJ2ZWQoXCJvcGVuXCIpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2l0aCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGRhdGFcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgb25EYXRhKGRhdGEpIHtcbiAgICAgICAgY29uc3QgcGFja2V0ID0gZGVjb2RlUGFja2V0KGRhdGEsIHRoaXMuc29ja2V0LmJpbmFyeVR5cGUpO1xuICAgICAgICB0aGlzLm9uUGFja2V0KHBhY2tldCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aXRoIGEgZGVjb2RlZCBwYWNrZXQuXG4gICAgICpcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgb25QYWNrZXQocGFja2V0KSB7XG4gICAgICAgIHN1cGVyLmVtaXRSZXNlcnZlZChcInBhY2tldFwiLCBwYWNrZXQpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgdXBvbiBjbG9zZS5cbiAgICAgKlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKi9cbiAgICBvbkNsb3NlKGRldGFpbHMpIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJjbG9zZWRcIjtcbiAgICAgICAgc3VwZXIuZW1pdFJlc2VydmVkKFwiY2xvc2VcIiwgZGV0YWlscyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFBhdXNlcyB0aGUgdHJhbnNwb3J0LCBpbiBvcmRlciBub3QgdG8gbG9zZSBwYWNrZXRzIGR1cmluZyBhbiB1cGdyYWRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIG9uUGF1c2VcbiAgICAgKi9cbiAgICBwYXVzZShvblBhdXNlKSB7IH1cbiAgICBjcmVhdGVVcmkoc2NoZW1hLCBxdWVyeSA9IHt9KSB7XG4gICAgICAgIHJldHVybiAoc2NoZW1hICtcbiAgICAgICAgICAgIFwiOi8vXCIgK1xuICAgICAgICAgICAgdGhpcy5faG9zdG5hbWUoKSArXG4gICAgICAgICAgICB0aGlzLl9wb3J0KCkgK1xuICAgICAgICAgICAgdGhpcy5vcHRzLnBhdGggK1xuICAgICAgICAgICAgdGhpcy5fcXVlcnkocXVlcnkpKTtcbiAgICB9XG4gICAgX2hvc3RuYW1lKCkge1xuICAgICAgICBjb25zdCBob3N0bmFtZSA9IHRoaXMub3B0cy5ob3N0bmFtZTtcbiAgICAgICAgcmV0dXJuIGhvc3RuYW1lLmluZGV4T2YoXCI6XCIpID09PSAtMSA/IGhvc3RuYW1lIDogXCJbXCIgKyBob3N0bmFtZSArIFwiXVwiO1xuICAgIH1cbiAgICBfcG9ydCgpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0cy5wb3J0ICYmXG4gICAgICAgICAgICAoKHRoaXMub3B0cy5zZWN1cmUgJiYgTnVtYmVyKHRoaXMub3B0cy5wb3J0KSAhPT0gNDQzKSB8fFxuICAgICAgICAgICAgICAgICghdGhpcy5vcHRzLnNlY3VyZSAmJiBOdW1iZXIodGhpcy5vcHRzLnBvcnQpICE9PSA4MCkpKSB7XG4gICAgICAgICAgICByZXR1cm4gXCI6XCIgKyB0aGlzLm9wdHMucG9ydDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBcIlwiO1xuICAgICAgICB9XG4gICAgfVxuICAgIF9xdWVyeShxdWVyeSkge1xuICAgICAgICBjb25zdCBlbmNvZGVkUXVlcnkgPSBlbmNvZGUocXVlcnkpO1xuICAgICAgICByZXR1cm4gZW5jb2RlZFF1ZXJ5Lmxlbmd0aCA/IFwiP1wiICsgZW5jb2RlZFF1ZXJ5IDogXCJcIjtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBUcmFuc3BvcnQgfSBmcm9tIFwiLi4vdHJhbnNwb3J0LmpzXCI7XG5pbXBvcnQgeyByYW5kb21TdHJpbmcgfSBmcm9tIFwiLi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgZW5jb2RlUGF5bG9hZCwgZGVjb2RlUGF5bG9hZCB9IGZyb20gXCJlbmdpbmUuaW8tcGFyc2VyXCI7XG5leHBvcnQgY2xhc3MgUG9sbGluZyBleHRlbmRzIFRyYW5zcG9ydCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKC4uLmFyZ3VtZW50cyk7XG4gICAgICAgIHRoaXMuX3BvbGxpbmcgPSBmYWxzZTtcbiAgICB9XG4gICAgZ2V0IG5hbWUoKSB7XG4gICAgICAgIHJldHVybiBcInBvbGxpbmdcIjtcbiAgICB9XG4gICAgLyoqXG4gICAgICogT3BlbnMgdGhlIHNvY2tldCAodHJpZ2dlcnMgcG9sbGluZykuIFdlIHdyaXRlIGEgUElORyBtZXNzYWdlIHRvIGRldGVybWluZVxuICAgICAqIHdoZW4gdGhlIHRyYW5zcG9ydCBpcyBvcGVuLlxuICAgICAqXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIGRvT3BlbigpIHtcbiAgICAgICAgdGhpcy5fcG9sbCgpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgcG9sbGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IG9uUGF1c2UgLSBjYWxsYmFjayB1cG9uIGJ1ZmZlcnMgYXJlIGZsdXNoZWQgYW5kIHRyYW5zcG9ydCBpcyBwYXVzZWRcbiAgICAgKiBAcGFja2FnZVxuICAgICAqL1xuICAgIHBhdXNlKG9uUGF1c2UpIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJwYXVzaW5nXCI7XG4gICAgICAgIGNvbnN0IHBhdXNlID0gKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJwYXVzZWRcIjtcbiAgICAgICAgICAgIG9uUGF1c2UoKTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHRoaXMuX3BvbGxpbmcgfHwgIXRoaXMud3JpdGFibGUpIHtcbiAgICAgICAgICAgIGxldCB0b3RhbCA9IDA7XG4gICAgICAgICAgICBpZiAodGhpcy5fcG9sbGluZykge1xuICAgICAgICAgICAgICAgIHRvdGFsKys7XG4gICAgICAgICAgICAgICAgdGhpcy5vbmNlKFwicG9sbENvbXBsZXRlXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgLS10b3RhbCB8fCBwYXVzZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF0aGlzLndyaXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgdG90YWwrKztcbiAgICAgICAgICAgICAgICB0aGlzLm9uY2UoXCJkcmFpblwiLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIC0tdG90YWwgfHwgcGF1c2UoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogU3RhcnRzIHBvbGxpbmcgY3ljbGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wb2xsKCkge1xuICAgICAgICB0aGlzLl9wb2xsaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5kb1BvbGwoKTtcbiAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJwb2xsXCIpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBPdmVybG9hZHMgb25EYXRhIHRvIGRldGVjdCBwYXlsb2Fkcy5cbiAgICAgKlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKi9cbiAgICBvbkRhdGEoZGF0YSkge1xuICAgICAgICBjb25zdCBjYWxsYmFjayA9IChwYWNrZXQpID0+IHtcbiAgICAgICAgICAgIC8vIGlmIGl0cyB0aGUgZmlyc3QgbWVzc2FnZSB3ZSBjb25zaWRlciB0aGUgdHJhbnNwb3J0IG9wZW5cbiAgICAgICAgICAgIGlmIChcIm9wZW5pbmdcIiA9PT0gdGhpcy5yZWFkeVN0YXRlICYmIHBhY2tldC50eXBlID09PSBcIm9wZW5cIikge1xuICAgICAgICAgICAgICAgIHRoaXMub25PcGVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBpZiBpdHMgYSBjbG9zZSBwYWNrZXQsIHdlIGNsb3NlIHRoZSBvbmdvaW5nIHJlcXVlc3RzXG4gICAgICAgICAgICBpZiAoXCJjbG9zZVwiID09PSBwYWNrZXQudHlwZSkge1xuICAgICAgICAgICAgICAgIHRoaXMub25DbG9zZSh7IGRlc2NyaXB0aW9uOiBcInRyYW5zcG9ydCBjbG9zZWQgYnkgdGhlIHNlcnZlclwiIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSBieXBhc3Mgb25EYXRhIGFuZCBoYW5kbGUgdGhlIG1lc3NhZ2VcbiAgICAgICAgICAgIHRoaXMub25QYWNrZXQocGFja2V0KTtcbiAgICAgICAgfTtcbiAgICAgICAgLy8gZGVjb2RlIHBheWxvYWRcbiAgICAgICAgZGVjb2RlUGF5bG9hZChkYXRhLCB0aGlzLnNvY2tldC5iaW5hcnlUeXBlKS5mb3JFYWNoKGNhbGxiYWNrKTtcbiAgICAgICAgLy8gaWYgYW4gZXZlbnQgZGlkIG5vdCB0cmlnZ2VyIGNsb3NpbmdcbiAgICAgICAgaWYgKFwiY2xvc2VkXCIgIT09IHRoaXMucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgLy8gaWYgd2UgZ290IGRhdGEgd2UncmUgbm90IHBvbGxpbmdcbiAgICAgICAgICAgIHRoaXMuX3BvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwicG9sbENvbXBsZXRlXCIpO1xuICAgICAgICAgICAgaWYgKFwib3BlblwiID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb2xsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBGb3IgcG9sbGluZywgc2VuZCBhIGNsb3NlIHBhY2tldC5cbiAgICAgKlxuICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgKi9cbiAgICBkb0Nsb3NlKCkge1xuICAgICAgICBjb25zdCBjbG9zZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMud3JpdGUoW3sgdHlwZTogXCJjbG9zZVwiIH1dKTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKFwib3BlblwiID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgICAgIGNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvLyBpbiBjYXNlIHdlJ3JlIHRyeWluZyB0byBjbG9zZSB3aGlsZVxuICAgICAgICAgICAgLy8gaGFuZHNoYWtpbmcgaXMgaW4gcHJvZ3Jlc3MgKEdILTE2NClcbiAgICAgICAgICAgIHRoaXMub25jZShcIm9wZW5cIiwgY2xvc2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdyaXRlcyBhIHBhY2tldHMgcGF5bG9hZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHBhY2tldHMgLSBkYXRhIHBhY2tldHNcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgd3JpdGUocGFja2V0cykge1xuICAgICAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG4gICAgICAgIGVuY29kZVBheWxvYWQocGFja2V0cywgKGRhdGEpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZG9Xcml0ZShkYXRhLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy53cml0YWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJkcmFpblwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIHVyaSBmb3IgY29ubmVjdGlvbi5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdXJpKCkge1xuICAgICAgICBjb25zdCBzY2hlbWEgPSB0aGlzLm9wdHMuc2VjdXJlID8gXCJodHRwc1wiIDogXCJodHRwXCI7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyeSB8fCB7fTtcbiAgICAgICAgLy8gY2FjaGUgYnVzdGluZyBpcyBmb3JjZWRcbiAgICAgICAgaWYgKGZhbHNlICE9PSB0aGlzLm9wdHMudGltZXN0YW1wUmVxdWVzdHMpIHtcbiAgICAgICAgICAgIHF1ZXJ5W3RoaXMub3B0cy50aW1lc3RhbXBQYXJhbV0gPSByYW5kb21TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuc3VwcG9ydHNCaW5hcnkgJiYgIXF1ZXJ5LnNpZCkge1xuICAgICAgICAgICAgcXVlcnkuYjY0ID0gMTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVVcmkoc2NoZW1hLCBxdWVyeSk7XG4gICAgfVxufVxuIiwiLy8gaW1wb3J0ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vY29tcG9uZW50L2hhcy1jb3JzXG5sZXQgdmFsdWUgPSBmYWxzZTtcbnRyeSB7XG4gICAgdmFsdWUgPSB0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgICd3aXRoQ3JlZGVudGlhbHMnIGluIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xufVxuY2F0Y2ggKGVycikge1xuICAgIC8vIGlmIFhNTEh0dHAgc3VwcG9ydCBpcyBkaXNhYmxlZCBpbiBJRSB0aGVuIGl0IHdpbGwgdGhyb3dcbiAgICAvLyB3aGVuIHRyeWluZyB0byBjcmVhdGVcbn1cbmV4cG9ydCBjb25zdCBoYXNDT1JTID0gdmFsdWU7XG4iLCJpbXBvcnQgeyBQb2xsaW5nIH0gZnJvbSBcIi4vcG9sbGluZy5qc1wiO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gXCJAc29ja2V0LmlvL2NvbXBvbmVudC1lbWl0dGVyXCI7XG5pbXBvcnQgeyBpbnN0YWxsVGltZXJGdW5jdGlvbnMsIHBpY2sgfSBmcm9tIFwiLi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgZ2xvYmFsVGhpc1NoaW0gYXMgZ2xvYmFsVGhpcyB9IGZyb20gXCIuLi9nbG9iYWxzLm5vZGUuanNcIjtcbmltcG9ydCB7IGhhc0NPUlMgfSBmcm9tIFwiLi4vY29udHJpYi9oYXMtY29ycy5qc1wiO1xuZnVuY3Rpb24gZW1wdHkoKSB7IH1cbmV4cG9ydCBjbGFzcyBCYXNlWEhSIGV4dGVuZHMgUG9sbGluZyB7XG4gICAgLyoqXG4gICAgICogWEhSIFBvbGxpbmcgY29uc3RydWN0b3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0c1xuICAgICAqIEBwYWNrYWdlXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3B0cykge1xuICAgICAgICBzdXBlcihvcHRzKTtcbiAgICAgICAgaWYgKHR5cGVvZiBsb2NhdGlvbiAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgY29uc3QgaXNTU0wgPSBcImh0dHBzOlwiID09PSBsb2NhdGlvbi5wcm90b2NvbDtcbiAgICAgICAgICAgIGxldCBwb3J0ID0gbG9jYXRpb24ucG9ydDtcbiAgICAgICAgICAgIC8vIHNvbWUgdXNlciBhZ2VudHMgaGF2ZSBlbXB0eSBgbG9jYXRpb24ucG9ydGBcbiAgICAgICAgICAgIGlmICghcG9ydCkge1xuICAgICAgICAgICAgICAgIHBvcnQgPSBpc1NTTCA/IFwiNDQzXCIgOiBcIjgwXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnhkID1cbiAgICAgICAgICAgICAgICAodHlwZW9mIGxvY2F0aW9uICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICAgICAgICAgICAgICAgIG9wdHMuaG9zdG5hbWUgIT09IGxvY2F0aW9uLmhvc3RuYW1lKSB8fFxuICAgICAgICAgICAgICAgICAgICBwb3J0ICE9PSBvcHRzLnBvcnQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogU2VuZHMgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBkYXRhIC0gZGF0YSB0byBzZW5kLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIC0gY2FsbGVkIHVwb24gZmx1c2guXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkb1dyaXRlKGRhdGEsIGZuKSB7XG4gICAgICAgIGNvbnN0IHJlcSA9IHRoaXMucmVxdWVzdCh7XG4gICAgICAgICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgfSk7XG4gICAgICAgIHJlcS5vbihcInN1Y2Nlc3NcIiwgZm4pO1xuICAgICAgICByZXEub24oXCJlcnJvclwiLCAoeGhyU3RhdHVzLCBjb250ZXh0KSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uRXJyb3IoXCJ4aHIgcG9zdCBlcnJvclwiLCB4aHJTdGF0dXMsIGNvbnRleHQpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3RhcnRzIGEgcG9sbCBjeWNsZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZG9Qb2xsKCkge1xuICAgICAgICBjb25zdCByZXEgPSB0aGlzLnJlcXVlc3QoKTtcbiAgICAgICAgcmVxLm9uKFwiZGF0YVwiLCB0aGlzLm9uRGF0YS5iaW5kKHRoaXMpKTtcbiAgICAgICAgcmVxLm9uKFwiZXJyb3JcIiwgKHhoclN0YXR1cywgY29udGV4dCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbkVycm9yKFwieGhyIHBvbGwgZXJyb3JcIiwgeGhyU3RhdHVzLCBjb250ZXh0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucG9sbFhociA9IHJlcTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUmVxdWVzdCBleHRlbmRzIEVtaXR0ZXIge1xuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgY29uc3RydWN0b3JcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICogQHBhY2thZ2VcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihjcmVhdGVSZXF1ZXN0LCB1cmksIG9wdHMpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5jcmVhdGVSZXF1ZXN0ID0gY3JlYXRlUmVxdWVzdDtcbiAgICAgICAgaW5zdGFsbFRpbWVyRnVuY3Rpb25zKHRoaXMsIG9wdHMpO1xuICAgICAgICB0aGlzLl9vcHRzID0gb3B0cztcbiAgICAgICAgdGhpcy5fbWV0aG9kID0gb3B0cy5tZXRob2QgfHwgXCJHRVRcIjtcbiAgICAgICAgdGhpcy5fdXJpID0gdXJpO1xuICAgICAgICB0aGlzLl9kYXRhID0gdW5kZWZpbmVkICE9PSBvcHRzLmRhdGEgPyBvcHRzLmRhdGEgOiBudWxsO1xuICAgICAgICB0aGlzLl9jcmVhdGUoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyB0aGUgWEhSIG9iamVjdCBhbmQgc2VuZHMgdGhlIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jcmVhdGUoKSB7XG4gICAgICAgIHZhciBfYTtcbiAgICAgICAgY29uc3Qgb3B0cyA9IHBpY2sodGhpcy5fb3B0cywgXCJhZ2VudFwiLCBcInBmeFwiLCBcImtleVwiLCBcInBhc3NwaHJhc2VcIiwgXCJjZXJ0XCIsIFwiY2FcIiwgXCJjaXBoZXJzXCIsIFwicmVqZWN0VW5hdXRob3JpemVkXCIsIFwiYXV0b1VucmVmXCIpO1xuICAgICAgICBvcHRzLnhkb21haW4gPSAhIXRoaXMuX29wdHMueGQ7XG4gICAgICAgIGNvbnN0IHhociA9ICh0aGlzLl94aHIgPSB0aGlzLmNyZWF0ZVJlcXVlc3Qob3B0cykpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgeGhyLm9wZW4odGhpcy5fbWV0aG9kLCB0aGlzLl91cmksIHRydWUpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fb3B0cy5leHRyYUhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICB4aHIuc2V0RGlzYWJsZUhlYWRlckNoZWNrICYmIHhoci5zZXREaXNhYmxlSGVhZGVyQ2hlY2sodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgaW4gdGhpcy5fb3B0cy5leHRyYUhlYWRlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9vcHRzLmV4dHJhSGVhZGVycy5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGksIHRoaXMuX29wdHMuZXh0cmFIZWFkZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IH1cbiAgICAgICAgICAgIGlmIChcIlBPU1RcIiA9PT0gdGhpcy5fbWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LXR5cGVcIiwgXCJ0ZXh0L3BsYWluO2NoYXJzZXQ9VVRGLThcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoXCJBY2NlcHRcIiwgXCIqLypcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZSkgeyB9XG4gICAgICAgICAgICAoX2EgPSB0aGlzLl9vcHRzLmNvb2tpZUphcikgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLmFkZENvb2tpZXMoeGhyKTtcbiAgICAgICAgICAgIC8vIGllNiBjaGVja1xuICAgICAgICAgICAgaWYgKFwid2l0aENyZWRlbnRpYWxzXCIgaW4geGhyKSB7XG4gICAgICAgICAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRoaXMuX29wdHMud2l0aENyZWRlbnRpYWxzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuX29wdHMucmVxdWVzdFRpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICB4aHIudGltZW91dCA9IHRoaXMuX29wdHMucmVxdWVzdFRpbWVvdXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHZhciBfYTtcbiAgICAgICAgICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgKF9hID0gdGhpcy5fb3B0cy5jb29raWVKYXIpID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5wYXJzZUNvb2tpZXMoXG4gICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgeGhyLmdldFJlc3BvbnNlSGVhZGVyKFwic2V0LWNvb2tpZVwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICg0ICE9PSB4aHIucmVhZHlTdGF0ZSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmICgyMDAgPT09IHhoci5zdGF0dXMgfHwgMTIyMyA9PT0geGhyLnN0YXR1cykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkxvYWQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgYGVycm9yYCBldmVudCBoYW5kbGVyIHRoYXQncyB1c2VyLXNldFxuICAgICAgICAgICAgICAgICAgICAvLyBkb2VzIG5vdCB0aHJvdyBpbiB0aGUgc2FtZSB0aWNrIGFuZCBnZXRzIGNhdWdodCBoZXJlXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0VGltZW91dEZuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX29uRXJyb3IodHlwZW9mIHhoci5zdGF0dXMgPT09IFwibnVtYmVyXCIgPyB4aHIuc3RhdHVzIDogMCk7XG4gICAgICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB4aHIuc2VuZCh0aGlzLl9kYXRhKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gTmVlZCB0byBkZWZlciBzaW5jZSAuY3JlYXRlKCkgaXMgY2FsbGVkIGRpcmVjdGx5IGZyb20gdGhlIGNvbnN0cnVjdG9yXG4gICAgICAgICAgICAvLyBhbmQgdGh1cyB0aGUgJ2Vycm9yJyBldmVudCBjYW4gb25seSBiZSBvbmx5IGJvdW5kICphZnRlciogdGhpcyBleGNlcHRpb25cbiAgICAgICAgICAgIC8vIG9jY3Vycy4gIFRoZXJlZm9yZSwgYWxzbywgd2UgY2Fubm90IHRocm93IGhlcmUgYXQgYWxsLlxuICAgICAgICAgICAgdGhpcy5zZXRUaW1lb3V0Rm4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uRXJyb3IoZSk7XG4gICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICB0aGlzLl9pbmRleCA9IFJlcXVlc3QucmVxdWVzdHNDb3VudCsrO1xuICAgICAgICAgICAgUmVxdWVzdC5yZXF1ZXN0c1t0aGlzLl9pbmRleF0gPSB0aGlzO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIGVycm9yLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25FcnJvcihlcnIpIHtcbiAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJlcnJvclwiLCBlcnIsIHRoaXMuX3hocik7XG4gICAgICAgIHRoaXMuX2NsZWFudXAodHJ1ZSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENsZWFucyB1cCBob3VzZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NsZWFudXAoZnJvbUVycm9yKSB7XG4gICAgICAgIGlmIChcInVuZGVmaW5lZFwiID09PSB0eXBlb2YgdGhpcy5feGhyIHx8IG51bGwgPT09IHRoaXMuX3hocikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3hoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBlbXB0eTtcbiAgICAgICAgaWYgKGZyb21FcnJvcikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGlzLl94aHIuYWJvcnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICBkZWxldGUgUmVxdWVzdC5yZXF1ZXN0c1t0aGlzLl9pbmRleF07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5feGhyID0gbnVsbDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gbG9hZC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTG9hZCgpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuX3hoci5yZXNwb25zZVRleHQ7XG4gICAgICAgIGlmIChkYXRhICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImRhdGFcIiwgZGF0YSk7XG4gICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcInN1Y2Nlc3NcIik7XG4gICAgICAgICAgICB0aGlzLl9jbGVhbnVwKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQWJvcnRzIHRoZSByZXF1ZXN0LlxuICAgICAqXG4gICAgICogQHBhY2thZ2VcbiAgICAgKi9cbiAgICBhYm9ydCgpIHtcbiAgICAgICAgdGhpcy5fY2xlYW51cCgpO1xuICAgIH1cbn1cblJlcXVlc3QucmVxdWVzdHNDb3VudCA9IDA7XG5SZXF1ZXN0LnJlcXVlc3RzID0ge307XG4vKipcbiAqIEFib3J0cyBwZW5kaW5nIHJlcXVlc3RzIHdoZW4gdW5sb2FkaW5nIHRoZSB3aW5kb3cuIFRoaXMgaXMgbmVlZGVkIHRvIHByZXZlbnRcbiAqIG1lbW9yeSBsZWFrcyAoZS5nLiB3aGVuIHVzaW5nIElFKSBhbmQgdG8gZW5zdXJlIHRoYXQgbm8gc3B1cmlvdXMgZXJyb3IgaXNcbiAqIGVtaXR0ZWQuXG4gKi9cbmlmICh0eXBlb2YgZG9jdW1lbnQgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgaWYgKHR5cGVvZiBhdHRhY2hFdmVudCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgYXR0YWNoRXZlbnQoXCJvbnVubG9hZFwiLCB1bmxvYWRIYW5kbGVyKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIGFkZEV2ZW50TGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBjb25zdCB0ZXJtaW5hdGlvbkV2ZW50ID0gXCJvbnBhZ2VoaWRlXCIgaW4gZ2xvYmFsVGhpcyA/IFwicGFnZWhpZGVcIiA6IFwidW5sb2FkXCI7XG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXIodGVybWluYXRpb25FdmVudCwgdW5sb2FkSGFuZGxlciwgZmFsc2UpO1xuICAgIH1cbn1cbmZ1bmN0aW9uIHVubG9hZEhhbmRsZXIoKSB7XG4gICAgZm9yIChsZXQgaSBpbiBSZXF1ZXN0LnJlcXVlc3RzKSB7XG4gICAgICAgIGlmIChSZXF1ZXN0LnJlcXVlc3RzLmhhc093blByb3BlcnR5KGkpKSB7XG4gICAgICAgICAgICBSZXF1ZXN0LnJlcXVlc3RzW2ldLmFib3J0KCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5jb25zdCBoYXNYSFIyID0gKGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCB4aHIgPSBuZXdSZXF1ZXN0KHtcbiAgICAgICAgeGRvbWFpbjogZmFsc2UsXG4gICAgfSk7XG4gICAgcmV0dXJuIHhociAmJiB4aHIucmVzcG9uc2VUeXBlICE9PSBudWxsO1xufSkoKTtcbi8qKlxuICogSFRUUCBsb25nLXBvbGxpbmcgYmFzZWQgb24gdGhlIGJ1aWx0LWluIGBYTUxIdHRwUmVxdWVzdGAgb2JqZWN0LlxuICpcbiAqIFVzYWdlOiBicm93c2VyXG4gKlxuICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvWE1MSHR0cFJlcXVlc3RcbiAqL1xuZXhwb3J0IGNsYXNzIFhIUiBleHRlbmRzIEJhc2VYSFIge1xuICAgIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICAgICAgc3VwZXIob3B0cyk7XG4gICAgICAgIGNvbnN0IGZvcmNlQmFzZTY0ID0gb3B0cyAmJiBvcHRzLmZvcmNlQmFzZTY0O1xuICAgICAgICB0aGlzLnN1cHBvcnRzQmluYXJ5ID0gaGFzWEhSMiAmJiAhZm9yY2VCYXNlNjQ7XG4gICAgfVxuICAgIHJlcXVlc3Qob3B0cyA9IHt9KSB7XG4gICAgICAgIE9iamVjdC5hc3NpZ24ob3B0cywgeyB4ZDogdGhpcy54ZCB9LCB0aGlzLm9wdHMpO1xuICAgICAgICByZXR1cm4gbmV3IFJlcXVlc3QobmV3UmVxdWVzdCwgdGhpcy51cmkoKSwgb3B0cyk7XG4gICAgfVxufVxuZnVuY3Rpb24gbmV3UmVxdWVzdChvcHRzKSB7XG4gICAgY29uc3QgeGRvbWFpbiA9IG9wdHMueGRvbWFpbjtcbiAgICAvLyBYTUxIdHRwUmVxdWVzdCBjYW4gYmUgZGlzYWJsZWQgb24gSUVcbiAgICB0cnkge1xuICAgICAgICBpZiAoXCJ1bmRlZmluZWRcIiAhPT0gdHlwZW9mIFhNTEh0dHBSZXF1ZXN0ICYmICgheGRvbWFpbiB8fCBoYXNDT1JTKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNhdGNoIChlKSB7IH1cbiAgICBpZiAoIXhkb21haW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgZ2xvYmFsVGhpc1tbXCJBY3RpdmVcIl0uY29uY2F0KFwiT2JqZWN0XCIpLmpvaW4oXCJYXCIpXShcIk1pY3Jvc29mdC5YTUxIVFRQXCIpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7IH1cbiAgICB9XG59XG4iLCJpbXBvcnQgeyBUcmFuc3BvcnQgfSBmcm9tIFwiLi4vdHJhbnNwb3J0LmpzXCI7XG5pbXBvcnQgeyBwaWNrLCByYW5kb21TdHJpbmcgfSBmcm9tIFwiLi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgZW5jb2RlUGFja2V0IH0gZnJvbSBcImVuZ2luZS5pby1wYXJzZXJcIjtcbmltcG9ydCB7IGdsb2JhbFRoaXNTaGltIGFzIGdsb2JhbFRoaXMsIG5leHRUaWNrIH0gZnJvbSBcIi4uL2dsb2JhbHMubm9kZS5qc1wiO1xuLy8gZGV0ZWN0IFJlYWN0TmF0aXZlIGVudmlyb25tZW50XG5jb25zdCBpc1JlYWN0TmF0aXZlID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgIHR5cGVvZiBuYXZpZ2F0b3IucHJvZHVjdCA9PT0gXCJzdHJpbmdcIiAmJlxuICAgIG5hdmlnYXRvci5wcm9kdWN0LnRvTG93ZXJDYXNlKCkgPT09IFwicmVhY3RuYXRpdmVcIjtcbmV4cG9ydCBjbGFzcyBCYXNlV1MgZXh0ZW5kcyBUcmFuc3BvcnQge1xuICAgIGdldCBuYW1lKCkge1xuICAgICAgICByZXR1cm4gXCJ3ZWJzb2NrZXRcIjtcbiAgICB9XG4gICAgZG9PcGVuKCkge1xuICAgICAgICBjb25zdCB1cmkgPSB0aGlzLnVyaSgpO1xuICAgICAgICBjb25zdCBwcm90b2NvbHMgPSB0aGlzLm9wdHMucHJvdG9jb2xzO1xuICAgICAgICAvLyBSZWFjdCBOYXRpdmUgb25seSBzdXBwb3J0cyB0aGUgJ2hlYWRlcnMnIG9wdGlvbiwgYW5kIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIGFueXRoaW5nIGVsc2UgaXMgcGFzc2VkXG4gICAgICAgIGNvbnN0IG9wdHMgPSBpc1JlYWN0TmF0aXZlXG4gICAgICAgICAgICA/IHt9XG4gICAgICAgICAgICA6IHBpY2sodGhpcy5vcHRzLCBcImFnZW50XCIsIFwicGVyTWVzc2FnZURlZmxhdGVcIiwgXCJwZnhcIiwgXCJrZXlcIiwgXCJwYXNzcGhyYXNlXCIsIFwiY2VydFwiLCBcImNhXCIsIFwiY2lwaGVyc1wiLCBcInJlamVjdFVuYXV0aG9yaXplZFwiLCBcImxvY2FsQWRkcmVzc1wiLCBcInByb3RvY29sVmVyc2lvblwiLCBcIm9yaWdpblwiLCBcIm1heFBheWxvYWRcIiwgXCJmYW1pbHlcIiwgXCJjaGVja1NlcnZlcklkZW50aXR5XCIpO1xuICAgICAgICBpZiAodGhpcy5vcHRzLmV4dHJhSGVhZGVycykge1xuICAgICAgICAgICAgb3B0cy5oZWFkZXJzID0gdGhpcy5vcHRzLmV4dHJhSGVhZGVycztcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy53cyA9IHRoaXMuY3JlYXRlU29ja2V0KHVyaSwgcHJvdG9jb2xzLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lbWl0UmVzZXJ2ZWQoXCJlcnJvclwiLCBlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMud3MuYmluYXJ5VHlwZSA9IHRoaXMuc29ja2V0LmJpbmFyeVR5cGU7XG4gICAgICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcnMoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gdGhlIHNvY2tldFxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBhZGRFdmVudExpc3RlbmVycygpIHtcbiAgICAgICAgdGhpcy53cy5vbm9wZW4gPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRzLmF1dG9VbnJlZikge1xuICAgICAgICAgICAgICAgIHRoaXMud3MuX3NvY2tldC51bnJlZigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5vbk9wZW4oKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy53cy5vbmNsb3NlID0gKGNsb3NlRXZlbnQpID0+IHRoaXMub25DbG9zZSh7XG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJ3ZWJzb2NrZXQgY29ubmVjdGlvbiBjbG9zZWRcIixcbiAgICAgICAgICAgIGNvbnRleHQ6IGNsb3NlRXZlbnQsXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLndzLm9ubWVzc2FnZSA9IChldikgPT4gdGhpcy5vbkRhdGEoZXYuZGF0YSk7XG4gICAgICAgIHRoaXMud3Mub25lcnJvciA9IChlKSA9PiB0aGlzLm9uRXJyb3IoXCJ3ZWJzb2NrZXQgZXJyb3JcIiwgZSk7XG4gICAgfVxuICAgIHdyaXRlKHBhY2tldHMpIHtcbiAgICAgICAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuICAgICAgICAvLyBlbmNvZGVQYWNrZXQgZWZmaWNpZW50IGFzIGl0IHVzZXMgV1MgZnJhbWluZ1xuICAgICAgICAvLyBubyBuZWVkIGZvciBlbmNvZGVQYXlsb2FkXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFja2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGFja2V0ID0gcGFja2V0c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RQYWNrZXQgPSBpID09PSBwYWNrZXRzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICBlbmNvZGVQYWNrZXQocGFja2V0LCB0aGlzLnN1cHBvcnRzQmluYXJ5LCAoZGF0YSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFNvbWV0aW1lcyB0aGUgd2Vic29ja2V0IGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkIGJ1dCB0aGUgYnJvd3NlciBkaWRuJ3RcbiAgICAgICAgICAgICAgICAvLyBoYXZlIGEgY2hhbmNlIG9mIGluZm9ybWluZyB1cyBhYm91dCBpdCB5ZXQsIGluIHRoYXQgY2FzZSBzZW5kIHdpbGxcbiAgICAgICAgICAgICAgICAvLyB0aHJvdyBhbiBlcnJvclxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZG9Xcml0ZShwYWNrZXQsIGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobGFzdFBhY2tldCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBmYWtlIGRyYWluXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmVyIHRvIG5leHQgdGljayB0byBhbGxvdyBTb2NrZXQgdG8gY2xlYXIgd3JpdGVCdWZmZXJcbiAgICAgICAgICAgICAgICAgICAgbmV4dFRpY2soKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53cml0YWJsZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImRyYWluXCIpO1xuICAgICAgICAgICAgICAgICAgICB9LCB0aGlzLnNldFRpbWVvdXRGbik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZG9DbG9zZSgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLndzICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICB0aGlzLndzLm9uZXJyb3IgPSAoKSA9PiB7IH07XG4gICAgICAgICAgICB0aGlzLndzLmNsb3NlKCk7XG4gICAgICAgICAgICB0aGlzLndzID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgdXJpIGZvciBjb25uZWN0aW9uLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB1cmkoKSB7XG4gICAgICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMub3B0cy5zZWN1cmUgPyBcIndzc1wiIDogXCJ3c1wiO1xuICAgICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcnkgfHwge307XG4gICAgICAgIC8vIGFwcGVuZCB0aW1lc3RhbXAgdG8gVVJJXG4gICAgICAgIGlmICh0aGlzLm9wdHMudGltZXN0YW1wUmVxdWVzdHMpIHtcbiAgICAgICAgICAgIHF1ZXJ5W3RoaXMub3B0cy50aW1lc3RhbXBQYXJhbV0gPSByYW5kb21TdHJpbmcoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBjb21tdW5pY2F0ZSBiaW5hcnkgc3VwcG9ydCBjYXBhYmlsaXRpZXNcbiAgICAgICAgaWYgKCF0aGlzLnN1cHBvcnRzQmluYXJ5KSB7XG4gICAgICAgICAgICBxdWVyeS5iNjQgPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVVyaShzY2hlbWEsIHF1ZXJ5KTtcbiAgICB9XG59XG5jb25zdCBXZWJTb2NrZXRDdG9yID0gZ2xvYmFsVGhpcy5XZWJTb2NrZXQgfHwgZ2xvYmFsVGhpcy5Nb3pXZWJTb2NrZXQ7XG4vKipcbiAqIFdlYlNvY2tldCB0cmFuc3BvcnQgYmFzZWQgb24gdGhlIGJ1aWx0LWluIGBXZWJTb2NrZXRgIG9iamVjdC5cbiAqXG4gKiBVc2FnZTogYnJvd3NlciwgTm9kZS5qcyAoc2luY2UgdjIxKSwgRGVubywgQnVuXG4gKlxuICogQHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2ViU29ja2V0XG4gKiBAc2VlIGh0dHBzOi8vY2FuaXVzZS5jb20vbWRuLWFwaV93ZWJzb2NrZXRcbiAqIEBzZWUgaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9nbG9iYWxzLmh0bWwjd2Vic29ja2V0XG4gKi9cbmV4cG9ydCBjbGFzcyBXUyBleHRlbmRzIEJhc2VXUyB7XG4gICAgY3JlYXRlU29ja2V0KHVyaSwgcHJvdG9jb2xzLCBvcHRzKSB7XG4gICAgICAgIHJldHVybiAhaXNSZWFjdE5hdGl2ZVxuICAgICAgICAgICAgPyBwcm90b2NvbHNcbiAgICAgICAgICAgICAgICA/IG5ldyBXZWJTb2NrZXRDdG9yKHVyaSwgcHJvdG9jb2xzKVxuICAgICAgICAgICAgICAgIDogbmV3IFdlYlNvY2tldEN0b3IodXJpKVxuICAgICAgICAgICAgOiBuZXcgV2ViU29ja2V0Q3Rvcih1cmksIHByb3RvY29scywgb3B0cyk7XG4gICAgfVxuICAgIGRvV3JpdGUoX3BhY2tldCwgZGF0YSkge1xuICAgICAgICB0aGlzLndzLnNlbmQoZGF0YSk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgVHJhbnNwb3J0IH0gZnJvbSBcIi4uL3RyYW5zcG9ydC5qc1wiO1xuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tIFwiLi4vZ2xvYmFscy5ub2RlLmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVQYWNrZXREZWNvZGVyU3RyZWFtLCBjcmVhdGVQYWNrZXRFbmNvZGVyU3RyZWFtLCB9IGZyb20gXCJlbmdpbmUuaW8tcGFyc2VyXCI7XG4vKipcbiAqIFdlYlRyYW5zcG9ydCB0cmFuc3BvcnQgYmFzZWQgb24gdGhlIGJ1aWx0LWluIGBXZWJUcmFuc3BvcnRgIG9iamVjdC5cbiAqXG4gKiBVc2FnZTogYnJvd3NlciwgTm9kZS5qcyAod2l0aCB0aGUgYEBmYWlscy1jb21wb25lbnRzL3dlYnRyYW5zcG9ydGAgcGFja2FnZSlcbiAqXG4gKiBAc2VlIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9XZWJUcmFuc3BvcnRcbiAqIEBzZWUgaHR0cHM6Ly9jYW5pdXNlLmNvbS93ZWJ0cmFuc3BvcnRcbiAqL1xuZXhwb3J0IGNsYXNzIFdUIGV4dGVuZHMgVHJhbnNwb3J0IHtcbiAgICBnZXQgbmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIFwid2VidHJhbnNwb3J0XCI7XG4gICAgfVxuICAgIGRvT3BlbigpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIHRoaXMuX3RyYW5zcG9ydCA9IG5ldyBXZWJUcmFuc3BvcnQodGhpcy5jcmVhdGVVcmkoXCJodHRwc1wiKSwgdGhpcy5vcHRzLnRyYW5zcG9ydE9wdGlvbnNbdGhpcy5uYW1lXSk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZW1pdFJlc2VydmVkKFwiZXJyb3JcIiwgZXJyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl90cmFuc3BvcnQuY2xvc2VkXG4gICAgICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uQ2xvc2UoKTtcbiAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9uRXJyb3IoXCJ3ZWJ0cmFuc3BvcnQgZXJyb3JcIiwgZXJyKTtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIG5vdGU6IHdlIGNvdWxkIGhhdmUgdXNlZCBhc3luYy9hd2FpdCwgYnV0IHRoYXQgd291bGQgcmVxdWlyZSBzb21lIGFkZGl0aW9uYWwgcG9seWZpbGxzXG4gICAgICAgIHRoaXMuX3RyYW5zcG9ydC5yZWFkeS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX3RyYW5zcG9ydC5jcmVhdGVCaWRpcmVjdGlvbmFsU3RyZWFtKCkudGhlbigoc3RyZWFtKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGVjb2RlclN0cmVhbSA9IGNyZWF0ZVBhY2tldERlY29kZXJTdHJlYW0oTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIHRoaXMuc29ja2V0LmJpbmFyeVR5cGUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlYWRlciA9IHN0cmVhbS5yZWFkYWJsZS5waXBlVGhyb3VnaChkZWNvZGVyU3RyZWFtKS5nZXRSZWFkZXIoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbmNvZGVyU3RyZWFtID0gY3JlYXRlUGFja2V0RW5jb2RlclN0cmVhbSgpO1xuICAgICAgICAgICAgICAgIGVuY29kZXJTdHJlYW0ucmVhZGFibGUucGlwZVRvKHN0cmVhbS53cml0YWJsZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fd3JpdGVyID0gZW5jb2RlclN0cmVhbS53cml0YWJsZS5nZXRXcml0ZXIoKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZWFkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZWFkZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZWFkKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKCh7IGRvbmUsIHZhbHVlIH0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb25lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5vblBhY2tldCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWFkKCk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJlYWQoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwYWNrZXQgPSB7IHR5cGU6IFwib3BlblwiIH07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucXVlcnkuc2lkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhY2tldC5kYXRhID0gYHtcInNpZFwiOlwiJHt0aGlzLnF1ZXJ5LnNpZH1cIn1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl93cml0ZXIud3JpdGUocGFja2V0KS50aGVuKCgpID0+IHRoaXMub25PcGVuKCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICB3cml0ZShwYWNrZXRzKSB7XG4gICAgICAgIHRoaXMud3JpdGFibGUgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYWNrZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBwYWNrZXQgPSBwYWNrZXRzW2ldO1xuICAgICAgICAgICAgY29uc3QgbGFzdFBhY2tldCA9IGkgPT09IHBhY2tldHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIHRoaXMuX3dyaXRlci53cml0ZShwYWNrZXQpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChsYXN0UGFja2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMud3JpdGFibGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJkcmFpblwiKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgdGhpcy5zZXRUaW1lb3V0Rm4pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGRvQ2xvc2UoKSB7XG4gICAgICAgIHZhciBfYTtcbiAgICAgICAgKF9hID0gdGhpcy5fdHJhbnNwb3J0KSA9PT0gbnVsbCB8fCBfYSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2EuY2xvc2UoKTtcbiAgICB9XG59XG4iLCJpbXBvcnQgeyBYSFIgfSBmcm9tIFwiLi9wb2xsaW5nLXhoci5ub2RlLmpzXCI7XG5pbXBvcnQgeyBXUyB9IGZyb20gXCIuL3dlYnNvY2tldC5ub2RlLmpzXCI7XG5pbXBvcnQgeyBXVCB9IGZyb20gXCIuL3dlYnRyYW5zcG9ydC5qc1wiO1xuZXhwb3J0IGNvbnN0IHRyYW5zcG9ydHMgPSB7XG4gICAgd2Vic29ja2V0OiBXUyxcbiAgICB3ZWJ0cmFuc3BvcnQ6IFdULFxuICAgIHBvbGxpbmc6IFhIUixcbn07XG4iLCIvLyBpbXBvcnRlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9nYWxrbi9wYXJzZXVyaVxuLyoqXG4gKiBQYXJzZXMgYSBVUklcbiAqXG4gKiBOb3RlOiB3ZSBjb3VsZCBhbHNvIGhhdmUgdXNlZCB0aGUgYnVpbHQtaW4gVVJMIG9iamVjdCwgYnV0IGl0IGlzbid0IHN1cHBvcnRlZCBvbiBhbGwgcGxhdGZvcm1zLlxuICpcbiAqIFNlZTpcbiAqIC0gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1VSTFxuICogLSBodHRwczovL2Nhbml1c2UuY29tL3VybFxuICogLSBodHRwczovL3d3dy5yZmMtZWRpdG9yLm9yZy9yZmMvcmZjMzk4NiNhcHBlbmRpeC1CXG4gKlxuICogSGlzdG9yeSBvZiB0aGUgcGFyc2UoKSBtZXRob2Q6XG4gKiAtIGZpcnN0IGNvbW1pdDogaHR0cHM6Ly9naXRodWIuY29tL3NvY2tldGlvL3NvY2tldC5pby1jbGllbnQvY29tbWl0LzRlZTFkNWQ5NGIzOTA2YTljMDUyYjQ1OWYxYTgxOGIxNWYzOGY5MWNcbiAqIC0gZXhwb3J0IGludG8gaXRzIG93biBtb2R1bGU6IGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NrZXRpby9lbmdpbmUuaW8tY2xpZW50L2NvbW1pdC9kZTJjNTYxZTQ1NjRlZmViNzhmMWJkYjFiYTM5ZWY4MWIyODIyY2IzXG4gKiAtIHJlaW1wb3J0OiBodHRwczovL2dpdGh1Yi5jb20vc29ja2V0aW8vZW5naW5lLmlvLWNsaWVudC9jb21taXQvZGYzMjI3N2MzZjZkNjIyZWVjNWVkMDlmNDkzY2FlM2YzMzkxZDI0MlxuICpcbiAqIEBhdXRob3IgU3RldmVuIExldml0aGFuIDxzdGV2ZW5sZXZpdGhhbi5jb20+IChNSVQgbGljZW5zZSlcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5jb25zdCByZSA9IC9eKD86KD8hW146QFxcLz8jXSs6W146QFxcL10qQCkoaHR0cHxodHRwc3x3c3x3c3MpOlxcL1xcLyk/KCg/OigoW146QFxcLz8jXSopKD86OihbXjpAXFwvPyNdKikpPyk/QCk/KCg/OlthLWYwLTldezAsNH06KXsyLDd9W2EtZjAtOV17MCw0fXxbXjpcXC8/I10qKSg/OjooXFxkKikpPykoKChcXC8oPzpbXj8jXSg/IVtePyNcXC9dKlxcLltePyNcXC8uXSsoPzpbPyNdfCQpKSkqXFwvPyk/KFtePyNcXC9dKikpKD86XFw/KFteI10qKSk/KD86IyguKikpPykvO1xuY29uc3QgcGFydHMgPSBbXG4gICAgJ3NvdXJjZScsICdwcm90b2NvbCcsICdhdXRob3JpdHknLCAndXNlckluZm8nLCAndXNlcicsICdwYXNzd29yZCcsICdob3N0JywgJ3BvcnQnLCAncmVsYXRpdmUnLCAncGF0aCcsICdkaXJlY3RvcnknLCAnZmlsZScsICdxdWVyeScsICdhbmNob3InXG5dO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICAgIGlmIChzdHIubGVuZ3RoID4gODAwMCkge1xuICAgICAgICB0aHJvdyBcIlVSSSB0b28gbG9uZ1wiO1xuICAgIH1cbiAgICBjb25zdCBzcmMgPSBzdHIsIGIgPSBzdHIuaW5kZXhPZignWycpLCBlID0gc3RyLmluZGV4T2YoJ10nKTtcbiAgICBpZiAoYiAhPSAtMSAmJiBlICE9IC0xKSB7XG4gICAgICAgIHN0ciA9IHN0ci5zdWJzdHJpbmcoMCwgYikgKyBzdHIuc3Vic3RyaW5nKGIsIGUpLnJlcGxhY2UoLzovZywgJzsnKSArIHN0ci5zdWJzdHJpbmcoZSwgc3RyLmxlbmd0aCk7XG4gICAgfVxuICAgIGxldCBtID0gcmUuZXhlYyhzdHIgfHwgJycpLCB1cmkgPSB7fSwgaSA9IDE0O1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgdXJpW3BhcnRzW2ldXSA9IG1baV0gfHwgJyc7XG4gICAgfVxuICAgIGlmIChiICE9IC0xICYmIGUgIT0gLTEpIHtcbiAgICAgICAgdXJpLnNvdXJjZSA9IHNyYztcbiAgICAgICAgdXJpLmhvc3QgPSB1cmkuaG9zdC5zdWJzdHJpbmcoMSwgdXJpLmhvc3QubGVuZ3RoIC0gMSkucmVwbGFjZSgvOy9nLCAnOicpO1xuICAgICAgICB1cmkuYXV0aG9yaXR5ID0gdXJpLmF1dGhvcml0eS5yZXBsYWNlKCdbJywgJycpLnJlcGxhY2UoJ10nLCAnJykucmVwbGFjZSgvOy9nLCAnOicpO1xuICAgICAgICB1cmkuaXB2NnVyaSA9IHRydWU7XG4gICAgfVxuICAgIHVyaS5wYXRoTmFtZXMgPSBwYXRoTmFtZXModXJpLCB1cmlbJ3BhdGgnXSk7XG4gICAgdXJpLnF1ZXJ5S2V5ID0gcXVlcnlLZXkodXJpLCB1cmlbJ3F1ZXJ5J10pO1xuICAgIHJldHVybiB1cmk7XG59XG5mdW5jdGlvbiBwYXRoTmFtZXMob2JqLCBwYXRoKSB7XG4gICAgY29uc3QgcmVneCA9IC9cXC97Miw5fS9nLCBuYW1lcyA9IHBhdGgucmVwbGFjZShyZWd4LCBcIi9cIikuc3BsaXQoXCIvXCIpO1xuICAgIGlmIChwYXRoLnNsaWNlKDAsIDEpID09ICcvJyB8fCBwYXRoLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBuYW1lcy5zcGxpY2UoMCwgMSk7XG4gICAgfVxuICAgIGlmIChwYXRoLnNsaWNlKC0xKSA9PSAnLycpIHtcbiAgICAgICAgbmFtZXMuc3BsaWNlKG5hbWVzLmxlbmd0aCAtIDEsIDEpO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZXM7XG59XG5mdW5jdGlvbiBxdWVyeUtleSh1cmksIHF1ZXJ5KSB7XG4gICAgY29uc3QgZGF0YSA9IHt9O1xuICAgIHF1ZXJ5LnJlcGxhY2UoLyg/Ol58JikoW14mPV0qKT0/KFteJl0qKS9nLCBmdW5jdGlvbiAoJDAsICQxLCAkMikge1xuICAgICAgICBpZiAoJDEpIHtcbiAgICAgICAgICAgIGRhdGFbJDFdID0gJDI7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gZGF0YTtcbn1cbiIsImltcG9ydCB7IHRyYW5zcG9ydHMgYXMgREVGQVVMVF9UUkFOU1BPUlRTIH0gZnJvbSBcIi4vdHJhbnNwb3J0cy9pbmRleC5qc1wiO1xuaW1wb3J0IHsgaW5zdGFsbFRpbWVyRnVuY3Rpb25zLCBieXRlTGVuZ3RoIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuaW1wb3J0IHsgZGVjb2RlIH0gZnJvbSBcIi4vY29udHJpYi9wYXJzZXFzLmpzXCI7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gXCIuL2NvbnRyaWIvcGFyc2V1cmkuanNcIjtcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tIFwiQHNvY2tldC5pby9jb21wb25lbnQtZW1pdHRlclwiO1xuaW1wb3J0IHsgcHJvdG9jb2wgfSBmcm9tIFwiZW5naW5lLmlvLXBhcnNlclwiO1xuaW1wb3J0IHsgY3JlYXRlQ29va2llSmFyLCBkZWZhdWx0QmluYXJ5VHlwZSwgbmV4dFRpY2ssIH0gZnJvbSBcIi4vZ2xvYmFscy5ub2RlLmpzXCI7XG5jb25zdCB3aXRoRXZlbnRMaXN0ZW5lcnMgPSB0eXBlb2YgYWRkRXZlbnRMaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiICYmXG4gICAgdHlwZW9mIHJlbW92ZUV2ZW50TGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIjtcbmNvbnN0IE9GRkxJTkVfRVZFTlRfTElTVEVORVJTID0gW107XG5pZiAod2l0aEV2ZW50TGlzdGVuZXJzKSB7XG4gICAgLy8gd2l0aGluIGEgU2VydmljZVdvcmtlciwgYW55IGV2ZW50IGhhbmRsZXIgZm9yIHRoZSAnb2ZmbGluZScgZXZlbnQgbXVzdCBiZSBhZGRlZCBvbiB0aGUgaW5pdGlhbCBldmFsdWF0aW9uIG9mIHRoZVxuICAgIC8vIHNjcmlwdCwgc28gd2UgY3JlYXRlIG9uZSBzaW5nbGUgZXZlbnQgbGlzdGVuZXIgaGVyZSB3aGljaCB3aWxsIGZvcndhcmQgdGhlIGV2ZW50IHRvIHRoZSBzb2NrZXQgaW5zdGFuY2VzXG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm9mZmxpbmVcIiwgKCkgPT4ge1xuICAgICAgICBPRkZMSU5FX0VWRU5UX0xJU1RFTkVSUy5mb3JFYWNoKChsaXN0ZW5lcikgPT4gbGlzdGVuZXIoKSk7XG4gICAgfSwgZmFsc2UpO1xufVxuLyoqXG4gKiBUaGlzIGNsYXNzIHByb3ZpZGVzIGEgV2ViU29ja2V0LWxpa2UgaW50ZXJmYWNlIHRvIGNvbm5lY3QgdG8gYW4gRW5naW5lLklPIHNlcnZlci4gVGhlIGNvbm5lY3Rpb24gd2lsbCBiZSBlc3RhYmxpc2hlZFxuICogd2l0aCBvbmUgb2YgdGhlIGF2YWlsYWJsZSBsb3ctbGV2ZWwgdHJhbnNwb3J0cywgbGlrZSBIVFRQIGxvbmctcG9sbGluZywgV2ViU29ja2V0LCBvciBXZWJUcmFuc3BvcnQuXG4gKlxuICogVGhpcyBjbGFzcyBjb21lcyB3aXRoIGFuIHVwZ3JhZGUgbWVjaGFuaXNtLCB3aGljaCBtZWFucyB0aGF0IG9uY2UgdGhlIGNvbm5lY3Rpb24gaXMgZXN0YWJsaXNoZWQgd2l0aCB0aGUgZmlyc3RcbiAqIGxvdy1sZXZlbCB0cmFuc3BvcnQsIGl0IHdpbGwgdHJ5IHRvIHVwZ3JhZGUgdG8gYSBiZXR0ZXIgdHJhbnNwb3J0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBTb2NrZXQgfSBmcm9tIFwiZW5naW5lLmlvLWNsaWVudFwiO1xuICpcbiAqIGNvbnN0IHNvY2tldCA9IG5ldyBTb2NrZXQoKTtcbiAqXG4gKiBzb2NrZXQub24oXCJvcGVuXCIsICgpID0+IHtcbiAqICAgc29ja2V0LnNlbmQoXCJoZWxsb1wiKTtcbiAqIH0pO1xuICpcbiAqL1xuZXhwb3J0IGNsYXNzIFNvY2tldCBleHRlbmRzIEVtaXR0ZXIge1xuICAgIGNvbnN0cnVjdG9yKHVyaSwgb3B0cyA9IHt9KSB7XG4gICAgICAgIHZhciBfYSwgX2I7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuYmluYXJ5VHlwZSA9IGRlZmF1bHRCaW5hcnlUeXBlO1xuICAgICAgICB0aGlzLndyaXRlQnVmZmVyID0gW107XG4gICAgICAgIHRoaXMuX3ByZXZCdWZmZXJMZW4gPSAwO1xuICAgICAgICB0aGlzLl91cGdyYWRlcyA9IFtdO1xuICAgICAgICB0aGlzLl9waW5nSW50ZXJ2YWwgPSAtMTtcbiAgICAgICAgdGhpcy5fcGluZ1RpbWVvdXQgPSAtMTtcbiAgICAgICAgdGhpcy5fbWF4UGF5bG9hZCA9IC0xO1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGV4cGlyYXRpb24gdGltZXN0YW1wIG9mIHRoZSB7QGxpbmsgX3BpbmdUaW1lb3V0VGltZXJ9IG9iamVjdCBpcyB0cmFja2VkLCBpbiBjYXNlIHRoZSB0aW1lciBpcyB0aHJvdHRsZWQgYW5kIHRoZVxuICAgICAgICAgKiBjYWxsYmFjayBpcyBub3QgZmlyZWQgb24gdGltZS4gVGhpcyBjYW4gaGFwcGVuIGZvciBleGFtcGxlIHdoZW4gYSBsYXB0b3AgaXMgc3VzcGVuZGVkIG9yIHdoZW4gYSBwaG9uZSBpcyBsb2NrZWQuXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9waW5nVGltZW91dFRpbWUgPSBJbmZpbml0eTtcbiAgICAgICAgaWYgKHVyaSAmJiBcIm9iamVjdFwiID09PSB0eXBlb2YgdXJpKSB7XG4gICAgICAgICAgICBvcHRzID0gdXJpO1xuICAgICAgICAgICAgdXJpID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodXJpKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmkgPSBwYXJzZSh1cmkpO1xuICAgICAgICAgICAgb3B0cy5ob3N0bmFtZSA9IHBhcnNlZFVyaS5ob3N0O1xuICAgICAgICAgICAgb3B0cy5zZWN1cmUgPVxuICAgICAgICAgICAgICAgIHBhcnNlZFVyaS5wcm90b2NvbCA9PT0gXCJodHRwc1wiIHx8IHBhcnNlZFVyaS5wcm90b2NvbCA9PT0gXCJ3c3NcIjtcbiAgICAgICAgICAgIG9wdHMucG9ydCA9IHBhcnNlZFVyaS5wb3J0O1xuICAgICAgICAgICAgaWYgKHBhcnNlZFVyaS5xdWVyeSlcbiAgICAgICAgICAgICAgICBvcHRzLnF1ZXJ5ID0gcGFyc2VkVXJpLnF1ZXJ5O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG9wdHMuaG9zdCkge1xuICAgICAgICAgICAgb3B0cy5ob3N0bmFtZSA9IHBhcnNlKG9wdHMuaG9zdCkuaG9zdDtcbiAgICAgICAgfVxuICAgICAgICBpbnN0YWxsVGltZXJGdW5jdGlvbnModGhpcywgb3B0cyk7XG4gICAgICAgIHRoaXMuc2VjdXJlID1cbiAgICAgICAgICAgIG51bGwgIT0gb3B0cy5zZWN1cmVcbiAgICAgICAgICAgICAgICA/IG9wdHMuc2VjdXJlXG4gICAgICAgICAgICAgICAgOiB0eXBlb2YgbG9jYXRpb24gIT09IFwidW5kZWZpbmVkXCIgJiYgXCJodHRwczpcIiA9PT0gbG9jYXRpb24ucHJvdG9jb2w7XG4gICAgICAgIGlmIChvcHRzLmhvc3RuYW1lICYmICFvcHRzLnBvcnQpIHtcbiAgICAgICAgICAgIC8vIGlmIG5vIHBvcnQgaXMgc3BlY2lmaWVkIG1hbnVhbGx5LCB1c2UgdGhlIHByb3RvY29sIGRlZmF1bHRcbiAgICAgICAgICAgIG9wdHMucG9ydCA9IHRoaXMuc2VjdXJlID8gXCI0NDNcIiA6IFwiODBcIjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmhvc3RuYW1lID1cbiAgICAgICAgICAgIG9wdHMuaG9zdG5hbWUgfHxcbiAgICAgICAgICAgICAgICAodHlwZW9mIGxvY2F0aW9uICE9PSBcInVuZGVmaW5lZFwiID8gbG9jYXRpb24uaG9zdG5hbWUgOiBcImxvY2FsaG9zdFwiKTtcbiAgICAgICAgdGhpcy5wb3J0ID1cbiAgICAgICAgICAgIG9wdHMucG9ydCB8fFxuICAgICAgICAgICAgICAgICh0eXBlb2YgbG9jYXRpb24gIT09IFwidW5kZWZpbmVkXCIgJiYgbG9jYXRpb24ucG9ydFxuICAgICAgICAgICAgICAgICAgICA/IGxvY2F0aW9uLnBvcnRcbiAgICAgICAgICAgICAgICAgICAgOiB0aGlzLnNlY3VyZVxuICAgICAgICAgICAgICAgICAgICAgICAgPyBcIjQ0M1wiXG4gICAgICAgICAgICAgICAgICAgICAgICA6IFwiODBcIik7XG4gICAgICAgIGlmIChvcHRzLnRyYW5zcG9ydEltcGxlbWVudGF0aW9ucyAmJiBvcHRzLnRyYW5zcG9ydHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInNwZWNpZnlpbmcgYm90aCAndHJhbnNwb3J0SW1wbGVtZW50YXRpb25zJyBhbmQgJ3RyYW5zcG9ydHMnIG9wdGlvbnMgaXMgbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0cy50cmFuc3BvcnRJbXBsZW1lbnRhdGlvbnMgfHxcbiAgICAgICAgICAgICgoKF9hID0gb3B0cy50cmFuc3BvcnRzKSA9PT0gbnVsbCB8fCBfYSA9PT0gdm9pZCAwID8gdm9pZCAwIDogX2EubGVuZ3RoKSAmJiB0eXBlb2Ygb3B0cy50cmFuc3BvcnRzWzBdID09PSBcImZ1bmN0aW9uXCIpKSB7XG4gICAgICAgICAgICAvLyAndHJhbnNwb3J0cycgb3B0aW9uIGFzIGFuIGFycmF5IG9mIHRyYW5zcG9ydCBpbXBsZW1lbnRhdGlvbnMgaXMga2VwdCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgICAgICAgICAgdGhpcy50cmFuc3BvcnRzID0gW107XG4gICAgICAgICAgICB0aGlzLl90cmFuc3BvcnRzQnlOYW1lID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgICAgICAgICgoX2IgPSBvcHRzLnRyYW5zcG9ydEltcGxlbWVudGF0aW9ucykgIT09IG51bGwgJiYgX2IgIT09IHZvaWQgMCA/IF9iIDogb3B0cy50cmFuc3BvcnRzKS5mb3JFYWNoKCh0KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwb3J0TmFtZSA9IHQucHJvdG90eXBlLm5hbWU7XG4gICAgICAgICAgICAgICAgdGhpcy50cmFuc3BvcnRzLnB1c2godHJhbnNwb3J0TmFtZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNwb3J0c0J5TmFtZVt0cmFuc3BvcnROYW1lXSA9IHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudHJhbnNwb3J0cyA9IG9wdHMudHJhbnNwb3J0c1xuICAgICAgICAgICAgICAgID8gWy4uLm9wdHMudHJhbnNwb3J0c11cbiAgICAgICAgICAgICAgICA6IFtcInBvbGxpbmdcIiwgXCJ3ZWJzb2NrZXRcIiwgXCJ3ZWJ0cmFuc3BvcnRcIl07XG4gICAgICAgICAgICB0aGlzLl90cmFuc3BvcnRzQnlOYW1lID0gREVGQVVMVF9UUkFOU1BPUlRTO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgICAgICAgcGF0aDogXCIvZW5naW5lLmlvXCIsXG4gICAgICAgICAgICBhZ2VudDogZmFsc2UsXG4gICAgICAgICAgICB3aXRoQ3JlZGVudGlhbHM6IGZhbHNlLFxuICAgICAgICAgICAgdXBncmFkZTogdHJ1ZSxcbiAgICAgICAgICAgIHRpbWVzdGFtcFBhcmFtOiBcInRcIixcbiAgICAgICAgICAgIHJlbWVtYmVyVXBncmFkZTogZmFsc2UsXG4gICAgICAgICAgICBhZGRUcmFpbGluZ1NsYXNoOiB0cnVlLFxuICAgICAgICAgICAgcmVqZWN0VW5hdXRob3JpemVkOiB0cnVlLFxuICAgICAgICAgICAgcGVyTWVzc2FnZURlZmxhdGU6IHtcbiAgICAgICAgICAgICAgICB0aHJlc2hvbGQ6IDEwMjQsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJhbnNwb3J0T3B0aW9uczoge30sXG4gICAgICAgICAgICBjbG9zZU9uQmVmb3JldW5sb2FkOiBmYWxzZSxcbiAgICAgICAgfSwgb3B0cyk7XG4gICAgICAgIHRoaXMub3B0cy5wYXRoID1cbiAgICAgICAgICAgIHRoaXMub3B0cy5wYXRoLnJlcGxhY2UoL1xcLyQvLCBcIlwiKSArXG4gICAgICAgICAgICAgICAgKHRoaXMub3B0cy5hZGRUcmFpbGluZ1NsYXNoID8gXCIvXCIgOiBcIlwiKTtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdHMucXVlcnkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHRoaXMub3B0cy5xdWVyeSA9IGRlY29kZSh0aGlzLm9wdHMucXVlcnkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh3aXRoRXZlbnRMaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdHMuY2xvc2VPbkJlZm9yZXVubG9hZCkge1xuICAgICAgICAgICAgICAgIC8vIEZpcmVmb3ggY2xvc2VzIHRoZSBjb25uZWN0aW9uIHdoZW4gdGhlIFwiYmVmb3JldW5sb2FkXCIgZXZlbnQgaXMgZW1pdHRlZCBidXQgbm90IENocm9tZS4gVGhpcyBldmVudCBsaXN0ZW5lclxuICAgICAgICAgICAgICAgIC8vIGVuc3VyZXMgZXZlcnkgYnJvd3NlciBiZWhhdmVzIHRoZSBzYW1lIChubyBcImRpc2Nvbm5lY3RcIiBldmVudCBhdCB0aGUgU29ja2V0LklPIGxldmVsIHdoZW4gdGhlIHBhZ2UgaXNcbiAgICAgICAgICAgICAgICAvLyBjbG9zZWQvcmVsb2FkZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5fYmVmb3JldW5sb2FkRXZlbnRMaXN0ZW5lciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMudHJhbnNwb3J0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBjbG9zZSB0aGUgdHJhbnNwb3J0XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudHJhbnNwb3J0LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJiZWZvcmV1bmxvYWRcIiwgdGhpcy5fYmVmb3JldW5sb2FkRXZlbnRMaXN0ZW5lciwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuaG9zdG5hbWUgIT09IFwibG9jYWxob3N0XCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vZmZsaW5lRXZlbnRMaXN0ZW5lciA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25DbG9zZShcInRyYW5zcG9ydCBjbG9zZVwiLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJuZXR3b3JrIGNvbm5lY3Rpb24gbG9zdFwiLFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIE9GRkxJTkVfRVZFTlRfTElTVEVORVJTLnB1c2godGhpcy5fb2ZmbGluZUV2ZW50TGlzdGVuZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm9wdHMud2l0aENyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVKYXIgPSBjcmVhdGVDb29raWVKYXIoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9vcGVuKCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgdHJhbnNwb3J0IG9mIHRoZSBnaXZlbiB0eXBlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSB0cmFuc3BvcnQgbmFtZVxuICAgICAqIEByZXR1cm4ge1RyYW5zcG9ydH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNyZWF0ZVRyYW5zcG9ydChuYW1lKSB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5vcHRzLnF1ZXJ5KTtcbiAgICAgICAgLy8gYXBwZW5kIGVuZ2luZS5pbyBwcm90b2NvbCBpZGVudGlmaWVyXG4gICAgICAgIHF1ZXJ5LkVJTyA9IHByb3RvY29sO1xuICAgICAgICAvLyB0cmFuc3BvcnQgbmFtZVxuICAgICAgICBxdWVyeS50cmFuc3BvcnQgPSBuYW1lO1xuICAgICAgICAvLyBzZXNzaW9uIGlkIGlmIHdlIGFscmVhZHkgaGF2ZSBvbmVcbiAgICAgICAgaWYgKHRoaXMuaWQpXG4gICAgICAgICAgICBxdWVyeS5zaWQgPSB0aGlzLmlkO1xuICAgICAgICBjb25zdCBvcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5vcHRzLCB7XG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIHNvY2tldDogdGhpcyxcbiAgICAgICAgICAgIGhvc3RuYW1lOiB0aGlzLmhvc3RuYW1lLFxuICAgICAgICAgICAgc2VjdXJlOiB0aGlzLnNlY3VyZSxcbiAgICAgICAgICAgIHBvcnQ6IHRoaXMucG9ydCxcbiAgICAgICAgfSwgdGhpcy5vcHRzLnRyYW5zcG9ydE9wdGlvbnNbbmFtZV0pO1xuICAgICAgICByZXR1cm4gbmV3IHRoaXMuX3RyYW5zcG9ydHNCeU5hbWVbbmFtZV0ob3B0cyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIHRyYW5zcG9ydCB0byB1c2UgYW5kIHN0YXJ0cyBwcm9iZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29wZW4oKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zcG9ydHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvLyBFbWl0IGVycm9yIG9uIG5leHQgdGljayBzbyBpdCBjYW4gYmUgbGlzdGVuZWQgdG9cbiAgICAgICAgICAgIHRoaXMuc2V0VGltZW91dEZuKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImVycm9yXCIsIFwiTm8gdHJhbnNwb3J0cyBhdmFpbGFibGVcIik7XG4gICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0cmFuc3BvcnROYW1lID0gdGhpcy5vcHRzLnJlbWVtYmVyVXBncmFkZSAmJlxuICAgICAgICAgICAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyAmJlxuICAgICAgICAgICAgdGhpcy50cmFuc3BvcnRzLmluZGV4T2YoXCJ3ZWJzb2NrZXRcIikgIT09IC0xXG4gICAgICAgICAgICA/IFwid2Vic29ja2V0XCJcbiAgICAgICAgICAgIDogdGhpcy50cmFuc3BvcnRzWzBdO1xuICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBcIm9wZW5pbmdcIjtcbiAgICAgICAgY29uc3QgdHJhbnNwb3J0ID0gdGhpcy5jcmVhdGVUcmFuc3BvcnQodHJhbnNwb3J0TmFtZSk7XG4gICAgICAgIHRyYW5zcG9ydC5vcGVuKCk7XG4gICAgICAgIHRoaXMuc2V0VHJhbnNwb3J0KHRyYW5zcG9ydCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGN1cnJlbnQgdHJhbnNwb3J0LiBEaXNhYmxlcyB0aGUgZXhpc3Rpbmcgb25lIChpZiBhbnkpLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzZXRUcmFuc3BvcnQodHJhbnNwb3J0KSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zcG9ydCkge1xuICAgICAgICAgICAgdGhpcy50cmFuc3BvcnQucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc2V0IHVwIHRyYW5zcG9ydFxuICAgICAgICB0aGlzLnRyYW5zcG9ydCA9IHRyYW5zcG9ydDtcbiAgICAgICAgLy8gc2V0IHVwIHRyYW5zcG9ydCBsaXN0ZW5lcnNcbiAgICAgICAgdHJhbnNwb3J0XG4gICAgICAgICAgICAub24oXCJkcmFpblwiLCB0aGlzLl9vbkRyYWluLmJpbmQodGhpcykpXG4gICAgICAgICAgICAub24oXCJwYWNrZXRcIiwgdGhpcy5fb25QYWNrZXQuYmluZCh0aGlzKSlcbiAgICAgICAgICAgIC5vbihcImVycm9yXCIsIHRoaXMuX29uRXJyb3IuYmluZCh0aGlzKSlcbiAgICAgICAgICAgIC5vbihcImNsb3NlXCIsIChyZWFzb24pID0+IHRoaXMuX29uQ2xvc2UoXCJ0cmFuc3BvcnQgY2xvc2VcIiwgcmVhc29uKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFByb2JlcyBhIHRyYW5zcG9ydC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIC0gdHJhbnNwb3J0IG5hbWVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wcm9iZShuYW1lKSB7XG4gICAgICAgIGxldCB0cmFuc3BvcnQgPSB0aGlzLmNyZWF0ZVRyYW5zcG9ydChuYW1lKTtcbiAgICAgICAgbGV0IGZhaWxlZCA9IGZhbHNlO1xuICAgICAgICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IG9uVHJhbnNwb3J0T3BlbiA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmIChmYWlsZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdHJhbnNwb3J0LnNlbmQoW3sgdHlwZTogXCJwaW5nXCIsIGRhdGE6IFwicHJvYmVcIiB9XSk7XG4gICAgICAgICAgICB0cmFuc3BvcnQub25jZShcInBhY2tldFwiLCAobXNnKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGZhaWxlZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGlmIChcInBvbmdcIiA9PT0gbXNnLnR5cGUgJiYgXCJwcm9iZVwiID09PSBtc2cuZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZ3JhZGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwidXBncmFkaW5nXCIsIHRyYW5zcG9ydCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdHJhbnNwb3J0KVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICBTb2NrZXQucHJpb3JXZWJzb2NrZXRTdWNjZXNzID0gXCJ3ZWJzb2NrZXRcIiA9PT0gdHJhbnNwb3J0Lm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudHJhbnNwb3J0LnBhdXNlKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmYWlsZWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKFwiY2xvc2VkXCIgPT09IHRoaXMucmVhZHlTdGF0ZSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGVhbnVwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFRyYW5zcG9ydCh0cmFuc3BvcnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNwb3J0LnNlbmQoW3sgdHlwZTogXCJ1cGdyYWRlXCIgfV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJ1cGdyYWRlXCIsIHRyYW5zcG9ydCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFuc3BvcnQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGdyYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZmx1c2goKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlcnIgPSBuZXcgRXJyb3IoXCJwcm9iZSBlcnJvclwiKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICBlcnIudHJhbnNwb3J0ID0gdHJhbnNwb3J0Lm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwidXBncmFkZUVycm9yXCIsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICAgIGZ1bmN0aW9uIGZyZWV6ZVRyYW5zcG9ydCgpIHtcbiAgICAgICAgICAgIGlmIChmYWlsZWQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgLy8gQW55IGNhbGxiYWNrIGNhbGxlZCBieSB0cmFuc3BvcnQgc2hvdWxkIGJlIGlnbm9yZWQgc2luY2Ugbm93XG4gICAgICAgICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgY2xlYW51cCgpO1xuICAgICAgICAgICAgdHJhbnNwb3J0LmNsb3NlKCk7XG4gICAgICAgICAgICB0cmFuc3BvcnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIC8vIEhhbmRsZSBhbnkgZXJyb3IgdGhhdCBoYXBwZW5zIHdoaWxlIHByb2JpbmdcbiAgICAgICAgY29uc3Qgb25lcnJvciA9IChlcnIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwicHJvYmUgZXJyb3I6IFwiICsgZXJyKTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGVycm9yLnRyYW5zcG9ydCA9IHRyYW5zcG9ydC5uYW1lO1xuICAgICAgICAgICAgZnJlZXplVHJhbnNwb3J0KCk7XG4gICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcInVwZ3JhZGVFcnJvclwiLCBlcnJvcik7XG4gICAgICAgIH07XG4gICAgICAgIGZ1bmN0aW9uIG9uVHJhbnNwb3J0Q2xvc2UoKSB7XG4gICAgICAgICAgICBvbmVycm9yKFwidHJhbnNwb3J0IGNsb3NlZFwiKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBXaGVuIHRoZSBzb2NrZXQgaXMgY2xvc2VkIHdoaWxlIHdlJ3JlIHByb2JpbmdcbiAgICAgICAgZnVuY3Rpb24gb25jbG9zZSgpIHtcbiAgICAgICAgICAgIG9uZXJyb3IoXCJzb2NrZXQgY2xvc2VkXCIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFdoZW4gdGhlIHNvY2tldCBpcyB1cGdyYWRlZCB3aGlsZSB3ZSdyZSBwcm9iaW5nXG4gICAgICAgIGZ1bmN0aW9uIG9udXBncmFkZSh0bykge1xuICAgICAgICAgICAgaWYgKHRyYW5zcG9ydCAmJiB0by5uYW1lICE9PSB0cmFuc3BvcnQubmFtZSkge1xuICAgICAgICAgICAgICAgIGZyZWV6ZVRyYW5zcG9ydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFJlbW92ZSBhbGwgbGlzdGVuZXJzIG9uIHRoZSB0cmFuc3BvcnQgYW5kIG9uIHNlbGZcbiAgICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcbiAgICAgICAgICAgIHRyYW5zcG9ydC5yZW1vdmVMaXN0ZW5lcihcIm9wZW5cIiwgb25UcmFuc3BvcnRPcGVuKTtcbiAgICAgICAgICAgIHRyYW5zcG9ydC5yZW1vdmVMaXN0ZW5lcihcImVycm9yXCIsIG9uZXJyb3IpO1xuICAgICAgICAgICAgdHJhbnNwb3J0LnJlbW92ZUxpc3RlbmVyKFwiY2xvc2VcIiwgb25UcmFuc3BvcnRDbG9zZSk7XG4gICAgICAgICAgICB0aGlzLm9mZihcImNsb3NlXCIsIG9uY2xvc2UpO1xuICAgICAgICAgICAgdGhpcy5vZmYoXCJ1cGdyYWRpbmdcIiwgb251cGdyYWRlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdHJhbnNwb3J0Lm9uY2UoXCJvcGVuXCIsIG9uVHJhbnNwb3J0T3Blbik7XG4gICAgICAgIHRyYW5zcG9ydC5vbmNlKFwiZXJyb3JcIiwgb25lcnJvcik7XG4gICAgICAgIHRyYW5zcG9ydC5vbmNlKFwiY2xvc2VcIiwgb25UcmFuc3BvcnRDbG9zZSk7XG4gICAgICAgIHRoaXMub25jZShcImNsb3NlXCIsIG9uY2xvc2UpO1xuICAgICAgICB0aGlzLm9uY2UoXCJ1cGdyYWRpbmdcIiwgb251cGdyYWRlKTtcbiAgICAgICAgaWYgKHRoaXMuX3VwZ3JhZGVzLmluZGV4T2YoXCJ3ZWJ0cmFuc3BvcnRcIikgIT09IC0xICYmXG4gICAgICAgICAgICBuYW1lICE9PSBcIndlYnRyYW5zcG9ydFwiKSB7XG4gICAgICAgICAgICAvLyBmYXZvciBXZWJUcmFuc3BvcnRcbiAgICAgICAgICAgIHRoaXMuc2V0VGltZW91dEZuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZhaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0cmFuc3BvcnQub3BlbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIDIwMCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0cmFuc3BvcnQub3BlbigpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIGNvbm5lY3Rpb24gaXMgZGVlbWVkIG9wZW4uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uT3BlbigpIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJvcGVuXCI7XG4gICAgICAgIFNvY2tldC5wcmlvcldlYnNvY2tldFN1Y2Nlc3MgPSBcIndlYnNvY2tldFwiID09PSB0aGlzLnRyYW5zcG9ydC5uYW1lO1xuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcIm9wZW5cIik7XG4gICAgICAgIHRoaXMuZmx1c2goKTtcbiAgICAgICAgaWYgKFwib3BlblwiID09PSB0aGlzLnJlYWR5U3RhdGUgJiYgdGhpcy5vcHRzLnVwZ3JhZGUpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fdXBncmFkZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcm9iZSh0aGlzLl91cGdyYWRlc1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogSGFuZGxlcyBhIHBhY2tldC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uUGFja2V0KHBhY2tldCkge1xuICAgICAgICBpZiAoXCJvcGVuaW5nXCIgPT09IHRoaXMucmVhZHlTdGF0ZSB8fFxuICAgICAgICAgICAgXCJvcGVuXCIgPT09IHRoaXMucmVhZHlTdGF0ZSB8fFxuICAgICAgICAgICAgXCJjbG9zaW5nXCIgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJwYWNrZXRcIiwgcGFja2V0KTtcbiAgICAgICAgICAgIC8vIFNvY2tldCBpcyBsaXZlIC0gYW55IHBhY2tldCBjb3VudHNcbiAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiaGVhcnRiZWF0XCIpO1xuICAgICAgICAgICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgXCJvcGVuXCI6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25IYW5kc2hha2UoSlNPTi5wYXJzZShwYWNrZXQuZGF0YSkpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFwicGluZ1wiOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZW5kUGFja2V0KFwicG9uZ1wiKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJwaW5nXCIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcInBvbmdcIik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Jlc2V0UGluZ1RpbWVvdXQoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBcImVycm9yXCI6XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihcInNlcnZlciBlcnJvclwiKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICBlcnIuY29kZSA9IHBhY2tldC5kYXRhO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgXCJtZXNzYWdlXCI6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiZGF0YVwiLCBwYWNrZXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwibWVzc2FnZVwiLCBwYWNrZXQuZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIGhhbmRzaGFrZSBjb21wbGV0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgLSBoYW5kc2hha2Ugb2JqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkhhbmRzaGFrZShkYXRhKSB7XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiaGFuZHNoYWtlXCIsIGRhdGEpO1xuICAgICAgICB0aGlzLmlkID0gZGF0YS5zaWQ7XG4gICAgICAgIHRoaXMudHJhbnNwb3J0LnF1ZXJ5LnNpZCA9IGRhdGEuc2lkO1xuICAgICAgICB0aGlzLl91cGdyYWRlcyA9IHRoaXMuX2ZpbHRlclVwZ3JhZGVzKGRhdGEudXBncmFkZXMpO1xuICAgICAgICB0aGlzLl9waW5nSW50ZXJ2YWwgPSBkYXRhLnBpbmdJbnRlcnZhbDtcbiAgICAgICAgdGhpcy5fcGluZ1RpbWVvdXQgPSBkYXRhLnBpbmdUaW1lb3V0O1xuICAgICAgICB0aGlzLl9tYXhQYXlsb2FkID0gZGF0YS5tYXhQYXlsb2FkO1xuICAgICAgICB0aGlzLm9uT3BlbigpO1xuICAgICAgICAvLyBJbiBjYXNlIG9wZW4gaGFuZGxlciBjbG9zZXMgc29ja2V0XG4gICAgICAgIGlmIChcImNsb3NlZFwiID09PSB0aGlzLnJlYWR5U3RhdGUpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX3Jlc2V0UGluZ1RpbWVvdXQoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2V0cyBhbmQgcmVzZXRzIHBpbmcgdGltZW91dCB0aW1lciBiYXNlZCBvbiBzZXJ2ZXIgcGluZ3MuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZXNldFBpbmdUaW1lb3V0KCkge1xuICAgICAgICB0aGlzLmNsZWFyVGltZW91dEZuKHRoaXMuX3BpbmdUaW1lb3V0VGltZXIpO1xuICAgICAgICBjb25zdCBkZWxheSA9IHRoaXMuX3BpbmdJbnRlcnZhbCArIHRoaXMuX3BpbmdUaW1lb3V0O1xuICAgICAgICB0aGlzLl9waW5nVGltZW91dFRpbWUgPSBEYXRlLm5vdygpICsgZGVsYXk7XG4gICAgICAgIHRoaXMuX3BpbmdUaW1lb3V0VGltZXIgPSB0aGlzLnNldFRpbWVvdXRGbigoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vbkNsb3NlKFwicGluZyB0aW1lb3V0XCIpO1xuICAgICAgICB9LCBkZWxheSk7XG4gICAgICAgIGlmICh0aGlzLm9wdHMuYXV0b1VucmVmKSB7XG4gICAgICAgICAgICB0aGlzLl9waW5nVGltZW91dFRpbWVyLnVucmVmKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIG9uIGBkcmFpbmAgZXZlbnRcbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uRHJhaW4oKSB7XG4gICAgICAgIHRoaXMud3JpdGVCdWZmZXIuc3BsaWNlKDAsIHRoaXMuX3ByZXZCdWZmZXJMZW4pO1xuICAgICAgICAvLyBzZXR0aW5nIHByZXZCdWZmZXJMZW4gPSAwIGlzIHZlcnkgaW1wb3J0YW50XG4gICAgICAgIC8vIGZvciBleGFtcGxlLCB3aGVuIHVwZ3JhZGluZywgdXBncmFkZSBwYWNrZXQgaXMgc2VudCBvdmVyLFxuICAgICAgICAvLyBhbmQgYSBub256ZXJvIHByZXZCdWZmZXJMZW4gY291bGQgY2F1c2UgcHJvYmxlbXMgb24gYGRyYWluYFxuICAgICAgICB0aGlzLl9wcmV2QnVmZmVyTGVuID0gMDtcbiAgICAgICAgaWYgKDAgPT09IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImRyYWluXCIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5mbHVzaCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEZsdXNoIHdyaXRlIGJ1ZmZlcnMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGZsdXNoKCkge1xuICAgICAgICBpZiAoXCJjbG9zZWRcIiAhPT0gdGhpcy5yZWFkeVN0YXRlICYmXG4gICAgICAgICAgICB0aGlzLnRyYW5zcG9ydC53cml0YWJsZSAmJlxuICAgICAgICAgICAgIXRoaXMudXBncmFkaW5nICYmXG4gICAgICAgICAgICB0aGlzLndyaXRlQnVmZmVyLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgcGFja2V0cyA9IHRoaXMuX2dldFdyaXRhYmxlUGFja2V0cygpO1xuICAgICAgICAgICAgdGhpcy50cmFuc3BvcnQuc2VuZChwYWNrZXRzKTtcbiAgICAgICAgICAgIC8vIGtlZXAgdHJhY2sgb2YgY3VycmVudCBsZW5ndGggb2Ygd3JpdGVCdWZmZXJcbiAgICAgICAgICAgIC8vIHNwbGljZSB3cml0ZUJ1ZmZlciBhbmQgY2FsbGJhY2tCdWZmZXIgb24gYGRyYWluYFxuICAgICAgICAgICAgdGhpcy5fcHJldkJ1ZmZlckxlbiA9IHBhY2tldHMubGVuZ3RoO1xuICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJmbHVzaFwiKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGVuY29kZWQgc2l6ZSBvZiB0aGUgd3JpdGVCdWZmZXIgaXMgYmVsb3cgdGhlIG1heFBheWxvYWQgdmFsdWUgc2VudCBieSB0aGUgc2VydmVyIChvbmx5IGZvciBIVFRQXG4gICAgICogbG9uZy1wb2xsaW5nKVxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0V3JpdGFibGVQYWNrZXRzKCkge1xuICAgICAgICBjb25zdCBzaG91bGRDaGVja1BheWxvYWRTaXplID0gdGhpcy5fbWF4UGF5bG9hZCAmJlxuICAgICAgICAgICAgdGhpcy50cmFuc3BvcnQubmFtZSA9PT0gXCJwb2xsaW5nXCIgJiZcbiAgICAgICAgICAgIHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoID4gMTtcbiAgICAgICAgaWYgKCFzaG91bGRDaGVja1BheWxvYWRTaXplKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53cml0ZUJ1ZmZlcjtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcGF5bG9hZFNpemUgPSAxOyAvLyBmaXJzdCBwYWNrZXQgdHlwZVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMud3JpdGVCdWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLndyaXRlQnVmZmVyW2ldLmRhdGE7XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgIHBheWxvYWRTaXplICs9IGJ5dGVMZW5ndGgoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaSA+IDAgJiYgcGF5bG9hZFNpemUgPiB0aGlzLl9tYXhQYXlsb2FkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMud3JpdGVCdWZmZXIuc2xpY2UoMCwgaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYXlsb2FkU2l6ZSArPSAyOyAvLyBzZXBhcmF0b3IgKyBwYWNrZXQgdHlwZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLndyaXRlQnVmZmVyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciB0aGUgaGVhcnRiZWF0IHRpbWVyIGhhcyBleHBpcmVkIGJ1dCB0aGUgc29ja2V0IGhhcyBub3QgeWV0IGJlZW4gbm90aWZpZWQuXG4gICAgICpcbiAgICAgKiBOb3RlOiB0aGlzIG1ldGhvZCBpcyBwcml2YXRlIGZvciBub3cgYmVjYXVzZSBpdCBkb2VzIG5vdCByZWFsbHkgZml0IHRoZSBXZWJTb2NrZXQgQVBJLCBidXQgaWYgd2UgcHV0IGl0IGluIHRoZVxuICAgICAqIGB3cml0ZSgpYCBtZXRob2QgdGhlbiB0aGUgbWVzc2FnZSB3b3VsZCBub3QgYmUgYnVmZmVyZWQgYnkgdGhlIFNvY2tldC5JTyBjbGllbnQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgLyogcHJpdmF0ZSAqLyBfaGFzUGluZ0V4cGlyZWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcGluZ1RpbWVvdXRUaW1lKVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIGNvbnN0IGhhc0V4cGlyZWQgPSBEYXRlLm5vdygpID4gdGhpcy5fcGluZ1RpbWVvdXRUaW1lO1xuICAgICAgICBpZiAoaGFzRXhwaXJlZCkge1xuICAgICAgICAgICAgdGhpcy5fcGluZ1RpbWVvdXRUaW1lID0gMDtcbiAgICAgICAgICAgIG5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vbkNsb3NlKFwicGluZyB0aW1lb3V0XCIpO1xuICAgICAgICAgICAgfSwgdGhpcy5zZXRUaW1lb3V0Rm4pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYXNFeHBpcmVkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhIG1lc3NhZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbXNnIC0gbWVzc2FnZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiAtIGNhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAqIEByZXR1cm4ge1NvY2tldH0gZm9yIGNoYWluaW5nLlxuICAgICAqL1xuICAgIHdyaXRlKG1zZywgb3B0aW9ucywgZm4pIHtcbiAgICAgICAgdGhpcy5fc2VuZFBhY2tldChcIm1lc3NhZ2VcIiwgbXNnLCBvcHRpb25zLCBmbik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhIG1lc3NhZ2UuIEFsaWFzIG9mIHtAbGluayBTb2NrZXQjd3JpdGV9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG1zZyAtIG1lc3NhZ2UuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gLSBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICAgKiBAcmV0dXJuIHtTb2NrZXR9IGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBzZW5kKG1zZywgb3B0aW9ucywgZm4pIHtcbiAgICAgICAgdGhpcy5fc2VuZFBhY2tldChcIm1lc3NhZ2VcIiwgbXNnLCBvcHRpb25zLCBmbik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhIHBhY2tldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0gcGFja2V0IHR5cGUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGRhdGEuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gLSBjYWxsYmFjayBmdW5jdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZW5kUGFja2V0KHR5cGUsIGRhdGEsIG9wdGlvbnMsIGZuKSB7XG4gICAgICAgIGlmIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBkYXRhKSB7XG4gICAgICAgICAgICBmbiA9IGRhdGE7XG4gICAgICAgICAgICBkYXRhID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBvcHRpb25zKSB7XG4gICAgICAgICAgICBmbiA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXCJjbG9zaW5nXCIgPT09IHRoaXMucmVhZHlTdGF0ZSB8fCBcImNsb3NlZFwiID09PSB0aGlzLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgICAgb3B0aW9ucy5jb21wcmVzcyA9IGZhbHNlICE9PSBvcHRpb25zLmNvbXByZXNzO1xuICAgICAgICBjb25zdCBwYWNrZXQgPSB7XG4gICAgICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgIG9wdGlvbnM6IG9wdGlvbnMsXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwicGFja2V0Q3JlYXRlXCIsIHBhY2tldCk7XG4gICAgICAgIHRoaXMud3JpdGVCdWZmZXIucHVzaChwYWNrZXQpO1xuICAgICAgICBpZiAoZm4pXG4gICAgICAgICAgICB0aGlzLm9uY2UoXCJmbHVzaFwiLCBmbik7XG4gICAgICAgIHRoaXMuZmx1c2goKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xvc2VzIHRoZSBjb25uZWN0aW9uLlxuICAgICAqL1xuICAgIGNsb3NlKCkge1xuICAgICAgICBjb25zdCBjbG9zZSA9ICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX29uQ2xvc2UoXCJmb3JjZWQgY2xvc2VcIik7XG4gICAgICAgICAgICB0aGlzLnRyYW5zcG9ydC5jbG9zZSgpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBjbGVhbnVwQW5kQ2xvc2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLm9mZihcInVwZ3JhZGVcIiwgY2xlYW51cEFuZENsb3NlKTtcbiAgICAgICAgICAgIHRoaXMub2ZmKFwidXBncmFkZUVycm9yXCIsIGNsZWFudXBBbmRDbG9zZSk7XG4gICAgICAgICAgICBjbG9zZSgpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCB3YWl0Rm9yVXBncmFkZSA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIHdhaXQgZm9yIHVwZ3JhZGUgdG8gZmluaXNoIHNpbmNlIHdlIGNhbid0IHNlbmQgcGFja2V0cyB3aGlsZSBwYXVzaW5nIGEgdHJhbnNwb3J0XG4gICAgICAgICAgICB0aGlzLm9uY2UoXCJ1cGdyYWRlXCIsIGNsZWFudXBBbmRDbG9zZSk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoXCJ1cGdyYWRlRXJyb3JcIiwgY2xlYW51cEFuZENsb3NlKTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKFwib3BlbmluZ1wiID09PSB0aGlzLnJlYWR5U3RhdGUgfHwgXCJvcGVuXCIgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJjbG9zaW5nXCI7XG4gICAgICAgICAgICBpZiAodGhpcy53cml0ZUJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9uY2UoXCJkcmFpblwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnVwZ3JhZGluZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2FpdEZvclVwZ3JhZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMudXBncmFkaW5nKSB7XG4gICAgICAgICAgICAgICAgd2FpdEZvclVwZ3JhZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsb3NlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBlcnJvclxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25FcnJvcihlcnIpIHtcbiAgICAgICAgU29ja2V0LnByaW9yV2Vic29ja2V0U3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5vcHRzLnRyeUFsbFRyYW5zcG9ydHMgJiZcbiAgICAgICAgICAgIHRoaXMudHJhbnNwb3J0cy5sZW5ndGggPiAxICYmXG4gICAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPT09IFwib3BlbmluZ1wiKSB7XG4gICAgICAgICAgICB0aGlzLnRyYW5zcG9ydHMuc2hpZnQoKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9vcGVuKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJlcnJvclwiLCBlcnIpO1xuICAgICAgICB0aGlzLl9vbkNsb3NlKFwidHJhbnNwb3J0IGVycm9yXCIsIGVycik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBjbG9zZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uQ2xvc2UocmVhc29uLCBkZXNjcmlwdGlvbikge1xuICAgICAgICBpZiAoXCJvcGVuaW5nXCIgPT09IHRoaXMucmVhZHlTdGF0ZSB8fFxuICAgICAgICAgICAgXCJvcGVuXCIgPT09IHRoaXMucmVhZHlTdGF0ZSB8fFxuICAgICAgICAgICAgXCJjbG9zaW5nXCIgPT09IHRoaXMucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgLy8gY2xlYXIgdGltZXJzXG4gICAgICAgICAgICB0aGlzLmNsZWFyVGltZW91dEZuKHRoaXMuX3BpbmdUaW1lb3V0VGltZXIpO1xuICAgICAgICAgICAgLy8gc3RvcCBldmVudCBmcm9tIGZpcmluZyBhZ2FpbiBmb3IgdHJhbnNwb3J0XG4gICAgICAgICAgICB0aGlzLnRyYW5zcG9ydC5yZW1vdmVBbGxMaXN0ZW5lcnMoXCJjbG9zZVwiKTtcbiAgICAgICAgICAgIC8vIGVuc3VyZSB0cmFuc3BvcnQgd29uJ3Qgc3RheSBvcGVuXG4gICAgICAgICAgICB0aGlzLnRyYW5zcG9ydC5jbG9zZSgpO1xuICAgICAgICAgICAgLy8gaWdub3JlIGZ1cnRoZXIgdHJhbnNwb3J0IGNvbW11bmljYXRpb25cbiAgICAgICAgICAgIHRoaXMudHJhbnNwb3J0LnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgICAgICAgICAgaWYgKHdpdGhFdmVudExpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9iZWZvcmV1bmxvYWRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJiZWZvcmV1bmxvYWRcIiwgdGhpcy5fYmVmb3JldW5sb2FkRXZlbnRMaXN0ZW5lciwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fb2ZmbGluZUV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaSA9IE9GRkxJTkVfRVZFTlRfTElTVEVORVJTLmluZGV4T2YodGhpcy5fb2ZmbGluZUV2ZW50TGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE9GRkxJTkVfRVZFTlRfTElTVEVORVJTLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHNldCByZWFkeSBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gXCJjbG9zZWRcIjtcbiAgICAgICAgICAgIC8vIGNsZWFyIHNlc3Npb24gaWRcbiAgICAgICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICAgICAgLy8gZW1pdCBjbG9zZSBldmVudFxuICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJjbG9zZVwiLCByZWFzb24sIGRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgIC8vIGNsZWFuIGJ1ZmZlcnMgYWZ0ZXIsIHNvIHVzZXJzIGNhbiBzdGlsbFxuICAgICAgICAgICAgLy8gZ3JhYiB0aGUgYnVmZmVycyBvbiBgY2xvc2VgIGV2ZW50XG4gICAgICAgICAgICB0aGlzLndyaXRlQnVmZmVyID0gW107XG4gICAgICAgICAgICB0aGlzLl9wcmV2QnVmZmVyTGVuID0gMDtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBGaWx0ZXJzIHVwZ3JhZGVzLCByZXR1cm5pbmcgb25seSB0aG9zZSBtYXRjaGluZyBjbGllbnQgdHJhbnNwb3J0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHVwZ3JhZGVzIC0gc2VydmVyIHVwZ3JhZGVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlsdGVyVXBncmFkZXModXBncmFkZXMpIHtcbiAgICAgICAgY29uc3QgZmlsdGVyZWRVcGdyYWRlcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVwZ3JhZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAofnRoaXMudHJhbnNwb3J0cy5pbmRleE9mKHVwZ3JhZGVzW2ldKSlcbiAgICAgICAgICAgICAgICBmaWx0ZXJlZFVwZ3JhZGVzLnB1c2godXBncmFkZXNbaV0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWx0ZXJlZFVwZ3JhZGVzO1xuICAgIH1cbn1cblNvY2tldC5wcm90b2NvbCA9IHByb3RvY29sO1xuIiwiaW1wb3J0IHsgU29ja2V0IH0gZnJvbSBcIi4vc29ja2V0LmpzXCI7XG5leHBvcnQgeyBTb2NrZXQgfTtcbmV4cG9ydCBjb25zdCBwcm90b2NvbCA9IFNvY2tldC5wcm90b2NvbDtcbmV4cG9ydCB7IFRyYW5zcG9ydCwgVHJhbnNwb3J0RXJyb3IsIH0gZnJvbSBcIi4vdHJhbnNwb3J0LmpzXCI7XG5leHBvcnQgeyB0cmFuc3BvcnRzIH0gZnJvbSBcIi4vdHJhbnNwb3J0cy9pbmRleC5qc1wiO1xuZXhwb3J0IHsgaW5zdGFsbFRpbWVyRnVuY3Rpb25zIH0gZnJvbSBcIi4vdXRpbC5qc1wiO1xuZXhwb3J0IHsgcGFyc2UgfSBmcm9tIFwiLi9jb250cmliL3BhcnNldXJpLmpzXCI7XG5leHBvcnQgeyBuZXh0VGljayB9IGZyb20gXCIuL2dsb2JhbHMubm9kZS5qc1wiO1xuZXhwb3J0IHsgRmV0Y2ggfSBmcm9tIFwiLi90cmFuc3BvcnRzL3BvbGxpbmctZmV0Y2guanNcIjtcbmV4cG9ydCB7IFhIUiBhcyBOb2RlWEhSIH0gZnJvbSBcIi4vdHJhbnNwb3J0cy9wb2xsaW5nLXhoci5ub2RlLmpzXCI7XG5leHBvcnQgeyBYSFIgfSBmcm9tIFwiLi90cmFuc3BvcnRzL3BvbGxpbmcteGhyLmpzXCI7XG5leHBvcnQgeyBXUyBhcyBOb2RlV2ViU29ja2V0IH0gZnJvbSBcIi4vdHJhbnNwb3J0cy93ZWJzb2NrZXQubm9kZS5qc1wiO1xuZXhwb3J0IHsgV1MgYXMgV2ViU29ja2V0IH0gZnJvbSBcIi4vdHJhbnNwb3J0cy93ZWJzb2NrZXQuanNcIjtcbmV4cG9ydCB7IFdUIGFzIFdlYlRyYW5zcG9ydCB9IGZyb20gXCIuL3RyYW5zcG9ydHMvd2VidHJhbnNwb3J0LmpzXCI7XG4iLCJpbXBvcnQgeyBwYXJzZSB9IGZyb20gXCJlbmdpbmUuaW8tY2xpZW50XCI7XG4vKipcbiAqIFVSTCBwYXJzZXIuXG4gKlxuICogQHBhcmFtIHVyaSAtIHVybFxuICogQHBhcmFtIHBhdGggLSB0aGUgcmVxdWVzdCBwYXRoIG9mIHRoZSBjb25uZWN0aW9uXG4gKiBAcGFyYW0gbG9jIC0gQW4gb2JqZWN0IG1lYW50IHRvIG1pbWljIHdpbmRvdy5sb2NhdGlvbi5cbiAqICAgICAgICBEZWZhdWx0cyB0byB3aW5kb3cubG9jYXRpb24uXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cmwodXJpLCBwYXRoID0gXCJcIiwgbG9jKSB7XG4gICAgbGV0IG9iaiA9IHVyaTtcbiAgICAvLyBkZWZhdWx0IHRvIHdpbmRvdy5sb2NhdGlvblxuICAgIGxvYyA9IGxvYyB8fCAodHlwZW9mIGxvY2F0aW9uICE9PSBcInVuZGVmaW5lZFwiICYmIGxvY2F0aW9uKTtcbiAgICBpZiAobnVsbCA9PSB1cmkpXG4gICAgICAgIHVyaSA9IGxvYy5wcm90b2NvbCArIFwiLy9cIiArIGxvYy5ob3N0O1xuICAgIC8vIHJlbGF0aXZlIHBhdGggc3VwcG9ydFxuICAgIGlmICh0eXBlb2YgdXJpID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGlmIChcIi9cIiA9PT0gdXJpLmNoYXJBdCgwKSkge1xuICAgICAgICAgICAgaWYgKFwiL1wiID09PSB1cmkuY2hhckF0KDEpKSB7XG4gICAgICAgICAgICAgICAgdXJpID0gbG9jLnByb3RvY29sICsgdXJpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXJpID0gbG9jLmhvc3QgKyB1cmk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEvXihodHRwcz98d3NzPyk6XFwvXFwvLy50ZXN0KHVyaSkpIHtcbiAgICAgICAgICAgIGlmIChcInVuZGVmaW5lZFwiICE9PSB0eXBlb2YgbG9jKSB7XG4gICAgICAgICAgICAgICAgdXJpID0gbG9jLnByb3RvY29sICsgXCIvL1wiICsgdXJpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdXJpID0gXCJodHRwczovL1wiICsgdXJpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIHBhcnNlXG4gICAgICAgIG9iaiA9IHBhcnNlKHVyaSk7XG4gICAgfVxuICAgIC8vIG1ha2Ugc3VyZSB3ZSB0cmVhdCBgbG9jYWxob3N0OjgwYCBhbmQgYGxvY2FsaG9zdGAgZXF1YWxseVxuICAgIGlmICghb2JqLnBvcnQpIHtcbiAgICAgICAgaWYgKC9eKGh0dHB8d3MpJC8udGVzdChvYmoucHJvdG9jb2wpKSB7XG4gICAgICAgICAgICBvYmoucG9ydCA9IFwiODBcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICgvXihodHRwfHdzKXMkLy50ZXN0KG9iai5wcm90b2NvbCkpIHtcbiAgICAgICAgICAgIG9iai5wb3J0ID0gXCI0NDNcIjtcbiAgICAgICAgfVxuICAgIH1cbiAgICBvYmoucGF0aCA9IG9iai5wYXRoIHx8IFwiL1wiO1xuICAgIGNvbnN0IGlwdjYgPSBvYmouaG9zdC5pbmRleE9mKFwiOlwiKSAhPT0gLTE7XG4gICAgY29uc3QgaG9zdCA9IGlwdjYgPyBcIltcIiArIG9iai5ob3N0ICsgXCJdXCIgOiBvYmouaG9zdDtcbiAgICAvLyBkZWZpbmUgdW5pcXVlIGlkXG4gICAgb2JqLmlkID0gb2JqLnByb3RvY29sICsgXCI6Ly9cIiArIGhvc3QgKyBcIjpcIiArIG9iai5wb3J0ICsgcGF0aDtcbiAgICAvLyBkZWZpbmUgaHJlZlxuICAgIG9iai5ocmVmID1cbiAgICAgICAgb2JqLnByb3RvY29sICtcbiAgICAgICAgICAgIFwiOi8vXCIgK1xuICAgICAgICAgICAgaG9zdCArXG4gICAgICAgICAgICAobG9jICYmIGxvYy5wb3J0ID09PSBvYmoucG9ydCA/IFwiXCIgOiBcIjpcIiArIG9iai5wb3J0KTtcbiAgICByZXR1cm4gb2JqO1xufVxuIiwiY29uc3Qgd2l0aE5hdGl2ZUFycmF5QnVmZmVyID0gdHlwZW9mIEFycmF5QnVmZmVyID09PSBcImZ1bmN0aW9uXCI7XG5jb25zdCBpc1ZpZXcgPSAob2JqKSA9PiB7XG4gICAgcmV0dXJuIHR5cGVvZiBBcnJheUJ1ZmZlci5pc1ZpZXcgPT09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/IEFycmF5QnVmZmVyLmlzVmlldyhvYmopXG4gICAgICAgIDogb2JqLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyO1xufTtcbmNvbnN0IHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbmNvbnN0IHdpdGhOYXRpdmVCbG9iID0gdHlwZW9mIEJsb2IgPT09IFwiZnVuY3Rpb25cIiB8fFxuICAgICh0eXBlb2YgQmxvYiAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgICB0b1N0cmluZy5jYWxsKEJsb2IpID09PSBcIltvYmplY3QgQmxvYkNvbnN0cnVjdG9yXVwiKTtcbmNvbnN0IHdpdGhOYXRpdmVGaWxlID0gdHlwZW9mIEZpbGUgPT09IFwiZnVuY3Rpb25cIiB8fFxuICAgICh0eXBlb2YgRmlsZSAhPT0gXCJ1bmRlZmluZWRcIiAmJlxuICAgICAgICB0b1N0cmluZy5jYWxsKEZpbGUpID09PSBcIltvYmplY3QgRmlsZUNvbnN0cnVjdG9yXVwiKTtcbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIG9iaiBpcyBhIEJ1ZmZlciwgYW4gQXJyYXlCdWZmZXIsIGEgQmxvYiBvciBhIEZpbGUuXG4gKlxuICogQHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQmluYXJ5KG9iaikge1xuICAgIHJldHVybiAoKHdpdGhOYXRpdmVBcnJheUJ1ZmZlciAmJiAob2JqIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIgfHwgaXNWaWV3KG9iaikpKSB8fFxuICAgICAgICAod2l0aE5hdGl2ZUJsb2IgJiYgb2JqIGluc3RhbmNlb2YgQmxvYikgfHxcbiAgICAgICAgKHdpdGhOYXRpdmVGaWxlICYmIG9iaiBpbnN0YW5jZW9mIEZpbGUpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBoYXNCaW5hcnkob2JqLCB0b0pTT04pIHtcbiAgICBpZiAoIW9iaiB8fCB0eXBlb2Ygb2JqICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IG9iai5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChoYXNCaW5hcnkob2JqW2ldKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGlzQmluYXJ5KG9iaikpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChvYmoudG9KU09OICYmXG4gICAgICAgIHR5cGVvZiBvYmoudG9KU09OID09PSBcImZ1bmN0aW9uXCIgJiZcbiAgICAgICAgYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICByZXR1cm4gaGFzQmluYXJ5KG9iai50b0pTT04oKSwgdHJ1ZSk7XG4gICAgfVxuICAgIGZvciAoY29uc3Qga2V5IGluIG9iaikge1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSAmJiBoYXNCaW5hcnkob2JqW2tleV0pKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59XG4iLCJpbXBvcnQgeyBpc0JpbmFyeSB9IGZyb20gXCIuL2lzLWJpbmFyeS5qc1wiO1xuLyoqXG4gKiBSZXBsYWNlcyBldmVyeSBCdWZmZXIgfCBBcnJheUJ1ZmZlciB8IEJsb2IgfCBGaWxlIGluIHBhY2tldCB3aXRoIGEgbnVtYmVyZWQgcGxhY2Vob2xkZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHBhY2tldCAtIHNvY2tldC5pbyBldmVudCBwYWNrZXRcbiAqIEByZXR1cm4ge09iamVjdH0gd2l0aCBkZWNvbnN0cnVjdGVkIHBhY2tldCBhbmQgbGlzdCBvZiBidWZmZXJzXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvbnN0cnVjdFBhY2tldChwYWNrZXQpIHtcbiAgICBjb25zdCBidWZmZXJzID0gW107XG4gICAgY29uc3QgcGFja2V0RGF0YSA9IHBhY2tldC5kYXRhO1xuICAgIGNvbnN0IHBhY2sgPSBwYWNrZXQ7XG4gICAgcGFjay5kYXRhID0gX2RlY29uc3RydWN0UGFja2V0KHBhY2tldERhdGEsIGJ1ZmZlcnMpO1xuICAgIHBhY2suYXR0YWNobWVudHMgPSBidWZmZXJzLmxlbmd0aDsgLy8gbnVtYmVyIG9mIGJpbmFyeSAnYXR0YWNobWVudHMnXG4gICAgcmV0dXJuIHsgcGFja2V0OiBwYWNrLCBidWZmZXJzOiBidWZmZXJzIH07XG59XG5mdW5jdGlvbiBfZGVjb25zdHJ1Y3RQYWNrZXQoZGF0YSwgYnVmZmVycywgdG9KU09OKSB7XG4gICAgaWYgKCFkYXRhKVxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICBpZiAoaXNCaW5hcnkoZGF0YSkpIHtcbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXIgPSB7IF9wbGFjZWhvbGRlcjogdHJ1ZSwgbnVtOiBidWZmZXJzLmxlbmd0aCB9O1xuICAgICAgICBidWZmZXJzLnB1c2goZGF0YSk7XG4gICAgICAgIHJldHVybiBwbGFjZWhvbGRlcjtcbiAgICB9XG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICBjb25zdCBuZXdEYXRhID0gbmV3IEFycmF5KGRhdGEubGVuZ3RoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBuZXdEYXRhW2ldID0gX2RlY29uc3RydWN0UGFja2V0KGRhdGFbaV0sIGJ1ZmZlcnMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdEYXRhO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gXCJvYmplY3RcIiAmJiAhKGRhdGEgaW5zdGFuY2VvZiBEYXRlKSkge1xuICAgICAgICBpZiAoZGF0YS50b0pTT04gJiYgdHlwZW9mIGRhdGEudG9KU09OID09PSBcImZ1bmN0aW9uXCIgJiYgIXRvSlNPTikge1xuICAgICAgICAgICAgcmV0dXJuIF9kZWNvbnN0cnVjdFBhY2tldChkYXRhLnRvSlNPTigpLCBidWZmZXJzLCB0cnVlKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBuZXdEYXRhID0ge307XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGRhdGEpIHtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZGF0YSwga2V5KSkge1xuICAgICAgICAgICAgICAgIG5ld0RhdGFba2V5XSA9IF9kZWNvbnN0cnVjdFBhY2tldChkYXRhW2tleV0sIGJ1ZmZlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdEYXRhO1xuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbn1cbi8qKlxuICogUmVjb25zdHJ1Y3RzIGEgYmluYXJ5IHBhY2tldCBmcm9tIGl0cyBwbGFjZWhvbGRlciBwYWNrZXQgYW5kIGJ1ZmZlcnNcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcGFja2V0IC0gZXZlbnQgcGFja2V0IHdpdGggcGxhY2Vob2xkZXJzXG4gKiBAcGFyYW0ge0FycmF5fSBidWZmZXJzIC0gYmluYXJ5IGJ1ZmZlcnMgdG8gcHV0IGluIHBsYWNlaG9sZGVyIHBvc2l0aW9uc1xuICogQHJldHVybiB7T2JqZWN0fSByZWNvbnN0cnVjdGVkIHBhY2tldFxuICogQHB1YmxpY1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb25zdHJ1Y3RQYWNrZXQocGFja2V0LCBidWZmZXJzKSB7XG4gICAgcGFja2V0LmRhdGEgPSBfcmVjb25zdHJ1Y3RQYWNrZXQocGFja2V0LmRhdGEsIGJ1ZmZlcnMpO1xuICAgIGRlbGV0ZSBwYWNrZXQuYXR0YWNobWVudHM7IC8vIG5vIGxvbmdlciB1c2VmdWxcbiAgICByZXR1cm4gcGFja2V0O1xufVxuZnVuY3Rpb24gX3JlY29uc3RydWN0UGFja2V0KGRhdGEsIGJ1ZmZlcnMpIHtcbiAgICBpZiAoIWRhdGEpXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIGlmIChkYXRhICYmIGRhdGEuX3BsYWNlaG9sZGVyID09PSB0cnVlKSB7XG4gICAgICAgIGNvbnN0IGlzSW5kZXhWYWxpZCA9IHR5cGVvZiBkYXRhLm51bSA9PT0gXCJudW1iZXJcIiAmJlxuICAgICAgICAgICAgZGF0YS5udW0gPj0gMCAmJlxuICAgICAgICAgICAgZGF0YS5udW0gPCBidWZmZXJzLmxlbmd0aDtcbiAgICAgICAgaWYgKGlzSW5kZXhWYWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcnNbZGF0YS5udW1dOyAvLyBhcHByb3ByaWF0ZSBidWZmZXIgKHNob3VsZCBiZSBuYXR1cmFsIG9yZGVyIGFueXdheSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImlsbGVnYWwgYXR0YWNobWVudHNcIik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGRhdGFbaV0gPSBfcmVjb25zdHJ1Y3RQYWNrZXQoZGF0YVtpXSwgYnVmZmVycyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZGF0YSkge1xuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChkYXRhLCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgZGF0YVtrZXldID0gX3JlY29uc3RydWN0UGFja2V0KGRhdGFba2V5XSwgYnVmZmVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG59XG4iLCJpbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSBcIkBzb2NrZXQuaW8vY29tcG9uZW50LWVtaXR0ZXJcIjtcbmltcG9ydCB7IGRlY29uc3RydWN0UGFja2V0LCByZWNvbnN0cnVjdFBhY2tldCB9IGZyb20gXCIuL2JpbmFyeS5qc1wiO1xuaW1wb3J0IHsgaXNCaW5hcnksIGhhc0JpbmFyeSB9IGZyb20gXCIuL2lzLWJpbmFyeS5qc1wiO1xuLyoqXG4gKiBUaGVzZSBzdHJpbmdzIG11c3Qgbm90IGJlIHVzZWQgYXMgZXZlbnQgbmFtZXMsIGFzIHRoZXkgaGF2ZSBhIHNwZWNpYWwgbWVhbmluZy5cbiAqL1xuY29uc3QgUkVTRVJWRURfRVZFTlRTID0gW1xuICAgIFwiY29ubmVjdFwiLCAvLyB1c2VkIG9uIHRoZSBjbGllbnQgc2lkZVxuICAgIFwiY29ubmVjdF9lcnJvclwiLCAvLyB1c2VkIG9uIHRoZSBjbGllbnQgc2lkZVxuICAgIFwiZGlzY29ubmVjdFwiLCAvLyB1c2VkIG9uIGJvdGggc2lkZXNcbiAgICBcImRpc2Nvbm5lY3RpbmdcIiwgLy8gdXNlZCBvbiB0aGUgc2VydmVyIHNpZGVcbiAgICBcIm5ld0xpc3RlbmVyXCIsIC8vIHVzZWQgYnkgdGhlIE5vZGUuanMgRXZlbnRFbWl0dGVyXG4gICAgXCJyZW1vdmVMaXN0ZW5lclwiLCAvLyB1c2VkIGJ5IHRoZSBOb2RlLmpzIEV2ZW50RW1pdHRlclxuXTtcbi8qKlxuICogUHJvdG9jb2wgdmVyc2lvbi5cbiAqXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBjb25zdCBwcm90b2NvbCA9IDU7XG5leHBvcnQgdmFyIFBhY2tldFR5cGU7XG4oZnVuY3Rpb24gKFBhY2tldFR5cGUpIHtcbiAgICBQYWNrZXRUeXBlW1BhY2tldFR5cGVbXCJDT05ORUNUXCJdID0gMF0gPSBcIkNPTk5FQ1RcIjtcbiAgICBQYWNrZXRUeXBlW1BhY2tldFR5cGVbXCJESVNDT05ORUNUXCJdID0gMV0gPSBcIkRJU0NPTk5FQ1RcIjtcbiAgICBQYWNrZXRUeXBlW1BhY2tldFR5cGVbXCJFVkVOVFwiXSA9IDJdID0gXCJFVkVOVFwiO1xuICAgIFBhY2tldFR5cGVbUGFja2V0VHlwZVtcIkFDS1wiXSA9IDNdID0gXCJBQ0tcIjtcbiAgICBQYWNrZXRUeXBlW1BhY2tldFR5cGVbXCJDT05ORUNUX0VSUk9SXCJdID0gNF0gPSBcIkNPTk5FQ1RfRVJST1JcIjtcbiAgICBQYWNrZXRUeXBlW1BhY2tldFR5cGVbXCJCSU5BUllfRVZFTlRcIl0gPSA1XSA9IFwiQklOQVJZX0VWRU5UXCI7XG4gICAgUGFja2V0VHlwZVtQYWNrZXRUeXBlW1wiQklOQVJZX0FDS1wiXSA9IDZdID0gXCJCSU5BUllfQUNLXCI7XG59KShQYWNrZXRUeXBlIHx8IChQYWNrZXRUeXBlID0ge30pKTtcbi8qKlxuICogQSBzb2NrZXQuaW8gRW5jb2RlciBpbnN0YW5jZVxuICovXG5leHBvcnQgY2xhc3MgRW5jb2RlciB7XG4gICAgLyoqXG4gICAgICogRW5jb2RlciBjb25zdHJ1Y3RvclxuICAgICAqXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gcmVwbGFjZXIgLSBjdXN0b20gcmVwbGFjZXIgdG8gcGFzcyBkb3duIHRvIEpTT04ucGFyc2VcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihyZXBsYWNlcikge1xuICAgICAgICB0aGlzLnJlcGxhY2VyID0gcmVwbGFjZXI7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEVuY29kZSBhIHBhY2tldCBhcyBhIHNpbmdsZSBzdHJpbmcgaWYgbm9uLWJpbmFyeSwgb3IgYXMgYVxuICAgICAqIGJ1ZmZlciBzZXF1ZW5jZSwgZGVwZW5kaW5nIG9uIHBhY2tldCB0eXBlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIHBhY2tldCBvYmplY3RcbiAgICAgKi9cbiAgICBlbmNvZGUob2JqKSB7XG4gICAgICAgIGlmIChvYmoudHlwZSA9PT0gUGFja2V0VHlwZS5FVkVOVCB8fCBvYmoudHlwZSA9PT0gUGFja2V0VHlwZS5BQ0spIHtcbiAgICAgICAgICAgIGlmIChoYXNCaW5hcnkob2JqKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmVuY29kZUFzQmluYXJ5KHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogb2JqLnR5cGUgPT09IFBhY2tldFR5cGUuRVZFTlRcbiAgICAgICAgICAgICAgICAgICAgICAgID8gUGFja2V0VHlwZS5CSU5BUllfRVZFTlRcbiAgICAgICAgICAgICAgICAgICAgICAgIDogUGFja2V0VHlwZS5CSU5BUllfQUNLLFxuICAgICAgICAgICAgICAgICAgICBuc3A6IG9iai5uc3AsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IG9iai5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBpZDogb2JqLmlkLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbdGhpcy5lbmNvZGVBc1N0cmluZyhvYmopXTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRW5jb2RlIHBhY2tldCBhcyBzdHJpbmcuXG4gICAgICovXG4gICAgZW5jb2RlQXNTdHJpbmcob2JqKSB7XG4gICAgICAgIC8vIGZpcnN0IGlzIHR5cGVcbiAgICAgICAgbGV0IHN0ciA9IFwiXCIgKyBvYmoudHlwZTtcbiAgICAgICAgLy8gYXR0YWNobWVudHMgaWYgd2UgaGF2ZSB0aGVtXG4gICAgICAgIGlmIChvYmoudHlwZSA9PT0gUGFja2V0VHlwZS5CSU5BUllfRVZFTlQgfHxcbiAgICAgICAgICAgIG9iai50eXBlID09PSBQYWNrZXRUeXBlLkJJTkFSWV9BQ0spIHtcbiAgICAgICAgICAgIHN0ciArPSBvYmouYXR0YWNobWVudHMgKyBcIi1cIjtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiB3ZSBoYXZlIGEgbmFtZXNwYWNlIG90aGVyIHRoYW4gYC9gXG4gICAgICAgIC8vIHdlIGFwcGVuZCBpdCBmb2xsb3dlZCBieSBhIGNvbW1hIGAsYFxuICAgICAgICBpZiAob2JqLm5zcCAmJiBcIi9cIiAhPT0gb2JqLm5zcCkge1xuICAgICAgICAgICAgc3RyICs9IG9iai5uc3AgKyBcIixcIjtcbiAgICAgICAgfVxuICAgICAgICAvLyBpbW1lZGlhdGVseSBmb2xsb3dlZCBieSB0aGUgaWRcbiAgICAgICAgaWYgKG51bGwgIT0gb2JqLmlkKSB7XG4gICAgICAgICAgICBzdHIgKz0gb2JqLmlkO1xuICAgICAgICB9XG4gICAgICAgIC8vIGpzb24gZGF0YVxuICAgICAgICBpZiAobnVsbCAhPSBvYmouZGF0YSkge1xuICAgICAgICAgICAgc3RyICs9IEpTT04uc3RyaW5naWZ5KG9iai5kYXRhLCB0aGlzLnJlcGxhY2VyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBFbmNvZGUgcGFja2V0IGFzICdidWZmZXIgc2VxdWVuY2UnIGJ5IHJlbW92aW5nIGJsb2JzLCBhbmRcbiAgICAgKiBkZWNvbnN0cnVjdGluZyBwYWNrZXQgaW50byBvYmplY3Qgd2l0aCBwbGFjZWhvbGRlcnMgYW5kXG4gICAgICogYSBsaXN0IG9mIGJ1ZmZlcnMuXG4gICAgICovXG4gICAgZW5jb2RlQXNCaW5hcnkob2JqKSB7XG4gICAgICAgIGNvbnN0IGRlY29uc3RydWN0aW9uID0gZGVjb25zdHJ1Y3RQYWNrZXQob2JqKTtcbiAgICAgICAgY29uc3QgcGFjayA9IHRoaXMuZW5jb2RlQXNTdHJpbmcoZGVjb25zdHJ1Y3Rpb24ucGFja2V0KTtcbiAgICAgICAgY29uc3QgYnVmZmVycyA9IGRlY29uc3RydWN0aW9uLmJ1ZmZlcnM7XG4gICAgICAgIGJ1ZmZlcnMudW5zaGlmdChwYWNrKTsgLy8gYWRkIHBhY2tldCBpbmZvIHRvIGJlZ2lubmluZyBvZiBkYXRhIGxpc3RcbiAgICAgICAgcmV0dXJuIGJ1ZmZlcnM7IC8vIHdyaXRlIGFsbCB0aGUgYnVmZmVyc1xuICAgIH1cbn1cbi8qKlxuICogQSBzb2NrZXQuaW8gRGVjb2RlciBpbnN0YW5jZVxuICpcbiAqIEByZXR1cm4ge09iamVjdH0gZGVjb2RlclxuICovXG5leHBvcnQgY2xhc3MgRGVjb2RlciBleHRlbmRzIEVtaXR0ZXIge1xuICAgIC8qKlxuICAgICAqIERlY29kZXIgY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihvcHRzKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgICAgICAgcmV2aXZlcjogdW5kZWZpbmVkLFxuICAgICAgICAgICAgbWF4QXR0YWNobWVudHM6IDEwLFxuICAgICAgICB9LCB0eXBlb2Ygb3B0cyA9PT0gXCJmdW5jdGlvblwiID8geyByZXZpdmVyOiBvcHRzIH0gOiBvcHRzKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRGVjb2RlcyBhbiBlbmNvZGVkIHBhY2tldCBzdHJpbmcgaW50byBwYWNrZXQgSlNPTi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBvYmogLSBlbmNvZGVkIHBhY2tldFxuICAgICAqL1xuICAgIGFkZChvYmopIHtcbiAgICAgICAgbGV0IHBhY2tldDtcbiAgICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlY29uc3RydWN0b3IpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJnb3QgcGxhaW50ZXh0IGRhdGEgd2hlbiByZWNvbnN0cnVjdGluZyBhIHBhY2tldFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhY2tldCA9IHRoaXMuZGVjb2RlU3RyaW5nKG9iaik7XG4gICAgICAgICAgICBjb25zdCBpc0JpbmFyeUV2ZW50ID0gcGFja2V0LnR5cGUgPT09IFBhY2tldFR5cGUuQklOQVJZX0VWRU5UO1xuICAgICAgICAgICAgaWYgKGlzQmluYXJ5RXZlbnQgfHwgcGFja2V0LnR5cGUgPT09IFBhY2tldFR5cGUuQklOQVJZX0FDSykge1xuICAgICAgICAgICAgICAgIHBhY2tldC50eXBlID0gaXNCaW5hcnlFdmVudCA/IFBhY2tldFR5cGUuRVZFTlQgOiBQYWNrZXRUeXBlLkFDSztcbiAgICAgICAgICAgICAgICAvLyBiaW5hcnkgcGFja2V0J3MganNvblxuICAgICAgICAgICAgICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG5ldyBCaW5hcnlSZWNvbnN0cnVjdG9yKHBhY2tldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBub24tYmluYXJ5IGZ1bGwgcGFja2V0XG4gICAgICAgICAgICAgICAgc3VwZXIuZW1pdFJlc2VydmVkKFwiZGVjb2RlZFwiLCBwYWNrZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQmluYXJ5KG9iaikgfHwgb2JqLmJhc2U2NCkge1xuICAgICAgICAgICAgLy8gcmF3IGJpbmFyeSBkYXRhXG4gICAgICAgICAgICBpZiAoIXRoaXMucmVjb25zdHJ1Y3Rvcikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImdvdCBiaW5hcnkgZGF0YSB3aGVuIG5vdCByZWNvbnN0cnVjdGluZyBhIHBhY2tldFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhY2tldCA9IHRoaXMucmVjb25zdHJ1Y3Rvci50YWtlQmluYXJ5RGF0YShvYmopO1xuICAgICAgICAgICAgICAgIGlmIChwYWNrZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVjZWl2ZWQgZmluYWwgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHN1cGVyLmVtaXRSZXNlcnZlZChcImRlY29kZWRcIiwgcGFja2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHR5cGU6IFwiICsgb2JqKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBEZWNvZGUgYSBwYWNrZXQgU3RyaW5nIChKU09OIGRhdGEpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSBwYWNrZXRcbiAgICAgKi9cbiAgICBkZWNvZGVTdHJpbmcoc3RyKSB7XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgLy8gbG9vayB1cCB0eXBlXG4gICAgICAgIGNvbnN0IHAgPSB7XG4gICAgICAgICAgICB0eXBlOiBOdW1iZXIoc3RyLmNoYXJBdCgwKSksXG4gICAgICAgIH07XG4gICAgICAgIGlmIChQYWNrZXRUeXBlW3AudHlwZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwidW5rbm93biBwYWNrZXQgdHlwZSBcIiArIHAudHlwZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbG9vayB1cCBhdHRhY2htZW50cyBpZiB0eXBlIGJpbmFyeVxuICAgICAgICBpZiAocC50eXBlID09PSBQYWNrZXRUeXBlLkJJTkFSWV9FVkVOVCB8fFxuICAgICAgICAgICAgcC50eXBlID09PSBQYWNrZXRUeXBlLkJJTkFSWV9BQ0spIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgICB3aGlsZSAoc3RyLmNoYXJBdCgrK2kpICE9PSBcIi1cIiAmJiBpICE9IHN0ci5sZW5ndGgpIHsgfVxuICAgICAgICAgICAgY29uc3QgYnVmID0gc3RyLnN1YnN0cmluZyhzdGFydCwgaSk7XG4gICAgICAgICAgICBpZiAoYnVmICE9IE51bWJlcihidWYpIHx8IHN0ci5jaGFyQXQoaSkgIT09IFwiLVwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSWxsZWdhbCBhdHRhY2htZW50c1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG4gPSBOdW1iZXIoYnVmKTtcbiAgICAgICAgICAgIGlmICghaXNJbnRlZ2VyKG4pIHx8IG4gPCAxKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSWxsZWdhbCBhdHRhY2htZW50c1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG4gPiB0aGlzLm9wdHMubWF4QXR0YWNobWVudHMpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0b28gbWFueSBhdHRhY2htZW50c1wiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHAuYXR0YWNobWVudHMgPSBuO1xuICAgICAgICB9XG4gICAgICAgIC8vIGxvb2sgdXAgbmFtZXNwYWNlIChpZiBhbnkpXG4gICAgICAgIGlmIChcIi9cIiA9PT0gc3RyLmNoYXJBdChpICsgMSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgICB3aGlsZSAoKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYyA9IHN0ci5jaGFyQXQoaSk7XG4gICAgICAgICAgICAgICAgaWYgKFwiLFwiID09PSBjKVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBpZiAoaSA9PT0gc3RyLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwLm5zcCA9IHN0ci5zdWJzdHJpbmcoc3RhcnQsIGkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcC5uc3AgPSBcIi9cIjtcbiAgICAgICAgfVxuICAgICAgICAvLyBsb29rIHVwIGlkXG4gICAgICAgIGNvbnN0IG5leHQgPSBzdHIuY2hhckF0KGkgKyAxKTtcbiAgICAgICAgaWYgKFwiXCIgIT09IG5leHQgJiYgTnVtYmVyKG5leHQpID09IG5leHQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gaSArIDE7XG4gICAgICAgICAgICB3aGlsZSAoKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYyA9IHN0ci5jaGFyQXQoaSk7XG4gICAgICAgICAgICAgICAgaWYgKG51bGwgPT0gYyB8fCBOdW1iZXIoYykgIT0gYykge1xuICAgICAgICAgICAgICAgICAgICAtLWk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoaSA9PT0gc3RyLmxlbmd0aClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwLmlkID0gTnVtYmVyKHN0ci5zdWJzdHJpbmcoc3RhcnQsIGkgKyAxKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbG9vayB1cCBqc29uIGRhdGFcbiAgICAgICAgaWYgKHN0ci5jaGFyQXQoKytpKSkge1xuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHRoaXMudHJ5UGFyc2Uoc3RyLnN1YnN0cihpKSk7XG4gICAgICAgICAgICBpZiAoRGVjb2Rlci5pc1BheWxvYWRWYWxpZChwLnR5cGUsIHBheWxvYWQpKSB7XG4gICAgICAgICAgICAgICAgcC5kYXRhID0gcGF5bG9hZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImludmFsaWQgcGF5bG9hZFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgdHJ5UGFyc2Uoc3RyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShzdHIsIHRoaXMub3B0cy5yZXZpdmVyKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHN0YXRpYyBpc1BheWxvYWRWYWxpZCh0eXBlLCBwYXlsb2FkKSB7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkNPTk5FQ1Q6XG4gICAgICAgICAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHBheWxvYWQpO1xuICAgICAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkRJU0NPTk5FQ1Q6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBheWxvYWQgPT09IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5DT05ORUNUX0VSUk9SOlxuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgcGF5bG9hZCA9PT0gXCJzdHJpbmdcIiB8fCBpc09iamVjdChwYXlsb2FkKTtcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5FVkVOVDpcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5CSU5BUllfRVZFTlQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuIChBcnJheS5pc0FycmF5KHBheWxvYWQpICYmXG4gICAgICAgICAgICAgICAgICAgICh0eXBlb2YgcGF5bG9hZFswXSA9PT0gXCJudW1iZXJcIiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgKHR5cGVvZiBwYXlsb2FkWzBdID09PSBcInN0cmluZ1wiICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUkVTRVJWRURfRVZFTlRTLmluZGV4T2YocGF5bG9hZFswXSkgPT09IC0xKSkpO1xuICAgICAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkFDSzpcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5CSU5BUllfQUNLOlxuICAgICAgICAgICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBheWxvYWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERlYWxsb2NhdGVzIGEgcGFyc2VyJ3MgcmVzb3VyY2VzXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMucmVjb25zdHJ1Y3Rvcikge1xuICAgICAgICAgICAgdGhpcy5yZWNvbnN0cnVjdG9yLmZpbmlzaGVkUmVjb25zdHJ1Y3Rpb24oKTtcbiAgICAgICAgICAgIHRoaXMucmVjb25zdHJ1Y3RvciA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59XG4vKipcbiAqIEEgbWFuYWdlciBvZiBhIGJpbmFyeSBldmVudCdzICdidWZmZXIgc2VxdWVuY2UnLiBTaG91bGRcbiAqIGJlIGNvbnN0cnVjdGVkIHdoZW5ldmVyIGEgcGFja2V0IG9mIHR5cGUgQklOQVJZX0VWRU5UIGlzXG4gKiBkZWNvZGVkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYWNrZXRcbiAqIEByZXR1cm4ge0JpbmFyeVJlY29uc3RydWN0b3J9IGluaXRpYWxpemVkIHJlY29uc3RydWN0b3JcbiAqL1xuY2xhc3MgQmluYXJ5UmVjb25zdHJ1Y3RvciB7XG4gICAgY29uc3RydWN0b3IocGFja2V0KSB7XG4gICAgICAgIHRoaXMucGFja2V0ID0gcGFja2V0O1xuICAgICAgICB0aGlzLmJ1ZmZlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5yZWNvblBhY2sgPSBwYWNrZXQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE1ldGhvZCB0byBiZSBjYWxsZWQgd2hlbiBiaW5hcnkgZGF0YSByZWNlaXZlZCBmcm9tIGNvbm5lY3Rpb25cbiAgICAgKiBhZnRlciBhIEJJTkFSWV9FVkVOVCBwYWNrZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0J1ZmZlciB8IEFycmF5QnVmZmVyfSBiaW5EYXRhIC0gdGhlIHJhdyBiaW5hcnkgZGF0YSByZWNlaXZlZFxuICAgICAqIEByZXR1cm4ge251bGwgfCBPYmplY3R9IHJldHVybnMgbnVsbCBpZiBtb3JlIGJpbmFyeSBkYXRhIGlzIGV4cGVjdGVkIG9yXG4gICAgICogICBhIHJlY29uc3RydWN0ZWQgcGFja2V0IG9iamVjdCBpZiBhbGwgYnVmZmVycyBoYXZlIGJlZW4gcmVjZWl2ZWQuXG4gICAgICovXG4gICAgdGFrZUJpbmFyeURhdGEoYmluRGF0YSkge1xuICAgICAgICB0aGlzLmJ1ZmZlcnMucHVzaChiaW5EYXRhKTtcbiAgICAgICAgaWYgKHRoaXMuYnVmZmVycy5sZW5ndGggPT09IHRoaXMucmVjb25QYWNrLmF0dGFjaG1lbnRzKSB7XG4gICAgICAgICAgICAvLyBkb25lIHdpdGggYnVmZmVyIGxpc3RcbiAgICAgICAgICAgIGNvbnN0IHBhY2tldCA9IHJlY29uc3RydWN0UGFja2V0KHRoaXMucmVjb25QYWNrLCB0aGlzLmJ1ZmZlcnMpO1xuICAgICAgICAgICAgdGhpcy5maW5pc2hlZFJlY29uc3RydWN0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm4gcGFja2V0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbGVhbnMgdXAgYmluYXJ5IHBhY2tldCByZWNvbnN0cnVjdGlvbiB2YXJpYWJsZXMuXG4gICAgICovXG4gICAgZmluaXNoZWRSZWNvbnN0cnVjdGlvbigpIHtcbiAgICAgICAgdGhpcy5yZWNvblBhY2sgPSBudWxsO1xuICAgICAgICB0aGlzLmJ1ZmZlcnMgPSBbXTtcbiAgICB9XG59XG5mdW5jdGlvbiBpc05hbWVzcGFjZVZhbGlkKG5zcCkge1xuICAgIHJldHVybiB0eXBlb2YgbnNwID09PSBcInN0cmluZ1wiO1xufVxuLy8gc2VlIGh0dHBzOi8vY2FuaXVzZS5jb20vbWRuLWphdmFzY3JpcHRfYnVpbHRpbnNfbnVtYmVyX2lzaW50ZWdlclxuY29uc3QgaXNJbnRlZ2VyID0gTnVtYmVyLmlzSW50ZWdlciB8fFxuICAgIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIiAmJlxuICAgICAgICAgICAgaXNGaW5pdGUodmFsdWUpICYmXG4gICAgICAgICAgICBNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWUpO1xuICAgIH07XG5mdW5jdGlvbiBpc0Fja0lkVmFsaWQoaWQpIHtcbiAgICByZXR1cm4gaWQgPT09IHVuZGVmaW5lZCB8fCBpc0ludGVnZXIoaWQpO1xufVxuLy8gc2VlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzg1MTEyODEvY2hlY2staWYtYS12YWx1ZS1pcy1hbi1vYmplY3QtaW4tamF2YXNjcmlwdFxuZnVuY3Rpb24gaXNPYmplY3QodmFsdWUpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gXCJbb2JqZWN0IE9iamVjdF1cIjtcbn1cbmZ1bmN0aW9uIGlzRGF0YVZhbGlkKHR5cGUsIHBheWxvYWQpIHtcbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkNPTk5FQ1Q6XG4gICAgICAgICAgICByZXR1cm4gcGF5bG9hZCA9PT0gdW5kZWZpbmVkIHx8IGlzT2JqZWN0KHBheWxvYWQpO1xuICAgICAgICBjYXNlIFBhY2tldFR5cGUuRElTQ09OTkVDVDpcbiAgICAgICAgICAgIHJldHVybiBwYXlsb2FkID09PSB1bmRlZmluZWQ7XG4gICAgICAgIGNhc2UgUGFja2V0VHlwZS5FVkVOVDpcbiAgICAgICAgICAgIHJldHVybiAoQXJyYXkuaXNBcnJheShwYXlsb2FkKSAmJlxuICAgICAgICAgICAgICAgICh0eXBlb2YgcGF5bG9hZFswXSA9PT0gXCJudW1iZXJcIiB8fFxuICAgICAgICAgICAgICAgICAgICAodHlwZW9mIHBheWxvYWRbMF0gPT09IFwic3RyaW5nXCIgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIFJFU0VSVkVEX0VWRU5UUy5pbmRleE9mKHBheWxvYWRbMF0pID09PSAtMSkpKTtcbiAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkFDSzpcbiAgICAgICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KHBheWxvYWQpO1xuICAgICAgICBjYXNlIFBhY2tldFR5cGUuQ09OTkVDVF9FUlJPUjpcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgcGF5bG9hZCA9PT0gXCJzdHJpbmdcIiB8fCBpc09iamVjdChwYXlsb2FkKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5leHBvcnQgZnVuY3Rpb24gaXNQYWNrZXRWYWxpZChwYWNrZXQpIHtcbiAgICByZXR1cm4gKGlzTmFtZXNwYWNlVmFsaWQocGFja2V0Lm5zcCkgJiZcbiAgICAgICAgaXNBY2tJZFZhbGlkKHBhY2tldC5pZCkgJiZcbiAgICAgICAgaXNEYXRhVmFsaWQocGFja2V0LnR5cGUsIHBhY2tldC5kYXRhKSk7XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gb24ob2JqLCBldiwgZm4pIHtcbiAgICBvYmoub24oZXYsIGZuKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gc3ViRGVzdHJveSgpIHtcbiAgICAgICAgb2JqLm9mZihldiwgZm4pO1xuICAgIH07XG59XG4iLCJpbXBvcnQgeyBQYWNrZXRUeXBlIH0gZnJvbSBcInNvY2tldC5pby1wYXJzZXJcIjtcbmltcG9ydCB7IG9uIH0gZnJvbSBcIi4vb24uanNcIjtcbmltcG9ydCB7IEVtaXR0ZXIsIH0gZnJvbSBcIkBzb2NrZXQuaW8vY29tcG9uZW50LWVtaXR0ZXJcIjtcbi8qKlxuICogSW50ZXJuYWwgZXZlbnRzLlxuICogVGhlc2UgZXZlbnRzIGNhbid0IGJlIGVtaXR0ZWQgYnkgdGhlIHVzZXIuXG4gKi9cbmNvbnN0IFJFU0VSVkVEX0VWRU5UUyA9IE9iamVjdC5mcmVlemUoe1xuICAgIGNvbm5lY3Q6IDEsXG4gICAgY29ubmVjdF9lcnJvcjogMSxcbiAgICBkaXNjb25uZWN0OiAxLFxuICAgIGRpc2Nvbm5lY3Rpbmc6IDEsXG4gICAgLy8gRXZlbnRFbWl0dGVyIHJlc2VydmVkIGV2ZW50czogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9ldmVudHMuaHRtbCNldmVudHNfZXZlbnRfbmV3bGlzdGVuZXJcbiAgICBuZXdMaXN0ZW5lcjogMSxcbiAgICByZW1vdmVMaXN0ZW5lcjogMSxcbn0pO1xuLyoqXG4gKiBBIFNvY2tldCBpcyB0aGUgZnVuZGFtZW50YWwgY2xhc3MgZm9yIGludGVyYWN0aW5nIHdpdGggdGhlIHNlcnZlci5cbiAqXG4gKiBBIFNvY2tldCBiZWxvbmdzIHRvIGEgY2VydGFpbiBOYW1lc3BhY2UgKGJ5IGRlZmF1bHQgLykgYW5kIHVzZXMgYW4gdW5kZXJseWluZyB7QGxpbmsgTWFuYWdlcn0gdG8gY29tbXVuaWNhdGUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHNvY2tldCA9IGlvKCk7XG4gKlxuICogc29ja2V0Lm9uKFwiY29ubmVjdFwiLCAoKSA9PiB7XG4gKiAgIGNvbnNvbGUubG9nKFwiY29ubmVjdGVkXCIpO1xuICogfSk7XG4gKlxuICogLy8gc2VuZCBhbiBldmVudCB0byB0aGUgc2VydmVyXG4gKiBzb2NrZXQuZW1pdChcImZvb1wiLCBcImJhclwiKTtcbiAqXG4gKiBzb2NrZXQub24oXCJmb29iYXJcIiwgKCkgPT4ge1xuICogICAvLyBhbiBldmVudCB3YXMgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyXG4gKiB9KTtcbiAqXG4gKiAvLyB1cG9uIGRpc2Nvbm5lY3Rpb25cbiAqIHNvY2tldC5vbihcImRpc2Nvbm5lY3RcIiwgKHJlYXNvbikgPT4ge1xuICogICBjb25zb2xlLmxvZyhgZGlzY29ubmVjdGVkIGR1ZSB0byAke3JlYXNvbn1gKTtcbiAqIH0pO1xuICovXG5leHBvcnQgY2xhc3MgU29ja2V0IGV4dGVuZHMgRW1pdHRlciB7XG4gICAgLyoqXG4gICAgICogYFNvY2tldGAgY29uc3RydWN0b3IuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoaW8sIG5zcCwgb3B0cykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgc29ja2V0IGlzIGN1cnJlbnRseSBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogY29uc3Qgc29ja2V0ID0gaW8oKTtcbiAgICAgICAgICpcbiAgICAgICAgICogc29ja2V0Lm9uKFwiY29ubmVjdFwiLCAoKSA9PiB7XG4gICAgICAgICAqICAgY29uc29sZS5sb2coc29ja2V0LmNvbm5lY3RlZCk7IC8vIHRydWVcbiAgICAgICAgICogfSk7XG4gICAgICAgICAqXG4gICAgICAgICAqIHNvY2tldC5vbihcImRpc2Nvbm5lY3RcIiwgKCkgPT4ge1xuICAgICAgICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5jb25uZWN0ZWQpOyAvLyBmYWxzZVxuICAgICAgICAgKiB9KTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIHRoZSBjb25uZWN0aW9uIHN0YXRlIHdhcyByZWNvdmVyZWQgYWZ0ZXIgYSB0ZW1wb3JhcnkgZGlzY29ubmVjdGlvbi4gSW4gdGhhdCBjYXNlLCBhbnkgbWlzc2VkIHBhY2tldHMgd2lsbFxuICAgICAgICAgKiBiZSB0cmFuc21pdHRlZCBieSB0aGUgc2VydmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZWNvdmVyZWQgPSBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1ZmZlciBmb3IgcGFja2V0cyByZWNlaXZlZCBiZWZvcmUgdGhlIENPTk5FQ1QgcGFja2V0XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlY2VpdmVCdWZmZXIgPSBbXTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEJ1ZmZlciBmb3IgcGFja2V0cyB0aGF0IHdpbGwgYmUgc2VudCBvbmNlIHRoZSBzb2NrZXQgaXMgY29ubmVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNlbmRCdWZmZXIgPSBbXTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBxdWV1ZSBvZiBwYWNrZXRzIHRvIGJlIHNlbnQgd2l0aCByZXRyeSBpbiBjYXNlIG9mIGZhaWx1cmUuXG4gICAgICAgICAqXG4gICAgICAgICAqIFBhY2tldHMgYXJlIHNlbnQgb25lIGJ5IG9uZSwgZWFjaCB3YWl0aW5nIGZvciB0aGUgc2VydmVyIGFja25vd2xlZGdlbWVudCwgaW4gb3JkZXIgdG8gZ3VhcmFudGVlIHRoZSBkZWxpdmVyeSBvcmRlci5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3F1ZXVlID0gW107XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHNlcXVlbmNlIHRvIGdlbmVyYXRlIHRoZSBJRCBvZiB0aGUge0BsaW5rIFF1ZXVlZFBhY2tldH0uXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9xdWV1ZVNlcSA9IDA7XG4gICAgICAgIHRoaXMuaWRzID0gMDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgbWFwIGNvbnRhaW5pbmcgYWNrbm93bGVkZ2VtZW50IGhhbmRsZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBUaGUgYHdpdGhFcnJvcmAgYXR0cmlidXRlIGlzIHVzZWQgdG8gZGlmZmVyZW50aWF0ZSBoYW5kbGVycyB0aGF0IGFjY2VwdCBhbiBlcnJvciBhcyBmaXJzdCBhcmd1bWVudDpcbiAgICAgICAgICpcbiAgICAgICAgICogLSBgc29ja2V0LmVtaXQoXCJ0ZXN0XCIsIChlcnIsIHZhbHVlKSA9PiB7IC4uLiB9KWAgd2l0aCBgYWNrVGltZW91dGAgb3B0aW9uXG4gICAgICAgICAqIC0gYHNvY2tldC50aW1lb3V0KDUwMDApLmVtaXQoXCJ0ZXN0XCIsIChlcnIsIHZhbHVlKSA9PiB7IC4uLiB9KWBcbiAgICAgICAgICogLSBgY29uc3QgdmFsdWUgPSBhd2FpdCBzb2NrZXQuZW1pdFdpdGhBY2soXCJ0ZXN0XCIpYFxuICAgICAgICAgKlxuICAgICAgICAgKiBGcm9tIHRob3NlIHRoYXQgZG9uJ3Q6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gYHNvY2tldC5lbWl0KFwidGVzdFwiLCAodmFsdWUpID0+IHsgLi4uIH0pO2BcbiAgICAgICAgICpcbiAgICAgICAgICogSW4gdGhlIGZpcnN0IGNhc2UsIHRoZSBoYW5kbGVycyB3aWxsIGJlIGNhbGxlZCB3aXRoIGFuIGVycm9yIHdoZW46XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gdGhlIHRpbWVvdXQgaXMgcmVhY2hlZFxuICAgICAgICAgKiAtIHRoZSBzb2NrZXQgZ2V0cyBkaXNjb25uZWN0ZWRcbiAgICAgICAgICpcbiAgICAgICAgICogSW4gdGhlIHNlY29uZCBjYXNlLCB0aGUgaGFuZGxlcnMgd2lsbCBiZSBzaW1wbHkgZGlzY2FyZGVkIHVwb24gZGlzY29ubmVjdGlvbiwgc2luY2UgdGhlIGNsaWVudCB3aWxsIG5ldmVyIHJlY2VpdmVcbiAgICAgICAgICogYW4gYWNrbm93bGVkZ2VtZW50IGZyb20gdGhlIHNlcnZlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYWNrcyA9IHt9O1xuICAgICAgICB0aGlzLmZsYWdzID0ge307XG4gICAgICAgIHRoaXMuaW8gPSBpbztcbiAgICAgICAgdGhpcy5uc3AgPSBuc3A7XG4gICAgICAgIGlmIChvcHRzICYmIG9wdHMuYXV0aCkge1xuICAgICAgICAgICAgdGhpcy5hdXRoID0gb3B0cy5hdXRoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX29wdHMgPSBPYmplY3QuYXNzaWduKHt9LCBvcHRzKTtcbiAgICAgICAgaWYgKHRoaXMuaW8uX2F1dG9Db25uZWN0KVxuICAgICAgICAgICAgdGhpcy5vcGVuKCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIHNvY2tldCBpcyBjdXJyZW50bHkgZGlzY29ubmVjdGVkXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHNvY2tldCA9IGlvKCk7XG4gICAgICpcbiAgICAgKiBzb2NrZXQub24oXCJjb25uZWN0XCIsICgpID0+IHtcbiAgICAgKiAgIGNvbnNvbGUubG9nKHNvY2tldC5kaXNjb25uZWN0ZWQpOyAvLyBmYWxzZVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogc29ja2V0Lm9uKFwiZGlzY29ubmVjdFwiLCAoKSA9PiB7XG4gICAgICogICBjb25zb2xlLmxvZyhzb2NrZXQuZGlzY29ubmVjdGVkKTsgLy8gdHJ1ZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGdldCBkaXNjb25uZWN0ZWQoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5jb25uZWN0ZWQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFN1YnNjcmliZSB0byBvcGVuLCBjbG9zZSBhbmQgcGFja2V0IGV2ZW50c1xuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzdWJFdmVudHMoKSB7XG4gICAgICAgIGlmICh0aGlzLnN1YnMpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IGlvID0gdGhpcy5pbztcbiAgICAgICAgdGhpcy5zdWJzID0gW1xuICAgICAgICAgICAgb24oaW8sIFwib3BlblwiLCB0aGlzLm9ub3Blbi5iaW5kKHRoaXMpKSxcbiAgICAgICAgICAgIG9uKGlvLCBcInBhY2tldFwiLCB0aGlzLm9ucGFja2V0LmJpbmQodGhpcykpLFxuICAgICAgICAgICAgb24oaW8sIFwiZXJyb3JcIiwgdGhpcy5vbmVycm9yLmJpbmQodGhpcykpLFxuICAgICAgICAgICAgb24oaW8sIFwiY2xvc2VcIiwgdGhpcy5vbmNsb3NlLmJpbmQodGhpcykpLFxuICAgICAgICBdO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIHRoZSBTb2NrZXQgd2lsbCB0cnkgdG8gcmVjb25uZWN0IHdoZW4gaXRzIE1hbmFnZXIgY29ubmVjdHMgb3IgcmVjb25uZWN0cy5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc29ja2V0ID0gaW8oKTtcbiAgICAgKlxuICAgICAqIGNvbnNvbGUubG9nKHNvY2tldC5hY3RpdmUpOyAvLyB0cnVlXG4gICAgICpcbiAgICAgKiBzb2NrZXQub24oXCJkaXNjb25uZWN0XCIsIChyZWFzb24pID0+IHtcbiAgICAgKiAgIGlmIChyZWFzb24gPT09IFwiaW8gc2VydmVyIGRpc2Nvbm5lY3RcIikge1xuICAgICAqICAgICAvLyB0aGUgZGlzY29ubmVjdGlvbiB3YXMgaW5pdGlhdGVkIGJ5IHRoZSBzZXJ2ZXIsIHlvdSBuZWVkIHRvIG1hbnVhbGx5IHJlY29ubmVjdFxuICAgICAqICAgICBjb25zb2xlLmxvZyhzb2NrZXQuYWN0aXZlKTsgLy8gZmFsc2VcbiAgICAgKiAgIH1cbiAgICAgKiAgIC8vIGVsc2UgdGhlIHNvY2tldCB3aWxsIGF1dG9tYXRpY2FsbHkgdHJ5IHRvIHJlY29ubmVjdFxuICAgICAqICAgY29uc29sZS5sb2coc29ja2V0LmFjdGl2ZSk7IC8vIHRydWVcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBnZXQgYWN0aXZlKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLnN1YnM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFwiT3BlbnNcIiB0aGUgc29ja2V0LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBzb2NrZXQgPSBpbyh7XG4gICAgICogICBhdXRvQ29ubmVjdDogZmFsc2VcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHNvY2tldC5jb25uZWN0KCk7XG4gICAgICovXG4gICAgY29ubmVjdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuY29ubmVjdGVkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIHRoaXMuc3ViRXZlbnRzKCk7XG4gICAgICAgIGlmICghdGhpcy5pb1tcIl9yZWNvbm5lY3RpbmdcIl0pXG4gICAgICAgICAgICB0aGlzLmlvLm9wZW4oKTsgLy8gZW5zdXJlIG9wZW5cbiAgICAgICAgaWYgKFwib3BlblwiID09PSB0aGlzLmlvLl9yZWFkeVN0YXRlKVxuICAgICAgICAgICAgdGhpcy5vbm9wZW4oKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFsaWFzIGZvciB7QGxpbmsgY29ubmVjdCgpfS5cbiAgICAgKi9cbiAgICBvcGVuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25uZWN0KCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNlbmRzIGEgYG1lc3NhZ2VgIGV2ZW50LlxuICAgICAqXG4gICAgICogVGhpcyBtZXRob2QgbWltaWNzIHRoZSBXZWJTb2NrZXQuc2VuZCgpIG1ldGhvZC5cbiAgICAgKlxuICAgICAqIEBzZWUgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL1dlYlNvY2tldC9zZW5kXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNvY2tldC5zZW5kKFwiaGVsbG9cIik7XG4gICAgICpcbiAgICAgKiAvLyB0aGlzIGlzIGVxdWl2YWxlbnQgdG9cbiAgICAgKiBzb2NrZXQuZW1pdChcIm1lc3NhZ2VcIiwgXCJoZWxsb1wiKTtcbiAgICAgKlxuICAgICAqIEByZXR1cm4gc2VsZlxuICAgICAqL1xuICAgIHNlbmQoLi4uYXJncykge1xuICAgICAgICBhcmdzLnVuc2hpZnQoXCJtZXNzYWdlXCIpO1xuICAgICAgICB0aGlzLmVtaXQuYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBPdmVycmlkZSBgZW1pdGAuXG4gICAgICogSWYgdGhlIGV2ZW50IGlzIGluIGBldmVudHNgLCBpdCdzIGVtaXR0ZWQgbm9ybWFsbHkuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNvY2tldC5lbWl0KFwiaGVsbG9cIiwgXCJ3b3JsZFwiKTtcbiAgICAgKlxuICAgICAqIC8vIGFsbCBzZXJpYWxpemFibGUgZGF0YXN0cnVjdHVyZXMgYXJlIHN1cHBvcnRlZCAobm8gbmVlZCB0byBjYWxsIEpTT04uc3RyaW5naWZ5KVxuICAgICAqIHNvY2tldC5lbWl0KFwiaGVsbG9cIiwgMSwgXCIyXCIsIHsgMzogW1wiNFwiXSwgNTogVWludDhBcnJheS5mcm9tKFs2XSkgfSk7XG4gICAgICpcbiAgICAgKiAvLyB3aXRoIGFuIGFja25vd2xlZGdlbWVudCBmcm9tIHRoZSBzZXJ2ZXJcbiAgICAgKiBzb2NrZXQuZW1pdChcImhlbGxvXCIsIFwid29ybGRcIiwgKHZhbCkgPT4ge1xuICAgICAqICAgLy8gLi4uXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHNlbGZcbiAgICAgKi9cbiAgICBlbWl0KGV2LCAuLi5hcmdzKSB7XG4gICAgICAgIHZhciBfYSwgX2IsIF9jO1xuICAgICAgICBpZiAoUkVTRVJWRURfRVZFTlRTLmhhc093blByb3BlcnR5KGV2KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdcIicgKyBldi50b1N0cmluZygpICsgJ1wiIGlzIGEgcmVzZXJ2ZWQgZXZlbnQgbmFtZScpO1xuICAgICAgICB9XG4gICAgICAgIGFyZ3MudW5zaGlmdChldik7XG4gICAgICAgIGlmICh0aGlzLl9vcHRzLnJldHJpZXMgJiYgIXRoaXMuZmxhZ3MuZnJvbVF1ZXVlICYmICF0aGlzLmZsYWdzLnZvbGF0aWxlKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRUb1F1ZXVlKGFyZ3MpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFja2V0ID0ge1xuICAgICAgICAgICAgdHlwZTogUGFja2V0VHlwZS5FVkVOVCxcbiAgICAgICAgICAgIGRhdGE6IGFyZ3MsXG4gICAgICAgIH07XG4gICAgICAgIHBhY2tldC5vcHRpb25zID0ge307XG4gICAgICAgIHBhY2tldC5vcHRpb25zLmNvbXByZXNzID0gdGhpcy5mbGFncy5jb21wcmVzcyAhPT0gZmFsc2U7XG4gICAgICAgIC8vIGV2ZW50IGFjayBjYWxsYmFja1xuICAgICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IHRoaXMuaWRzKys7XG4gICAgICAgICAgICBjb25zdCBhY2sgPSBhcmdzLnBvcCgpO1xuICAgICAgICAgICAgdGhpcy5fcmVnaXN0ZXJBY2tDYWxsYmFjayhpZCwgYWNrKTtcbiAgICAgICAgICAgIHBhY2tldC5pZCA9IGlkO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGlzVHJhbnNwb3J0V3JpdGFibGUgPSAoX2IgPSAoX2EgPSB0aGlzLmlvLmVuZ2luZSkgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLnRyYW5zcG9ydCkgPT09IG51bGwgfHwgX2IgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9iLndyaXRhYmxlO1xuICAgICAgICBjb25zdCBpc0Nvbm5lY3RlZCA9IHRoaXMuY29ubmVjdGVkICYmICEoKF9jID0gdGhpcy5pby5lbmdpbmUpID09PSBudWxsIHx8IF9jID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYy5faGFzUGluZ0V4cGlyZWQoKSk7XG4gICAgICAgIGNvbnN0IGRpc2NhcmRQYWNrZXQgPSB0aGlzLmZsYWdzLnZvbGF0aWxlICYmICFpc1RyYW5zcG9ydFdyaXRhYmxlO1xuICAgICAgICBpZiAoZGlzY2FyZFBhY2tldCkge1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQ29ubmVjdGVkKSB7XG4gICAgICAgICAgICB0aGlzLm5vdGlmeU91dGdvaW5nTGlzdGVuZXJzKHBhY2tldCk7XG4gICAgICAgICAgICB0aGlzLnBhY2tldChwYWNrZXQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZW5kQnVmZmVyLnB1c2gocGFja2V0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZsYWdzID0ge307XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWdpc3RlckFja0NhbGxiYWNrKGlkLCBhY2spIHtcbiAgICAgICAgdmFyIF9hO1xuICAgICAgICBjb25zdCB0aW1lb3V0ID0gKF9hID0gdGhpcy5mbGFncy50aW1lb3V0KSAhPT0gbnVsbCAmJiBfYSAhPT0gdm9pZCAwID8gX2EgOiB0aGlzLl9vcHRzLmFja1RpbWVvdXQ7XG4gICAgICAgIGlmICh0aW1lb3V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuYWNrc1tpZF0gPSBhY2s7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBjb25zdCB0aW1lciA9IHRoaXMuaW8uc2V0VGltZW91dEZuKCgpID0+IHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmFja3NbaWRdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNlbmRCdWZmZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZW5kQnVmZmVyW2ldLmlkID09PSBpZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNlbmRCdWZmZXIuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjay5jYWxsKHRoaXMsIG5ldyBFcnJvcihcIm9wZXJhdGlvbiBoYXMgdGltZWQgb3V0XCIpKTtcbiAgICAgICAgfSwgdGltZW91dCk7XG4gICAgICAgIGNvbnN0IGZuID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIHRoaXMuaW8uY2xlYXJUaW1lb3V0Rm4odGltZXIpO1xuICAgICAgICAgICAgYWNrLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9O1xuICAgICAgICBmbi53aXRoRXJyb3IgPSB0cnVlO1xuICAgICAgICB0aGlzLmFja3NbaWRdID0gZm47XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEVtaXRzIGFuIGV2ZW50IGFuZCB3YWl0cyBmb3IgYW4gYWNrbm93bGVkZ2VtZW50XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHdpdGhvdXQgdGltZW91dFxuICAgICAqIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc29ja2V0LmVtaXRXaXRoQWNrKFwiaGVsbG9cIiwgXCJ3b3JsZFwiKTtcbiAgICAgKlxuICAgICAqIC8vIHdpdGggYSBzcGVjaWZpYyB0aW1lb3V0XG4gICAgICogdHJ5IHtcbiAgICAgKiAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc29ja2V0LnRpbWVvdXQoMTAwMCkuZW1pdFdpdGhBY2soXCJoZWxsb1wiLCBcIndvcmxkXCIpO1xuICAgICAqIH0gY2F0Y2ggKGVycikge1xuICAgICAqICAgLy8gdGhlIHNlcnZlciBkaWQgbm90IGFja25vd2xlZGdlIHRoZSBldmVudCBpbiB0aGUgZ2l2ZW4gZGVsYXlcbiAgICAgKiB9XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGEgUHJvbWlzZSB0aGF0IHdpbGwgYmUgZnVsZmlsbGVkIHdoZW4gdGhlIHNlcnZlciBhY2tub3dsZWRnZXMgdGhlIGV2ZW50XG4gICAgICovXG4gICAgZW1pdFdpdGhBY2soZXYsIC4uLmFyZ3MpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZuID0gKGFyZzEsIGFyZzIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnMSA/IHJlamVjdChhcmcxKSA6IHJlc29sdmUoYXJnMik7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZm4ud2l0aEVycm9yID0gdHJ1ZTtcbiAgICAgICAgICAgIGFyZ3MucHVzaChmbik7XG4gICAgICAgICAgICB0aGlzLmVtaXQoZXYsIC4uLmFyZ3MpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWRkIHRoZSBwYWNrZXQgdG8gdGhlIHF1ZXVlLlxuICAgICAqIEBwYXJhbSBhcmdzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkVG9RdWV1ZShhcmdzKSB7XG4gICAgICAgIGxldCBhY2s7XG4gICAgICAgIGlmICh0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGFjayA9IGFyZ3MucG9wKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcGFja2V0ID0ge1xuICAgICAgICAgICAgaWQ6IHRoaXMuX3F1ZXVlU2VxKyssXG4gICAgICAgICAgICB0cnlDb3VudDogMCxcbiAgICAgICAgICAgIHBlbmRpbmc6IGZhbHNlLFxuICAgICAgICAgICAgYXJncyxcbiAgICAgICAgICAgIGZsYWdzOiBPYmplY3QuYXNzaWduKHsgZnJvbVF1ZXVlOiB0cnVlIH0sIHRoaXMuZmxhZ3MpLFxuICAgICAgICB9O1xuICAgICAgICBhcmdzLnB1c2goKGVyciwgLi4ucmVzcG9uc2VBcmdzKSA9PiB7XG4gICAgICAgICAgICBpZiAocGFja2V0ICE9PSB0aGlzLl9xdWV1ZVswXSkge1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgaGFzRXJyb3IgPSBlcnIgIT09IG51bGw7XG4gICAgICAgICAgICBpZiAoaGFzRXJyb3IpIHtcbiAgICAgICAgICAgICAgICBpZiAocGFja2V0LnRyeUNvdW50ID4gdGhpcy5fb3B0cy5yZXRyaWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3F1ZXVlLnNoaWZ0KCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICBpZiAoYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGFjayhudWxsLCAuLi5yZXNwb25zZUFyZ3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhY2tldC5wZW5kaW5nID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZHJhaW5RdWV1ZSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5fcXVldWUucHVzaChwYWNrZXQpO1xuICAgICAgICB0aGlzLl9kcmFpblF1ZXVlKCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNlbmQgdGhlIGZpcnN0IHBhY2tldCBvZiB0aGUgcXVldWUsIGFuZCB3YWl0IGZvciBhbiBhY2tub3dsZWRnZW1lbnQgZnJvbSB0aGUgc2VydmVyLlxuICAgICAqIEBwYXJhbSBmb3JjZSAtIHdoZXRoZXIgdG8gcmVzZW5kIGEgcGFja2V0IHRoYXQgaGFzIG5vdCBiZWVuIGFja25vd2xlZGdlZCB5ZXRcbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2RyYWluUXVldWUoZm9yY2UgPSBmYWxzZSkge1xuICAgICAgICBpZiAoIXRoaXMuY29ubmVjdGVkIHx8IHRoaXMuX3F1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhY2tldCA9IHRoaXMuX3F1ZXVlWzBdO1xuICAgICAgICBpZiAocGFja2V0LnBlbmRpbmcgJiYgIWZvcmNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcGFja2V0LnBlbmRpbmcgPSB0cnVlO1xuICAgICAgICBwYWNrZXQudHJ5Q291bnQrKztcbiAgICAgICAgdGhpcy5mbGFncyA9IHBhY2tldC5mbGFncztcbiAgICAgICAgdGhpcy5lbWl0LmFwcGx5KHRoaXMsIHBhY2tldC5hcmdzKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2VuZHMgYSBwYWNrZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGFja2V0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBwYWNrZXQocGFja2V0KSB7XG4gICAgICAgIHBhY2tldC5uc3AgPSB0aGlzLm5zcDtcbiAgICAgICAgdGhpcy5pby5fcGFja2V0KHBhY2tldCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIGVuZ2luZSBgb3BlbmAuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9ub3BlbigpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmF1dGggPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB0aGlzLmF1dGgoKGRhdGEpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZW5kQ29ubmVjdFBhY2tldChkYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2VuZENvbm5lY3RQYWNrZXQodGhpcy5hdXRoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZW5kcyBhIENPTk5FQ1QgcGFja2V0IHRvIGluaXRpYXRlIHRoZSBTb2NrZXQuSU8gc2Vzc2lvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2VuZENvbm5lY3RQYWNrZXQoZGF0YSkge1xuICAgICAgICB0aGlzLnBhY2tldCh7XG4gICAgICAgICAgICB0eXBlOiBQYWNrZXRUeXBlLkNPTk5FQ1QsXG4gICAgICAgICAgICBkYXRhOiB0aGlzLl9waWRcbiAgICAgICAgICAgICAgICA/IE9iamVjdC5hc3NpZ24oeyBwaWQ6IHRoaXMuX3BpZCwgb2Zmc2V0OiB0aGlzLl9sYXN0T2Zmc2V0IH0sIGRhdGEpXG4gICAgICAgICAgICAgICAgOiBkYXRhLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gZW5naW5lIG9yIG1hbmFnZXIgYGVycm9yYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBlcnJcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uZXJyb3IoZXJyKSB7XG4gICAgICAgIGlmICghdGhpcy5jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiY29ubmVjdF9lcnJvclwiLCBlcnIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIGVuZ2luZSBgY2xvc2VgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHJlYXNvblxuICAgICAqIEBwYXJhbSBkZXNjcmlwdGlvblxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25jbG9zZShyZWFzb24sIGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIHRoaXMuY29ubmVjdGVkID0gZmFsc2U7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmlkO1xuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImRpc2Nvbm5lY3RcIiwgcmVhc29uLCBkZXNjcmlwdGlvbik7XG4gICAgICAgIHRoaXMuX2NsZWFyQWNrcygpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIGFja25vd2xlZGdlbWVudCBoYW5kbGVycyB1cG9uIGRpc2Nvbm5lY3Rpb24sIHNpbmNlIHRoZSBjbGllbnQgd2lsbCBuZXZlciByZWNlaXZlIGFuIGFja25vd2xlZGdlbWVudCBmcm9tXG4gICAgICogdGhlIHNlcnZlci5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NsZWFyQWNrcygpIHtcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5hY2tzKS5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaXNCdWZmZXJlZCA9IHRoaXMuc2VuZEJ1ZmZlci5zb21lKChwYWNrZXQpID0+IFN0cmluZyhwYWNrZXQuaWQpID09PSBpZCk7XG4gICAgICAgICAgICBpZiAoIWlzQnVmZmVyZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBoYW5kbGVycyB0aGF0IGRvIG5vdCBhY2NlcHQgYW4gZXJyb3IgYXMgZmlyc3QgYXJndW1lbnQgYXJlIGlnbm9yZWQgaGVyZVxuICAgICAgICAgICAgICAgIGNvbnN0IGFjayA9IHRoaXMuYWNrc1tpZF07XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuYWNrc1tpZF07XG4gICAgICAgICAgICAgICAgaWYgKGFjay53aXRoRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgYWNrLmNhbGwodGhpcywgbmV3IEVycm9yKFwic29ja2V0IGhhcyBiZWVuIGRpc2Nvbm5lY3RlZFwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdpdGggc29ja2V0IHBhY2tldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYWNrZXRcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9ucGFja2V0KHBhY2tldCkge1xuICAgICAgICBjb25zdCBzYW1lTmFtZXNwYWNlID0gcGFja2V0Lm5zcCA9PT0gdGhpcy5uc3A7XG4gICAgICAgIGlmICghc2FtZU5hbWVzcGFjZSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgc3dpdGNoIChwYWNrZXQudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkNPTk5FQ1Q6XG4gICAgICAgICAgICAgICAgaWYgKHBhY2tldC5kYXRhICYmIHBhY2tldC5kYXRhLnNpZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uY29ubmVjdChwYWNrZXQuZGF0YS5zaWQsIHBhY2tldC5kYXRhLnBpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImNvbm5lY3RfZXJyb3JcIiwgbmV3IEVycm9yKFwiSXQgc2VlbXMgeW91IGFyZSB0cnlpbmcgdG8gcmVhY2ggYSBTb2NrZXQuSU8gc2VydmVyIGluIHYyLnggd2l0aCBhIHYzLnggY2xpZW50LCBidXQgdGhleSBhcmUgbm90IGNvbXBhdGlibGUgKG1vcmUgaW5mb3JtYXRpb24gaGVyZTogaHR0cHM6Ly9zb2NrZXQuaW8vZG9jcy92My9taWdyYXRpbmctZnJvbS0yLXgtdG8tMy0wLylcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5FVkVOVDpcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5CSU5BUllfRVZFTlQ6XG4gICAgICAgICAgICAgICAgdGhpcy5vbmV2ZW50KHBhY2tldCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFBhY2tldFR5cGUuQUNLOlxuICAgICAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkJJTkFSWV9BQ0s6XG4gICAgICAgICAgICAgICAgdGhpcy5vbmFjayhwYWNrZXQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBQYWNrZXRUeXBlLkRJU0NPTk5FQ1Q6XG4gICAgICAgICAgICAgICAgdGhpcy5vbmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgUGFja2V0VHlwZS5DT05ORUNUX0VSUk9SOlxuICAgICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcihwYWNrZXQuZGF0YS5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICBlcnIuZGF0YSA9IHBhY2tldC5kYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJjb25uZWN0X2Vycm9yXCIsIGVycik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gYSBzZXJ2ZXIgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGFja2V0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbmV2ZW50KHBhY2tldCkge1xuICAgICAgICBjb25zdCBhcmdzID0gcGFja2V0LmRhdGEgfHwgW107XG4gICAgICAgIGlmIChudWxsICE9IHBhY2tldC5pZCkge1xuICAgICAgICAgICAgYXJncy5wdXNoKHRoaXMuYWNrKHBhY2tldC5pZCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgdGhpcy5lbWl0RXZlbnQoYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlY2VpdmVCdWZmZXIucHVzaChPYmplY3QuZnJlZXplKGFyZ3MpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbWl0RXZlbnQoYXJncykge1xuICAgICAgICBpZiAodGhpcy5fYW55TGlzdGVuZXJzICYmIHRoaXMuX2FueUxpc3RlbmVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2FueUxpc3RlbmVycy5zbGljZSgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdXBlci5lbWl0LmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICBpZiAodGhpcy5fcGlkICYmIGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHRoaXMuX2xhc3RPZmZzZXQgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogUHJvZHVjZXMgYW4gYWNrIGNhbGxiYWNrIHRvIGVtaXQgd2l0aCBhbiBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgYWNrKGlkKSB7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICBsZXQgc2VudCA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICAgICAgICAgIC8vIHByZXZlbnQgZG91YmxlIGNhbGxiYWNrc1xuICAgICAgICAgICAgaWYgKHNlbnQpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgc2VudCA9IHRydWU7XG4gICAgICAgICAgICBzZWxmLnBhY2tldCh7XG4gICAgICAgICAgICAgICAgdHlwZTogUGFja2V0VHlwZS5BQ0ssXG4gICAgICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgICAgIGRhdGE6IGFyZ3MsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gYSBzZXJ2ZXIgYWNrbm93bGVkZ2VtZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHBhY2tldFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25hY2socGFja2V0KSB7XG4gICAgICAgIGNvbnN0IGFjayA9IHRoaXMuYWNrc1twYWNrZXQuaWRdO1xuICAgICAgICBpZiAodHlwZW9mIGFjayAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZGVsZXRlIHRoaXMuYWNrc1twYWNrZXQuaWRdO1xuICAgICAgICAvLyBAdHMtaWdub3JlIEZJWE1FIGFjayBpcyBpbmNvcnJlY3RseSBpbmZlcnJlZCBhcyAnbmV2ZXInXG4gICAgICAgIGlmIChhY2sud2l0aEVycm9yKSB7XG4gICAgICAgICAgICBwYWNrZXQuZGF0YS51bnNoaWZ0KG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgYWNrLmFwcGx5KHRoaXMsIHBhY2tldC5kYXRhKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gc2VydmVyIGNvbm5lY3QuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uY29ubmVjdChpZCwgcGlkKSB7XG4gICAgICAgIHRoaXMuaWQgPSBpZDtcbiAgICAgICAgdGhpcy5yZWNvdmVyZWQgPSBwaWQgJiYgdGhpcy5fcGlkID09PSBwaWQ7XG4gICAgICAgIHRoaXMuX3BpZCA9IHBpZDsgLy8gZGVmaW5lZCBvbmx5IGlmIGNvbm5lY3Rpb24gc3RhdGUgcmVjb3ZlcnkgaXMgZW5hYmxlZFxuICAgICAgICB0aGlzLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuZW1pdEJ1ZmZlcmVkKCk7XG4gICAgICAgIHRoaXMuX2RyYWluUXVldWUodHJ1ZSk7XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiY29ubmVjdFwiKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRW1pdCBidWZmZXJlZCBldmVudHMgKHJlY2VpdmVkIGFuZCBlbWl0dGVkKS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZW1pdEJ1ZmZlcmVkKCkge1xuICAgICAgICB0aGlzLnJlY2VpdmVCdWZmZXIuZm9yRWFjaCgoYXJncykgPT4gdGhpcy5lbWl0RXZlbnQoYXJncykpO1xuICAgICAgICB0aGlzLnJlY2VpdmVCdWZmZXIgPSBbXTtcbiAgICAgICAgdGhpcy5zZW5kQnVmZmVyLmZvckVhY2goKHBhY2tldCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5ub3RpZnlPdXRnb2luZ0xpc3RlbmVycyhwYWNrZXQpO1xuICAgICAgICAgICAgdGhpcy5wYWNrZXQocGFja2V0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuc2VuZEJ1ZmZlciA9IFtdO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgdXBvbiBzZXJ2ZXIgZGlzY29ubmVjdC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25kaXNjb25uZWN0KCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5vbmNsb3NlKFwiaW8gc2VydmVyIGRpc2Nvbm5lY3RcIik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIGZvcmNlZCBjbGllbnQvc2VydmVyIHNpZGUgZGlzY29ubmVjdGlvbnMsXG4gICAgICogdGhpcyBtZXRob2QgZW5zdXJlcyB0aGUgbWFuYWdlciBzdG9wcyB0cmFja2luZyB1cyBhbmRcbiAgICAgKiB0aGF0IHJlY29ubmVjdGlvbnMgZG9uJ3QgZ2V0IHRyaWdnZXJlZCBmb3IgdGhpcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc3Vicykge1xuICAgICAgICAgICAgLy8gY2xlYW4gc3Vic2NyaXB0aW9ucyB0byBhdm9pZCByZWNvbm5lY3Rpb25zXG4gICAgICAgICAgICB0aGlzLnN1YnMuZm9yRWFjaCgoc3ViRGVzdHJveSkgPT4gc3ViRGVzdHJveSgpKTtcbiAgICAgICAgICAgIHRoaXMuc3VicyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmlvW1wiX2Rlc3Ryb3lcIl0odGhpcyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERpc2Nvbm5lY3RzIHRoZSBzb2NrZXQgbWFudWFsbHkuIEluIHRoYXQgY2FzZSwgdGhlIHNvY2tldCB3aWxsIG5vdCB0cnkgdG8gcmVjb25uZWN0LlxuICAgICAqXG4gICAgICogSWYgdGhpcyBpcyB0aGUgbGFzdCBhY3RpdmUgU29ja2V0IGluc3RhbmNlIG9mIHRoZSB7QGxpbmsgTWFuYWdlcn0sIHRoZSBsb3ctbGV2ZWwgY29ubmVjdGlvbiB3aWxsIGJlIGNsb3NlZC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc29ja2V0ID0gaW8oKTtcbiAgICAgKlxuICAgICAqIHNvY2tldC5vbihcImRpc2Nvbm5lY3RcIiwgKHJlYXNvbikgPT4ge1xuICAgICAqICAgLy8gY29uc29sZS5sb2cocmVhc29uKTsgcHJpbnRzIFwiaW8gY2xpZW50IGRpc2Nvbm5lY3RcIlxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogc29ja2V0LmRpc2Nvbm5lY3QoKTtcbiAgICAgKlxuICAgICAqIEByZXR1cm4gc2VsZlxuICAgICAqL1xuICAgIGRpc2Nvbm5lY3QoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgdGhpcy5wYWNrZXQoeyB0eXBlOiBQYWNrZXRUeXBlLkRJU0NPTk5FQ1QgfSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVtb3ZlIHNvY2tldCBmcm9tIHBvb2xcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgIGlmICh0aGlzLmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgLy8gZmlyZSBldmVudHNcbiAgICAgICAgICAgIHRoaXMub25jbG9zZShcImlvIGNsaWVudCBkaXNjb25uZWN0XCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBbGlhcyBmb3Ige0BsaW5rIGRpc2Nvbm5lY3QoKX0uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHNlbGZcbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlzY29ubmVjdCgpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjb21wcmVzcyBmbGFnLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBzb2NrZXQuY29tcHJlc3MoZmFsc2UpLmVtaXQoXCJoZWxsb1wiKTtcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjb21wcmVzcyAtIGlmIGB0cnVlYCwgY29tcHJlc3NlcyB0aGUgc2VuZGluZyBkYXRhXG4gICAgICogQHJldHVybiBzZWxmXG4gICAgICovXG4gICAgY29tcHJlc3MoY29tcHJlc3MpIHtcbiAgICAgICAgdGhpcy5mbGFncy5jb21wcmVzcyA9IGNvbXByZXNzO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2V0cyBhIG1vZGlmaWVyIGZvciBhIHN1YnNlcXVlbnQgZXZlbnQgZW1pc3Npb24gdGhhdCB0aGUgZXZlbnQgbWVzc2FnZSB3aWxsIGJlIGRyb3BwZWQgd2hlbiB0aGlzIHNvY2tldCBpcyBub3RcbiAgICAgKiByZWFkeSB0byBzZW5kIG1lc3NhZ2VzLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBzb2NrZXQudm9sYXRpbGUuZW1pdChcImhlbGxvXCIpOyAvLyB0aGUgc2VydmVyIG1heSBvciBtYXkgbm90IHJlY2VpdmUgaXRcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHNlbGZcbiAgICAgKi9cbiAgICBnZXQgdm9sYXRpbGUoKSB7XG4gICAgICAgIHRoaXMuZmxhZ3Mudm9sYXRpbGUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogU2V0cyBhIG1vZGlmaWVyIGZvciBhIHN1YnNlcXVlbnQgZXZlbnQgZW1pc3Npb24gdGhhdCB0aGUgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgd2l0aCBhbiBlcnJvciB3aGVuIHRoZVxuICAgICAqIGdpdmVuIG51bWJlciBvZiBtaWxsaXNlY29uZHMgaGF2ZSBlbGFwc2VkIHdpdGhvdXQgYW4gYWNrbm93bGVkZ2VtZW50IGZyb20gdGhlIHNlcnZlcjpcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogc29ja2V0LnRpbWVvdXQoNTAwMCkuZW1pdChcIm15LWV2ZW50XCIsIChlcnIpID0+IHtcbiAgICAgKiAgIGlmIChlcnIpIHtcbiAgICAgKiAgICAgLy8gdGhlIHNlcnZlciBkaWQgbm90IGFja25vd2xlZGdlIHRoZSBldmVudCBpbiB0aGUgZ2l2ZW4gZGVsYXlcbiAgICAgKiAgIH1cbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHNlbGZcbiAgICAgKi9cbiAgICB0aW1lb3V0KHRpbWVvdXQpIHtcbiAgICAgICAgdGhpcy5mbGFncy50aW1lb3V0ID0gdGltZW91dDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgZmlyZWQgd2hlbiBhbnkgZXZlbnQgaXMgZW1pdHRlZC4gVGhlIGV2ZW50IG5hbWUgaXMgcGFzc2VkIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGVcbiAgICAgKiBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogc29ja2V0Lm9uQW55KChldmVudCwgLi4uYXJncykgPT4ge1xuICAgICAqICAgY29uc29sZS5sb2coYGdvdCAke2V2ZW50fWApO1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogQHBhcmFtIGxpc3RlbmVyXG4gICAgICovXG4gICAgb25BbnkobGlzdGVuZXIpIHtcbiAgICAgICAgdGhpcy5fYW55TGlzdGVuZXJzID0gdGhpcy5fYW55TGlzdGVuZXJzIHx8IFtdO1xuICAgICAgICB0aGlzLl9hbnlMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGZpcmVkIHdoZW4gYW55IGV2ZW50IGlzIGVtaXR0ZWQuIFRoZSBldmVudCBuYW1lIGlzIHBhc3NlZCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlXG4gICAgICogY2FsbGJhY2suIFRoZSBsaXN0ZW5lciBpcyBhZGRlZCB0byB0aGUgYmVnaW5uaW5nIG9mIHRoZSBsaXN0ZW5lcnMgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNvY2tldC5wcmVwZW5kQW55KChldmVudCwgLi4uYXJncykgPT4ge1xuICAgICAqICAgY29uc29sZS5sb2coYGdvdCBldmVudCAke2V2ZW50fWApO1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogQHBhcmFtIGxpc3RlbmVyXG4gICAgICovXG4gICAgcHJlcGVuZEFueShsaXN0ZW5lcikge1xuICAgICAgICB0aGlzLl9hbnlMaXN0ZW5lcnMgPSB0aGlzLl9hbnlMaXN0ZW5lcnMgfHwgW107XG4gICAgICAgIHRoaXMuX2FueUxpc3RlbmVycy51bnNoaWZ0KGxpc3RlbmVyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBmaXJlZCB3aGVuIGFueSBldmVudCBpcyBlbWl0dGVkLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBjYXRjaEFsbExpc3RlbmVyID0gKGV2ZW50LCAuLi5hcmdzKSA9PiB7XG4gICAgICogICBjb25zb2xlLmxvZyhgZ290IGV2ZW50ICR7ZXZlbnR9YCk7XG4gICAgICogfVxuICAgICAqXG4gICAgICogc29ja2V0Lm9uQW55KGNhdGNoQWxsTGlzdGVuZXIpO1xuICAgICAqXG4gICAgICogLy8gcmVtb3ZlIGEgc3BlY2lmaWMgbGlzdGVuZXJcbiAgICAgKiBzb2NrZXQub2ZmQW55KGNhdGNoQWxsTGlzdGVuZXIpO1xuICAgICAqXG4gICAgICogLy8gb3IgcmVtb3ZlIGFsbCBsaXN0ZW5lcnNcbiAgICAgKiBzb2NrZXQub2ZmQW55KCk7XG4gICAgICpcbiAgICAgKiBAcGFyYW0gbGlzdGVuZXJcbiAgICAgKi9cbiAgICBvZmZBbnkobGlzdGVuZXIpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbnlMaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChsaXN0ZW5lcikge1xuICAgICAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5fYW55TGlzdGVuZXJzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXIgPT09IGxpc3RlbmVyc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9hbnlMaXN0ZW5lcnMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBhcnJheSBvZiBsaXN0ZW5lcnMgdGhhdCBhcmUgbGlzdGVuaW5nIGZvciBhbnkgZXZlbnQgdGhhdCBpcyBzcGVjaWZpZWQuIFRoaXMgYXJyYXkgY2FuIGJlIG1hbmlwdWxhdGVkLFxuICAgICAqIGUuZy4gdG8gcmVtb3ZlIGxpc3RlbmVycy5cbiAgICAgKi9cbiAgICBsaXN0ZW5lcnNBbnkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbnlMaXN0ZW5lcnMgfHwgW107XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgZmlyZWQgd2hlbiBhbnkgZXZlbnQgaXMgZW1pdHRlZC4gVGhlIGV2ZW50IG5hbWUgaXMgcGFzc2VkIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGVcbiAgICAgKiBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIE5vdGU6IGFja25vd2xlZGdlbWVudHMgc2VudCB0byB0aGUgc2VydmVyIGFyZSBub3QgaW5jbHVkZWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHNvY2tldC5vbkFueU91dGdvaW5nKChldmVudCwgLi4uYXJncykgPT4ge1xuICAgICAqICAgY29uc29sZS5sb2coYHNlbnQgZXZlbnQgJHtldmVudH1gKTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIEBwYXJhbSBsaXN0ZW5lclxuICAgICAqL1xuICAgIG9uQW55T3V0Z29pbmcobGlzdGVuZXIpIHtcbiAgICAgICAgdGhpcy5fYW55T3V0Z29pbmdMaXN0ZW5lcnMgPSB0aGlzLl9hbnlPdXRnb2luZ0xpc3RlbmVycyB8fCBbXTtcbiAgICAgICAgdGhpcy5fYW55T3V0Z29pbmdMaXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGZpcmVkIHdoZW4gYW55IGV2ZW50IGlzIGVtaXR0ZWQuIFRoZSBldmVudCBuYW1lIGlzIHBhc3NlZCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlXG4gICAgICogY2FsbGJhY2suIFRoZSBsaXN0ZW5lciBpcyBhZGRlZCB0byB0aGUgYmVnaW5uaW5nIG9mIHRoZSBsaXN0ZW5lcnMgYXJyYXkuXG4gICAgICpcbiAgICAgKiBOb3RlOiBhY2tub3dsZWRnZW1lbnRzIHNlbnQgdG8gdGhlIHNlcnZlciBhcmUgbm90IGluY2x1ZGVkLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBzb2NrZXQucHJlcGVuZEFueU91dGdvaW5nKChldmVudCwgLi4uYXJncykgPT4ge1xuICAgICAqICAgY29uc29sZS5sb2coYHNlbnQgZXZlbnQgJHtldmVudH1gKTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIEBwYXJhbSBsaXN0ZW5lclxuICAgICAqL1xuICAgIHByZXBlbmRBbnlPdXRnb2luZyhsaXN0ZW5lcikge1xuICAgICAgICB0aGlzLl9hbnlPdXRnb2luZ0xpc3RlbmVycyA9IHRoaXMuX2FueU91dGdvaW5nTGlzdGVuZXJzIHx8IFtdO1xuICAgICAgICB0aGlzLl9hbnlPdXRnb2luZ0xpc3RlbmVycy51bnNoaWZ0KGxpc3RlbmVyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBmaXJlZCB3aGVuIGFueSBldmVudCBpcyBlbWl0dGVkLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBjYXRjaEFsbExpc3RlbmVyID0gKGV2ZW50LCAuLi5hcmdzKSA9PiB7XG4gICAgICogICBjb25zb2xlLmxvZyhgc2VudCBldmVudCAke2V2ZW50fWApO1xuICAgICAqIH1cbiAgICAgKlxuICAgICAqIHNvY2tldC5vbkFueU91dGdvaW5nKGNhdGNoQWxsTGlzdGVuZXIpO1xuICAgICAqXG4gICAgICogLy8gcmVtb3ZlIGEgc3BlY2lmaWMgbGlzdGVuZXJcbiAgICAgKiBzb2NrZXQub2ZmQW55T3V0Z29pbmcoY2F0Y2hBbGxMaXN0ZW5lcik7XG4gICAgICpcbiAgICAgKiAvLyBvciByZW1vdmUgYWxsIGxpc3RlbmVyc1xuICAgICAqIHNvY2tldC5vZmZBbnlPdXRnb2luZygpO1xuICAgICAqXG4gICAgICogQHBhcmFtIFtsaXN0ZW5lcl0gLSB0aGUgY2F0Y2gtYWxsIGxpc3RlbmVyIChvcHRpb25hbClcbiAgICAgKi9cbiAgICBvZmZBbnlPdXRnb2luZyhsaXN0ZW5lcikge1xuICAgICAgICBpZiAoIXRoaXMuX2FueU91dGdvaW5nTGlzdGVuZXJzKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICBpZiAobGlzdGVuZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMuX2FueU91dGdvaW5nTGlzdGVuZXJzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0ZW5lcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAobGlzdGVuZXIgPT09IGxpc3RlbmVyc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9hbnlPdXRnb2luZ0xpc3RlbmVycyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGxpc3RlbmVycyB0aGF0IGFyZSBsaXN0ZW5pbmcgZm9yIGFueSBldmVudCB0aGF0IGlzIHNwZWNpZmllZC4gVGhpcyBhcnJheSBjYW4gYmUgbWFuaXB1bGF0ZWQsXG4gICAgICogZS5nLiB0byByZW1vdmUgbGlzdGVuZXJzLlxuICAgICAqL1xuICAgIGxpc3RlbmVyc0FueU91dGdvaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW55T3V0Z29pbmdMaXN0ZW5lcnMgfHwgW107XG4gICAgfVxuICAgIC8qKlxuICAgICAqIE5vdGlmeSB0aGUgbGlzdGVuZXJzIGZvciBlYWNoIHBhY2tldCBzZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0gcGFja2V0XG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG5vdGlmeU91dGdvaW5nTGlzdGVuZXJzKHBhY2tldCkge1xuICAgICAgICBpZiAodGhpcy5fYW55T3V0Z29pbmdMaXN0ZW5lcnMgJiYgdGhpcy5fYW55T3V0Z29pbmdMaXN0ZW5lcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ZW5lcnMgPSB0aGlzLl9hbnlPdXRnb2luZ0xpc3RlbmVycy5zbGljZSgpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBsaXN0ZW5lciBvZiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBwYWNrZXQuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG4iLCIvKipcbiAqIEluaXRpYWxpemUgYmFja29mZiB0aW1lciB3aXRoIGBvcHRzYC5cbiAqXG4gKiAtIGBtaW5gIGluaXRpYWwgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgWzEwMF1cbiAqIC0gYG1heGAgbWF4IHRpbWVvdXQgWzEwMDAwXVxuICogLSBgaml0dGVyYCBbMF1cbiAqIC0gYGZhY3RvcmAgWzJdXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdHNcbiAqIEBhcGkgcHVibGljXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBCYWNrb2ZmKG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICB0aGlzLm1zID0gb3B0cy5taW4gfHwgMTAwO1xuICAgIHRoaXMubWF4ID0gb3B0cy5tYXggfHwgMTAwMDA7XG4gICAgdGhpcy5mYWN0b3IgPSBvcHRzLmZhY3RvciB8fCAyO1xuICAgIHRoaXMuaml0dGVyID0gb3B0cy5qaXR0ZXIgPiAwICYmIG9wdHMuaml0dGVyIDw9IDEgPyBvcHRzLmppdHRlciA6IDA7XG4gICAgdGhpcy5hdHRlbXB0cyA9IDA7XG59XG4vKipcbiAqIFJldHVybiB0aGUgYmFja29mZiBkdXJhdGlvbi5cbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5CYWNrb2ZmLnByb3RvdHlwZS5kdXJhdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbXMgPSB0aGlzLm1zICogTWF0aC5wb3codGhpcy5mYWN0b3IsIHRoaXMuYXR0ZW1wdHMrKyk7XG4gICAgaWYgKHRoaXMuaml0dGVyKSB7XG4gICAgICAgIHZhciByYW5kID0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgdmFyIGRldmlhdGlvbiA9IE1hdGguZmxvb3IocmFuZCAqIHRoaXMuaml0dGVyICogbXMpO1xuICAgICAgICBtcyA9IChNYXRoLmZsb29yKHJhbmQgKiAxMCkgJiAxKSA9PSAwID8gbXMgLSBkZXZpYXRpb24gOiBtcyArIGRldmlhdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIE1hdGgubWluKG1zLCB0aGlzLm1heCkgfCAwO1xufTtcbi8qKlxuICogUmVzZXQgdGhlIG51bWJlciBvZiBhdHRlbXB0cy5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5CYWNrb2ZmLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmF0dGVtcHRzID0gMDtcbn07XG4vKipcbiAqIFNldCB0aGUgbWluaW11bSBkdXJhdGlvblxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cbkJhY2tvZmYucHJvdG90eXBlLnNldE1pbiA9IGZ1bmN0aW9uIChtaW4pIHtcbiAgICB0aGlzLm1zID0gbWluO1xufTtcbi8qKlxuICogU2V0IHRoZSBtYXhpbXVtIGR1cmF0aW9uXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuQmFja29mZi5wcm90b3R5cGUuc2V0TWF4ID0gZnVuY3Rpb24gKG1heCkge1xuICAgIHRoaXMubWF4ID0gbWF4O1xufTtcbi8qKlxuICogU2V0IHRoZSBqaXR0ZXJcbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5CYWNrb2ZmLnByb3RvdHlwZS5zZXRKaXR0ZXIgPSBmdW5jdGlvbiAoaml0dGVyKSB7XG4gICAgdGhpcy5qaXR0ZXIgPSBqaXR0ZXI7XG59O1xuIiwiaW1wb3J0IHsgU29ja2V0IGFzIEVuZ2luZSwgaW5zdGFsbFRpbWVyRnVuY3Rpb25zLCBuZXh0VGljaywgfSBmcm9tIFwiZW5naW5lLmlvLWNsaWVudFwiO1xuaW1wb3J0IHsgU29ja2V0IH0gZnJvbSBcIi4vc29ja2V0LmpzXCI7XG5pbXBvcnQgKiBhcyBwYXJzZXIgZnJvbSBcInNvY2tldC5pby1wYXJzZXJcIjtcbmltcG9ydCB7IG9uIH0gZnJvbSBcIi4vb24uanNcIjtcbmltcG9ydCB7IEJhY2tvZmYgfSBmcm9tIFwiLi9jb250cmliL2JhY2tvMi5qc1wiO1xuaW1wb3J0IHsgRW1pdHRlciwgfSBmcm9tIFwiQHNvY2tldC5pby9jb21wb25lbnQtZW1pdHRlclwiO1xuZXhwb3J0IGNsYXNzIE1hbmFnZXIgZXh0ZW5kcyBFbWl0dGVyIHtcbiAgICBjb25zdHJ1Y3Rvcih1cmksIG9wdHMpIHtcbiAgICAgICAgdmFyIF9hO1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLm5zcHMgPSB7fTtcbiAgICAgICAgdGhpcy5zdWJzID0gW107XG4gICAgICAgIGlmICh1cmkgJiYgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHVyaSkge1xuICAgICAgICAgICAgb3B0cyA9IHVyaTtcbiAgICAgICAgICAgIHVyaSA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICBvcHRzID0gb3B0cyB8fCB7fTtcbiAgICAgICAgb3B0cy5wYXRoID0gb3B0cy5wYXRoIHx8IFwiL3NvY2tldC5pb1wiO1xuICAgICAgICB0aGlzLm9wdHMgPSBvcHRzO1xuICAgICAgICBpbnN0YWxsVGltZXJGdW5jdGlvbnModGhpcywgb3B0cyk7XG4gICAgICAgIHRoaXMucmVjb25uZWN0aW9uKG9wdHMucmVjb25uZWN0aW9uICE9PSBmYWxzZSk7XG4gICAgICAgIHRoaXMucmVjb25uZWN0aW9uQXR0ZW1wdHMob3B0cy5yZWNvbm5lY3Rpb25BdHRlbXB0cyB8fCBJbmZpbml0eSk7XG4gICAgICAgIHRoaXMucmVjb25uZWN0aW9uRGVsYXkob3B0cy5yZWNvbm5lY3Rpb25EZWxheSB8fCAxMDAwKTtcbiAgICAgICAgdGhpcy5yZWNvbm5lY3Rpb25EZWxheU1heChvcHRzLnJlY29ubmVjdGlvbkRlbGF5TWF4IHx8IDUwMDApO1xuICAgICAgICB0aGlzLnJhbmRvbWl6YXRpb25GYWN0b3IoKF9hID0gb3B0cy5yYW5kb21pemF0aW9uRmFjdG9yKSAhPT0gbnVsbCAmJiBfYSAhPT0gdm9pZCAwID8gX2EgOiAwLjUpO1xuICAgICAgICB0aGlzLmJhY2tvZmYgPSBuZXcgQmFja29mZih7XG4gICAgICAgICAgICBtaW46IHRoaXMucmVjb25uZWN0aW9uRGVsYXkoKSxcbiAgICAgICAgICAgIG1heDogdGhpcy5yZWNvbm5lY3Rpb25EZWxheU1heCgpLFxuICAgICAgICAgICAgaml0dGVyOiB0aGlzLnJhbmRvbWl6YXRpb25GYWN0b3IoKSxcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudGltZW91dChudWxsID09IG9wdHMudGltZW91dCA/IDIwMDAwIDogb3B0cy50aW1lb3V0KTtcbiAgICAgICAgdGhpcy5fcmVhZHlTdGF0ZSA9IFwiY2xvc2VkXCI7XG4gICAgICAgIHRoaXMudXJpID0gdXJpO1xuICAgICAgICBjb25zdCBfcGFyc2VyID0gb3B0cy5wYXJzZXIgfHwgcGFyc2VyO1xuICAgICAgICB0aGlzLmVuY29kZXIgPSBuZXcgX3BhcnNlci5FbmNvZGVyKCk7XG4gICAgICAgIHRoaXMuZGVjb2RlciA9IG5ldyBfcGFyc2VyLkRlY29kZXIoKTtcbiAgICAgICAgdGhpcy5fYXV0b0Nvbm5lY3QgPSBvcHRzLmF1dG9Db25uZWN0ICE9PSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9Db25uZWN0KVxuICAgICAgICAgICAgdGhpcy5vcGVuKCk7XG4gICAgfVxuICAgIHJlY29ubmVjdGlvbih2KSB7XG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWNvbm5lY3Rpb247XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdGlvbiA9ICEhdjtcbiAgICAgICAgaWYgKCF2KSB7XG4gICAgICAgICAgICB0aGlzLnNraXBSZWNvbm5lY3QgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICByZWNvbm5lY3Rpb25BdHRlbXB0cyh2KSB7XG4gICAgICAgIGlmICh2ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVjb25uZWN0aW9uQXR0ZW1wdHM7XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdGlvbkF0dGVtcHRzID0gdjtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHJlY29ubmVjdGlvbkRlbGF5KHYpIHtcbiAgICAgICAgdmFyIF9hO1xuICAgICAgICBpZiAodiA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5O1xuICAgICAgICB0aGlzLl9yZWNvbm5lY3Rpb25EZWxheSA9IHY7XG4gICAgICAgIChfYSA9IHRoaXMuYmFja29mZikgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLnNldE1pbih2KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHJhbmRvbWl6YXRpb25GYWN0b3Iodikge1xuICAgICAgICB2YXIgX2E7XG4gICAgICAgIGlmICh2ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmFuZG9taXphdGlvbkZhY3RvcjtcbiAgICAgICAgdGhpcy5fcmFuZG9taXphdGlvbkZhY3RvciA9IHY7XG4gICAgICAgIChfYSA9IHRoaXMuYmFja29mZikgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLnNldEppdHRlcih2KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHJlY29ubmVjdGlvbkRlbGF5TWF4KHYpIHtcbiAgICAgICAgdmFyIF9hO1xuICAgICAgICBpZiAodiA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlY29ubmVjdGlvbkRlbGF5TWF4O1xuICAgICAgICB0aGlzLl9yZWNvbm5lY3Rpb25EZWxheU1heCA9IHY7XG4gICAgICAgIChfYSA9IHRoaXMuYmFja29mZikgPT09IG51bGwgfHwgX2EgPT09IHZvaWQgMCA/IHZvaWQgMCA6IF9hLnNldE1heCh2KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHRpbWVvdXQodikge1xuICAgICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdGltZW91dDtcbiAgICAgICAgdGhpcy5fdGltZW91dCA9IHY7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBTdGFydHMgdHJ5aW5nIHRvIHJlY29ubmVjdCBpZiByZWNvbm5lY3Rpb24gaXMgZW5hYmxlZCBhbmQgd2UgaGF2ZSBub3RcbiAgICAgKiBzdGFydGVkIHJlY29ubmVjdGluZyB5ZXRcbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgbWF5YmVSZWNvbm5lY3RPbk9wZW4oKSB7XG4gICAgICAgIC8vIE9ubHkgdHJ5IHRvIHJlY29ubmVjdCBpZiBpdCdzIHRoZSBmaXJzdCB0aW1lIHdlJ3JlIGNvbm5lY3RpbmdcbiAgICAgICAgaWYgKCF0aGlzLl9yZWNvbm5lY3RpbmcgJiZcbiAgICAgICAgICAgIHRoaXMuX3JlY29ubmVjdGlvbiAmJlxuICAgICAgICAgICAgdGhpcy5iYWNrb2ZmLmF0dGVtcHRzID09PSAwKSB7XG4gICAgICAgICAgICAvLyBrZWVwcyByZWNvbm5lY3Rpb24gZnJvbSBmaXJpbmcgdHdpY2UgZm9yIHRoZSBzYW1lIHJlY29ubmVjdGlvbiBsb29wXG4gICAgICAgICAgICB0aGlzLnJlY29ubmVjdCgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGN1cnJlbnQgdHJhbnNwb3J0IGBzb2NrZXRgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gLSBvcHRpb25hbCwgY2FsbGJhY2tcbiAgICAgKiBAcmV0dXJuIHNlbGZcbiAgICAgKiBAcHVibGljXG4gICAgICovXG4gICAgb3Blbihmbikge1xuICAgICAgICBpZiAofnRoaXMuX3JlYWR5U3RhdGUuaW5kZXhPZihcIm9wZW5cIikpXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgdGhpcy5lbmdpbmUgPSBuZXcgRW5naW5lKHRoaXMudXJpLCB0aGlzLm9wdHMpO1xuICAgICAgICBjb25zdCBzb2NrZXQgPSB0aGlzLmVuZ2luZTtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuX3JlYWR5U3RhdGUgPSBcIm9wZW5pbmdcIjtcbiAgICAgICAgdGhpcy5za2lwUmVjb25uZWN0ID0gZmFsc2U7XG4gICAgICAgIC8vIGVtaXQgYG9wZW5gXG4gICAgICAgIGNvbnN0IG9wZW5TdWJEZXN0cm95ID0gb24oc29ja2V0LCBcIm9wZW5cIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5vbm9wZW4oKTtcbiAgICAgICAgICAgIGZuICYmIGZuKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBvbkVycm9yID0gKGVycikgPT4ge1xuICAgICAgICAgICAgdGhpcy5jbGVhbnVwKCk7XG4gICAgICAgICAgICB0aGlzLl9yZWFkeVN0YXRlID0gXCJjbG9zZWRcIjtcbiAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiZXJyb3JcIiwgZXJyKTtcbiAgICAgICAgICAgIGlmIChmbikge1xuICAgICAgICAgICAgICAgIGZuKGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBPbmx5IGRvIHRoaXMgaWYgdGhlcmUgaXMgbm8gZm4gdG8gaGFuZGxlIHRoZSBlcnJvclxuICAgICAgICAgICAgICAgIHRoaXMubWF5YmVSZWNvbm5lY3RPbk9wZW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgLy8gZW1pdCBgZXJyb3JgXG4gICAgICAgIGNvbnN0IGVycm9yU3ViID0gb24oc29ja2V0LCBcImVycm9yXCIsIG9uRXJyb3IpO1xuICAgICAgICBpZiAoZmFsc2UgIT09IHRoaXMuX3RpbWVvdXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVvdXQgPSB0aGlzLl90aW1lb3V0O1xuICAgICAgICAgICAgLy8gc2V0IHRpbWVyXG4gICAgICAgICAgICBjb25zdCB0aW1lciA9IHRoaXMuc2V0VGltZW91dEZuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBvcGVuU3ViRGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIG9uRXJyb3IobmV3IEVycm9yKFwidGltZW91dFwiKSk7XG4gICAgICAgICAgICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdHMuYXV0b1VucmVmKSB7XG4gICAgICAgICAgICAgICAgdGltZXIudW5yZWYoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3Vicy5wdXNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyVGltZW91dEZuKHRpbWVyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3Vicy5wdXNoKG9wZW5TdWJEZXN0cm95KTtcbiAgICAgICAgdGhpcy5zdWJzLnB1c2goZXJyb3JTdWIpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLyoqXG4gICAgICogQWxpYXMgZm9yIG9wZW4oKVxuICAgICAqXG4gICAgICogQHJldHVybiBzZWxmXG4gICAgICogQHB1YmxpY1xuICAgICAqL1xuICAgIGNvbm5lY3QoZm4pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3Blbihmbik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIHRyYW5zcG9ydCBvcGVuLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbm9wZW4oKSB7XG4gICAgICAgIC8vIGNsZWFyIG9sZCBzdWJzXG4gICAgICAgIHRoaXMuY2xlYW51cCgpO1xuICAgICAgICAvLyBtYXJrIGFzIG9wZW5cbiAgICAgICAgdGhpcy5fcmVhZHlTdGF0ZSA9IFwib3BlblwiO1xuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcIm9wZW5cIik7XG4gICAgICAgIC8vIGFkZCBuZXcgc3Vic1xuICAgICAgICBjb25zdCBzb2NrZXQgPSB0aGlzLmVuZ2luZTtcbiAgICAgICAgdGhpcy5zdWJzLnB1c2gob24oc29ja2V0LCBcInBpbmdcIiwgdGhpcy5vbnBpbmcuYmluZCh0aGlzKSksIG9uKHNvY2tldCwgXCJkYXRhXCIsIHRoaXMub25kYXRhLmJpbmQodGhpcykpLCBvbihzb2NrZXQsIFwiZXJyb3JcIiwgdGhpcy5vbmVycm9yLmJpbmQodGhpcykpLCBvbihzb2NrZXQsIFwiY2xvc2VcIiwgdGhpcy5vbmNsb3NlLmJpbmQodGhpcykpLCBcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBvbih0aGlzLmRlY29kZXIsIFwiZGVjb2RlZFwiLCB0aGlzLm9uZGVjb2RlZC5iaW5kKHRoaXMpKSk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB1cG9uIGEgcGluZy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25waW5nKCkge1xuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcInBpbmdcIik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aXRoIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uZGF0YShkYXRhKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0aGlzLmRlY29kZXIuYWRkKGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aGlzLm9uY2xvc2UoXCJwYXJzZSBlcnJvclwiLCBlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiBwYXJzZXIgZnVsbHkgZGVjb2RlcyBhIHBhY2tldC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25kZWNvZGVkKHBhY2tldCkge1xuICAgICAgICAvLyB0aGUgbmV4dFRpY2sgY2FsbCBwcmV2ZW50cyBhbiBleGNlcHRpb24gaW4gYSB1c2VyLXByb3ZpZGVkIGV2ZW50IGxpc3RlbmVyIGZyb20gdHJpZ2dlcmluZyBhIGRpc2Nvbm5lY3Rpb24gZHVlIHRvIGEgXCJwYXJzZSBlcnJvclwiXG4gICAgICAgIG5leHRUaWNrKCgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwicGFja2V0XCIsIHBhY2tldCk7XG4gICAgICAgIH0sIHRoaXMuc2V0VGltZW91dEZuKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gc29ja2V0IGVycm9yLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbmVycm9yKGVycikge1xuICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcImVycm9yXCIsIGVycik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgc29ja2V0IGZvciB0aGUgZ2l2ZW4gYG5zcGAuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtTb2NrZXR9XG4gICAgICogQHB1YmxpY1xuICAgICAqL1xuICAgIHNvY2tldChuc3AsIG9wdHMpIHtcbiAgICAgICAgbGV0IHNvY2tldCA9IHRoaXMubnNwc1tuc3BdO1xuICAgICAgICBpZiAoIXNvY2tldCkge1xuICAgICAgICAgICAgc29ja2V0ID0gbmV3IFNvY2tldCh0aGlzLCBuc3AsIG9wdHMpO1xuICAgICAgICAgICAgdGhpcy5uc3BzW25zcF0gPSBzb2NrZXQ7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodGhpcy5fYXV0b0Nvbm5lY3QgJiYgIXNvY2tldC5hY3RpdmUpIHtcbiAgICAgICAgICAgIHNvY2tldC5jb25uZWN0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNvY2tldDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHVwb24gYSBzb2NrZXQgY2xvc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc29ja2V0XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZGVzdHJveShzb2NrZXQpIHtcbiAgICAgICAgY29uc3QgbnNwcyA9IE9iamVjdC5rZXlzKHRoaXMubnNwcyk7XG4gICAgICAgIGZvciAoY29uc3QgbnNwIG9mIG5zcHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNvY2tldCA9IHRoaXMubnNwc1tuc3BdO1xuICAgICAgICAgICAgaWYgKHNvY2tldC5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2xvc2UoKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogV3JpdGVzIGEgcGFja2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHBhY2tldFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhY2tldChwYWNrZXQpIHtcbiAgICAgICAgY29uc3QgZW5jb2RlZFBhY2tldHMgPSB0aGlzLmVuY29kZXIuZW5jb2RlKHBhY2tldCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW5jb2RlZFBhY2tldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuZW5naW5lLndyaXRlKGVuY29kZWRQYWNrZXRzW2ldLCBwYWNrZXQub3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xlYW4gdXAgdHJhbnNwb3J0IHN1YnNjcmlwdGlvbnMgYW5kIHBhY2tldCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGNsZWFudXAoKSB7XG4gICAgICAgIHRoaXMuc3Vicy5mb3JFYWNoKChzdWJEZXN0cm95KSA9PiBzdWJEZXN0cm95KCkpO1xuICAgICAgICB0aGlzLnN1YnMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5kZWNvZGVyLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ2xvc2UgdGhlIGN1cnJlbnQgc29ja2V0LlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2xvc2UoKSB7XG4gICAgICAgIHRoaXMuc2tpcFJlY29ubmVjdCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLm9uY2xvc2UoXCJmb3JjZWQgY2xvc2VcIik7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIEFsaWFzIGZvciBjbG9zZSgpXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGRpc2Nvbm5lY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbG9zZSgpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbjpcbiAgICAgKlxuICAgICAqIC0gdGhlIGxvdy1sZXZlbCBlbmdpbmUgaXMgY2xvc2VkXG4gICAgICogLSB0aGUgcGFyc2VyIGVuY291bnRlcmVkIGEgYmFkbHkgZm9ybWF0dGVkIHBhY2tldFxuICAgICAqIC0gYWxsIHNvY2tldHMgYXJlIGRpc2Nvbm5lY3RlZFxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbmNsb3NlKHJlYXNvbiwgZGVzY3JpcHRpb24pIHtcbiAgICAgICAgdmFyIF9hO1xuICAgICAgICB0aGlzLmNsZWFudXAoKTtcbiAgICAgICAgKF9hID0gdGhpcy5lbmdpbmUpID09PSBudWxsIHx8IF9hID09PSB2b2lkIDAgPyB2b2lkIDAgOiBfYS5jbG9zZSgpO1xuICAgICAgICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcbiAgICAgICAgdGhpcy5fcmVhZHlTdGF0ZSA9IFwiY2xvc2VkXCI7XG4gICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwiY2xvc2VcIiwgcmVhc29uLCBkZXNjcmlwdGlvbik7XG4gICAgICAgIGlmICh0aGlzLl9yZWNvbm5lY3Rpb24gJiYgIXRoaXMuc2tpcFJlY29ubmVjdCkge1xuICAgICAgICAgICAgdGhpcy5yZWNvbm5lY3QoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0IGEgcmVjb25uZWN0aW9uLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZWNvbm5lY3QoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWNvbm5lY3RpbmcgfHwgdGhpcy5za2lwUmVjb25uZWN0KVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5iYWNrb2ZmLmF0dGVtcHRzID49IHRoaXMuX3JlY29ubmVjdGlvbkF0dGVtcHRzKSB7XG4gICAgICAgICAgICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdFJlc2VydmVkKFwicmVjb25uZWN0X2ZhaWxlZFwiKTtcbiAgICAgICAgICAgIHRoaXMuX3JlY29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZGVsYXkgPSB0aGlzLmJhY2tvZmYuZHVyYXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMuX3JlY29ubmVjdGluZyA9IHRydWU7XG4gICAgICAgICAgICBjb25zdCB0aW1lciA9IHRoaXMuc2V0VGltZW91dEZuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5za2lwUmVjb25uZWN0KVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJyZWNvbm5lY3RfYXR0ZW1wdFwiLCBzZWxmLmJhY2tvZmYuYXR0ZW1wdHMpO1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGFnYWluIGZvciB0aGUgY2FzZSBzb2NrZXQgY2xvc2VkIGluIGFib3ZlIGV2ZW50c1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLnNraXBSZWNvbm5lY3QpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICBzZWxmLm9wZW4oKGVycikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLl9yZWNvbm5lY3RpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVjb25uZWN0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXRSZXNlcnZlZChcInJlY29ubmVjdF9lcnJvclwiLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5vbnJlY29ubmVjdCgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LCBkZWxheSk7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRzLmF1dG9VbnJlZikge1xuICAgICAgICAgICAgICAgIHRpbWVyLnVucmVmKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN1YnMucHVzaCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbGVhclRpbWVvdXRGbih0aW1lcik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgdXBvbiBzdWNjZXNzZnVsIHJlY29ubmVjdC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25yZWNvbm5lY3QoKSB7XG4gICAgICAgIGNvbnN0IGF0dGVtcHQgPSB0aGlzLmJhY2tvZmYuYXR0ZW1wdHM7XG4gICAgICAgIHRoaXMuX3JlY29ubmVjdGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmJhY2tvZmYucmVzZXQoKTtcbiAgICAgICAgdGhpcy5lbWl0UmVzZXJ2ZWQoXCJyZWNvbm5lY3RcIiwgYXR0ZW1wdCk7XG4gICAgfVxufVxuIiwiaW1wb3J0IHsgdXJsIH0gZnJvbSBcIi4vdXJsLmpzXCI7XG5pbXBvcnQgeyBNYW5hZ2VyIH0gZnJvbSBcIi4vbWFuYWdlci5qc1wiO1xuaW1wb3J0IHsgU29ja2V0LCB9IGZyb20gXCIuL3NvY2tldC5qc1wiO1xuLyoqXG4gKiBNYW5hZ2VycyBjYWNoZS5cbiAqL1xuY29uc3QgY2FjaGUgPSB7fTtcbmZ1bmN0aW9uIGxvb2t1cCh1cmksIG9wdHMpIHtcbiAgICBpZiAodHlwZW9mIHVyaSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBvcHRzID0gdXJpO1xuICAgICAgICB1cmkgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIG9wdHMgPSBvcHRzIHx8IHt9O1xuICAgIGNvbnN0IHBhcnNlZCA9IHVybCh1cmksIG9wdHMucGF0aCB8fCBcIi9zb2NrZXQuaW9cIik7XG4gICAgY29uc3Qgc291cmNlID0gcGFyc2VkLnNvdXJjZTtcbiAgICBjb25zdCBpZCA9IHBhcnNlZC5pZDtcbiAgICBjb25zdCBwYXRoID0gcGFyc2VkLnBhdGg7XG4gICAgY29uc3Qgc2FtZU5hbWVzcGFjZSA9IGNhY2hlW2lkXSAmJiBwYXRoIGluIGNhY2hlW2lkXVtcIm5zcHNcIl07XG4gICAgY29uc3QgbmV3Q29ubmVjdGlvbiA9IG9wdHMuZm9yY2VOZXcgfHxcbiAgICAgICAgb3B0c1tcImZvcmNlIG5ldyBjb25uZWN0aW9uXCJdIHx8XG4gICAgICAgIGZhbHNlID09PSBvcHRzLm11bHRpcGxleCB8fFxuICAgICAgICBzYW1lTmFtZXNwYWNlO1xuICAgIGxldCBpbztcbiAgICBpZiAobmV3Q29ubmVjdGlvbikge1xuICAgICAgICBpbyA9IG5ldyBNYW5hZ2VyKHNvdXJjZSwgb3B0cyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoIWNhY2hlW2lkXSkge1xuICAgICAgICAgICAgY2FjaGVbaWRdID0gbmV3IE1hbmFnZXIoc291cmNlLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBpbyA9IGNhY2hlW2lkXTtcbiAgICB9XG4gICAgaWYgKHBhcnNlZC5xdWVyeSAmJiAhb3B0cy5xdWVyeSkge1xuICAgICAgICBvcHRzLnF1ZXJ5ID0gcGFyc2VkLnF1ZXJ5S2V5O1xuICAgIH1cbiAgICByZXR1cm4gaW8uc29ja2V0KHBhcnNlZC5wYXRoLCBvcHRzKTtcbn1cbi8vIHNvIHRoYXQgXCJsb29rdXBcIiBjYW4gYmUgdXNlZCBib3RoIGFzIGEgZnVuY3Rpb24gKGUuZy4gYGlvKC4uLilgKSBhbmQgYXMgYVxuLy8gbmFtZXNwYWNlIChlLmcuIGBpby5jb25uZWN0KC4uLilgKSwgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbk9iamVjdC5hc3NpZ24obG9va3VwLCB7XG4gICAgTWFuYWdlcixcbiAgICBTb2NrZXQsXG4gICAgaW86IGxvb2t1cCxcbiAgICBjb25uZWN0OiBsb29rdXAsXG59KTtcbi8qKlxuICogUHJvdG9jb2wgdmVyc2lvbi5cbiAqXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCB7IHByb3RvY29sIH0gZnJvbSBcInNvY2tldC5pby1wYXJzZXJcIjtcbi8qKlxuICogRXhwb3NlIGNvbnN0cnVjdG9ycyBmb3Igc3RhbmRhbG9uZSBidWlsZC5cbiAqXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCB7IE1hbmFnZXIsIFNvY2tldCwgbG9va3VwIGFzIGlvLCBsb29rdXAgYXMgY29ubmVjdCwgbG9va3VwIGFzIGRlZmF1bHQsIH07XG5leHBvcnQgeyBGZXRjaCwgTm9kZVhIUiwgWEhSLCBOb2RlV2ViU29ja2V0LCBXZWJTb2NrZXQsIFdlYlRyYW5zcG9ydCwgfSBmcm9tIFwiZW5naW5lLmlvLWNsaWVudFwiO1xuIiwiaW1wb3J0IFJlYWN0LCB7IHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JztcclxuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnQGFkbWluanMvZGVzaWduLXN5c3RlbSc7XHJcbmltcG9ydCB7IGlvIH0gZnJvbSAnc29ja2V0LmlvLWNsaWVudCc7XHJcblxyXG5jb25zdCBBRE1JTl9ST09UX1BBVEggPSAnL2FkbWluJztcclxuXHJcbi8qKlxyXG4gKiBTYW1lIHR3by10b25lIGNoaW1lIGFzIGFkbWluL2xpdmUtY2hhdC50cydzIHBsYXlJbmNvbWluZ0NoaW1lKCksIGtlcHQgYXMgYVxyXG4gKiBzZXBhcmF0ZSBjb3B5IHJhdGhlciB0aGFuIGEgc2hhcmVkIGltcG9ydDogdGhhdCBmaWxlIGlzIGFcclxuICogc2VydmVyLXJlbmRlcmVkIHBsYWluIEhUTUwgcGFnZSB3aXRoIGl0cyBvd24gaW5saW5lIDxzY3JpcHQ+IChhXHJcbiAqIGNvbXBsZXRlbHkgZGlmZmVyZW50IHJ1bnRpbWUgZnJvbSB0aGlzIEFkbWluSlMgUmVhY3QgYnVuZGxlKSwgc28gdGhlcmUgaXNcclxuICogbm90aGluZyB0byBhY3R1YWxseSBzaGFyZSBpdCB3aXRoIC0gc2VlIHRoZSBmaWxlLWxldmVsIGNvbW1lbnQgYmVsb3cgZm9yXHJcbiAqIHRoZSBmdWxsZXIgcmVhc29uaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gcGxheUNoaW1lKGN0eDogQXVkaW9Db250ZXh0KSB7XHJcbiAgY29uc3Qgbm93ID0gY3R4LmN1cnJlbnRUaW1lO1xyXG4gIFswLCAwLjE1XS5mb3JFYWNoKChvZmZzZXQsIGluZGV4KSA9PiB7XHJcbiAgICBjb25zdCBvc2NpbGxhdG9yID0gY3R4LmNyZWF0ZU9zY2lsbGF0b3IoKTtcclxuICAgIGNvbnN0IGdhaW4gPSBjdHguY3JlYXRlR2FpbigpO1xyXG4gICAgb3NjaWxsYXRvci50eXBlID0gJ3NpbmUnO1xyXG4gICAgb3NjaWxsYXRvci5mcmVxdWVuY3kudmFsdWUgPSBpbmRleCA9PT0gMCA/IDc0MCA6IDk4ODtcclxuICAgIGdhaW4uZ2Fpbi5zZXRWYWx1ZUF0VGltZSgwLjAwMDEsIG5vdyArIG9mZnNldCk7XHJcbiAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjEyLCBub3cgKyBvZmZzZXQgKyAwLjAxNSk7XHJcbiAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjAwMDEsIG5vdyArIG9mZnNldCArIDAuMTMpO1xyXG4gICAgb3NjaWxsYXRvci5jb25uZWN0KGdhaW4pLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcclxuICAgIG9zY2lsbGF0b3Iuc3RhcnQobm93ICsgb2Zmc2V0KTtcclxuICAgIG9zY2lsbGF0b3Iuc3RvcChub3cgKyBvZmZzZXQgKyAwLjE0KTtcclxuICB9KTtcclxufVxyXG5cclxuLy8gVGl0bGUgZmxhc2ggaXMgbW9kdWxlLWxldmVsIChub3QgcGVyLW1vdW50IHN0YXRlKSBmb3IgdGhlIHNhbWUgcmVhc29uIGFzXHJcbi8vIGFkbWluL2xpdmUtY2hhdC50cydzIGNvcHkgYW5kIHdlYi9zcmMvbGliL3N1cHBvcnQtbm90aWZ5LnRzIG9uIHRoZVxyXG4vLyBjdXN0b21lciBzaWRlOiBhIHNpbmdsZSBzaGFyZWQgXCJ0aGUgdGFiIHRpdGxlIGlzIGx5aW5nIHRvIGdldCB5b3VyXHJcbi8vIGF0dGVudGlvblwiIGZsYWcsIG5vdCBvbmUgcGVyIGNvbXBvbmVudCBpbnN0YW5jZS5cclxuY29uc3QgT1JJR0lOQUxfVElUTEUgPSB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnID8gZG9jdW1lbnQudGl0bGUgOiAnJztcclxubGV0IHRpdGxlRmxhc2hUaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xyXG5sZXQgdGl0bGVGbGFzaE9uID0gZmFsc2U7XHJcbmZ1bmN0aW9uIHN0YXJ0VGl0bGVGbGFzaCgpIHtcclxuICBpZiAodGl0bGVGbGFzaFRpbWVyICE9PSB1bmRlZmluZWQpIHJldHVybjtcclxuICB0aXRsZUZsYXNoVGltZXIgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgdGl0bGVGbGFzaE9uID0gIXRpdGxlRmxhc2hPbjtcclxuICAgIGRvY3VtZW50LnRpdGxlID0gdGl0bGVGbGFzaE9uID8gYPCflLQgTmV3IG1lc3NhZ2Ug4oCUICR7T1JJR0lOQUxfVElUTEV9YCA6IE9SSUdJTkFMX1RJVExFO1xyXG4gIH0sIDEyMDApO1xyXG59XHJcbmZ1bmN0aW9uIHN0b3BUaXRsZUZsYXNoKCkge1xyXG4gIGlmICh0aXRsZUZsYXNoVGltZXIgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgd2luZG93LmNsZWFySW50ZXJ2YWwodGl0bGVGbGFzaFRpbWVyKTtcclxuICAgIHRpdGxlRmxhc2hUaW1lciA9IHVuZGVmaW5lZDtcclxuICB9XHJcbiAgZG9jdW1lbnQudGl0bGUgPSBPUklHSU5BTF9USVRMRTtcclxufVxyXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xyXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCAoKSA9PiB7XHJcbiAgICBpZiAoIWRvY3VtZW50LmhpZGRlbikgc3RvcFRpdGxlRmxhc2goKTtcclxuICB9KTtcclxuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCBzdG9wVGl0bGVGbGFzaCk7XHJcbn1cclxuXHJcbnR5cGUgUXVldWVSb3cgPSB7IHVucmVhZF9ieV9hZG1pbj86IG51bWJlciB9O1xyXG5cclxuLyoqXHJcbiAqIFJpbmdzLCBhbGVydHMgYW5kIHNob3dzIGEgZGlzbWlzc2libGUgcGlsbCBmb3IgYSBuZXcgKG9yIG5ld2x5LXVucmVhZClcclxuICogY3VzdG9tZXIvcGFydG5lciBjaGF0LCBvbiBldmVyeSBBZG1pbkpTIHBhZ2UgLSBub3Qgb25seVxyXG4gKiAvYWRtaW4vbGl2ZS1jaGF0LCB3aGljaCBhbiBhZG1pbiBtaWdodCB3ZWxsIG5vdCBoYXZlIG9wZW4gd2hpbGUgd29ya2luZyBhXHJcbiAqIGRpZmZlcmVudCBxdWV1ZS4gTW91bnRlZCBvbmNlIHZpYSB0aGUgVG9wQmFyIG92ZXJyaWRlIChzZWVcclxuICogdG9wYmFyLXdpdGgtY2hhdC1hbGVydC50c3gpLCB3aGljaCBBZG1pbkpTIHJlbmRlcnMgb3V0c2lkZSB0aGVcclxuICogcGFnZS1zcGVjaWZpYyByb3V0ZXMsIHNvIGl0IHN1cnZpdmVzIG5hdmlnYXRpb24gYmV0d2VlbiByZXNvdXJjZXNcclxuICogaW5zdGVhZCBvZiBiZWluZyB0b3JuIGRvd24gYW5kIHJlY29ubmVjdGluZyBhIHNvY2tldCBvbiBldmVyeSBjbGljay5cclxuICpcclxuICogRGVsaWJlcmF0ZWx5IGl0cyBvd24gU29ja2V0LklPIGNvbm5lY3Rpb24gcmF0aGVyIHRoYW4gc29tZXRoaW5nIHNoYXJlZFxyXG4gKiB3aXRoIGFkbWluL2xpdmUtY2hhdC50czogdGhhdCBwYWdlIGlzIGEgc2VwYXJhdGUsIG5vbi1SZWFjdCxcclxuICogc2VydmVyLXJlbmRlcmVkIGRvY3VtZW50IChpdHMgb3duIDxzY3JpcHQ+IHRhZywgbm90IHBhcnQgb2YgdGhpcyBidW5kbGUpLFxyXG4gKiBzbyB0aGVyZSBpcyBubyBjb25uZWN0aW9uIG9yIG1vZHVsZSB0byBhY3R1YWxseSBzaGFyZSBldmVuIGlmIHdlIHdhbnRlZFxyXG4gKiB0byAtIGFuZCB0aGUgdHdvIGFyZSBuZXZlciBvcGVuIGluIHRoZSBzYW1lIHRhYiBhdCBvbmNlLCBzbyB0aGVyZSBpcyBub1xyXG4gKiByaXNrIG9mIHRoZSBzYW1lIG1lc3NhZ2UgYWxlcnRpbmcgdHdpY2UuXHJcbiAqXHJcbiAqIFVzZXMgdGhlIGFnZ3JlZ2F0ZSAnY2hhdDpxdWV1ZScgZXZlbnQgKGJyb2FkY2FzdCB0byBldmVyeSBjb25uZWN0ZWQgYWRtaW5cclxuICogd2hlbmV2ZXIgQU5ZIGNvbnZlcnNhdGlvbidzIHVucmVhZCBjb3VudCBjaGFuZ2VzIC0gc2VlIGNoYXQtc29ja2V0LnRzKVxyXG4gKiByYXRoZXIgdGhhbiAnY2hhdDptZXNzYWdlJzogdGhlIHNlcnZlciBvbmx5IGRlbGl2ZXJzICdjaGF0Om1lc3NhZ2UnIHRvXHJcbiAqIHNvY2tldHMgdGhhdCBqb2luZWQgdGhhdCBzcGVjaWZpYyBjb252ZXJzYXRpb24ncyByb29tLCBzbyBpdCBjYW4gbmV2ZXJcclxuICogdGVsbCB0aGlzIGNvbXBvbmVudCBhYm91dCBhIGN1c3RvbWVyIGl0IGhhc24ndCBvcGVuZWQgeWV0LiAnY2hhdDpxdWV1ZSdcclxuICogaXMgdGhlIG9uZSBzaWduYWwgdGhhdCBhY3R1YWxseSByZWFjaGVzIGV2ZXJ5IGFkbWluIHJlZ2FyZGxlc3Mgb2Ygd2hhdFxyXG4gKiB0aGV5J3JlIGxvb2tpbmcgYXQuXHJcbiAqL1xyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBHbG9iYWxDaGF0QWxlcnQoKSB7XHJcbiAgY29uc3QgW3BpbGwsIHNldFBpbGxdID0gdXNlU3RhdGU8eyBjb3VudDogbnVtYmVyIH0gfCBudWxsPihudWxsKTtcclxuICBjb25zdCBbbm90aWZQZXJtaXNzaW9uLCBzZXROb3RpZlBlcm1pc3Npb25dID0gdXNlU3RhdGU8Tm90aWZpY2F0aW9uUGVybWlzc2lvbiB8ICd1bnN1cHBvcnRlZCc+KFxyXG4gICAgdHlwZW9mIE5vdGlmaWNhdGlvbiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5zdXBwb3J0ZWQnIDogTm90aWZpY2F0aW9uLnBlcm1pc3Npb25cclxuICApO1xyXG4gIGNvbnN0IFtkaXNtaXNzZWRQcm9tcHQsIHNldERpc21pc3NlZFByb21wdF0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgbGFzdFRvdGFsID0gdXNlUmVmPG51bWJlciB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IGF1ZGlvQ3R4ID0gdXNlUmVmPEF1ZGlvQ29udGV4dCB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IGF1ZGlvVW5sb2NrZWQgPSB1c2VSZWYoZmFsc2UpO1xyXG5cclxuICAvLyBXZWIgQXVkaW8gcmVxdWlyZXMgYSB1c2VyIGdlc3R1cmUgYmVmb3JlIGl0IGNhbiBwcm9kdWNlIHNvdW5kIC0gdW5sb2NrXHJcbiAgLy8gaXQgb24gdGhlIGZpcnN0IGNsaWNrL2tleXByZXNzIGFueXdoZXJlIGluIHRoZSBhZG1pbiBwYW5lbCwgc2FtZVxyXG4gIC8vIGFwcHJvYWNoIGFzIGFkbWluL2xpdmUtY2hhdC50cywgc28gdGhlIHZlcnkgZmlyc3QgYWxlcnQgb2YgdGhlIHNlc3Npb25cclxuICAvLyBpc24ndCBzaWxlbnRseSBzd2FsbG93ZWQganVzdCBiZWNhdXNlIHRoZSBhZG1pbiBoYXNuJ3QgdG91Y2hlZCB0aGVcclxuICAvLyBjaGF0IHBhZ2Ugc3BlY2lmaWNhbGx5LlxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBmdW5jdGlvbiB1bmxvY2soKSB7XHJcbiAgICAgIGlmIChhdWRpb1VubG9ja2VkLmN1cnJlbnQpIHJldHVybjtcclxuICAgICAgY29uc3QgQ3RvciA9IHdpbmRvdy5BdWRpb0NvbnRleHQgPz8gKHdpbmRvdyBhcyB1bmtub3duIGFzIHsgd2Via2l0QXVkaW9Db250ZXh0PzogdHlwZW9mIEF1ZGlvQ29udGV4dCB9KS53ZWJraXRBdWRpb0NvbnRleHQ7XHJcbiAgICAgIGlmICghQ3RvcikgcmV0dXJuO1xyXG4gICAgICBhdWRpb0N0eC5jdXJyZW50ID0gbmV3IEN0b3IoKTtcclxuICAgICAgYXVkaW9VbmxvY2tlZC5jdXJyZW50ID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJkb3duJywgdW5sb2NrLCB7IG9uY2U6IHRydWUsIHBhc3NpdmU6IHRydWUgfSk7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdW5sb2NrLCB7IG9uY2U6IHRydWUgfSk7XHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdwb2ludGVyZG93bicsIHVubG9jayk7XHJcbiAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB1bmxvY2spO1xyXG4gICAgfTtcclxuICB9LCBbXSk7XHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBjb25zdCBzb2NrZXQgPSBpbyh7IHdpdGhDcmVkZW50aWFsczogdHJ1ZSB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ2NoYXQ6cXVldWUnLCAocm93czogUXVldWVSb3dbXSkgPT4ge1xyXG4gICAgICBjb25zdCB0b3RhbCA9IHJvd3MucmVkdWNlKChzdW0sIHJvdykgPT4gc3VtICsgKHJvdy51bnJlYWRfYnlfYWRtaW4gPz8gMCksIDApO1xyXG4gICAgICBpZiAobGFzdFRvdGFsLmN1cnJlbnQgIT09IG51bGwgJiYgdG90YWwgPiBsYXN0VG90YWwuY3VycmVudCkge1xyXG4gICAgICAgIHNldFBpbGwoeyBjb3VudDogdG90YWwgfSk7XHJcbiAgICAgICAgaWYgKGRvY3VtZW50LmhpZGRlbikgc3RhcnRUaXRsZUZsYXNoKCk7XHJcbiAgICAgICAgaWYgKGF1ZGlvQ3R4LmN1cnJlbnQgJiYgYXVkaW9DdHguY3VycmVudC5zdGF0ZSA9PT0gJ3J1bm5pbmcnKSBwbGF5Q2hpbWUoYXVkaW9DdHguY3VycmVudCk7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBOb3RpZmljYXRpb24gIT09ICd1bmRlZmluZWQnICYmIE5vdGlmaWNhdGlvbi5wZXJtaXNzaW9uID09PSAnZ3JhbnRlZCcpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG4gPSBuZXcgTm90aWZpY2F0aW9uKCdOZXcgc3VwcG9ydCBtZXNzYWdlJywge1xyXG4gICAgICAgICAgICAgIGJvZHk6IHRvdGFsID09PSAxID8gJ0EgY3VzdG9tZXIgc2VudCBhIG5ldyBtZXNzYWdlLicgOiBgJHt0b3RhbH0gY29udmVyc2F0aW9ucyBhcmUgd2FpdGluZyBmb3IgYSByZXBseS5gLFxyXG4gICAgICAgICAgICAgIHRhZzogJ2xpdmUtY2hhdC1hbGVydCdcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIG4ub25jbGljayA9ICgpID0+IHtcclxuICAgICAgICAgICAgICB3aW5kb3cuZm9jdXMoKTtcclxuICAgICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaHJlZiA9IGAke0FETUlOX1JPT1RfUEFUSH0vbGl2ZS1jaGF0YDtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAvLyBTb21lIGJyb3dzZXJzIGNhbiBzdGlsbCB0aHJvdyBldmVuIHdoZW4gcGVybWlzc2lvbiByZWFkc1xyXG4gICAgICAgICAgICAvLyBcImdyYW50ZWRcIiAoZm9jdXMvdXNlci1hY3RpdmF0aW9uIHF1aXJrcykgLSB0aGUgdGl0bGUgZmxhc2hcclxuICAgICAgICAgICAgLy8gYW5kIHBpbGwgYmVsb3cgc3RpbGwgY2FycnkgdGhlIGFsZXJ0IGVpdGhlciB3YXkuXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2UgaWYgKHRvdGFsID09PSAwKSB7XHJcbiAgICAgICAgc2V0UGlsbChudWxsKTtcclxuICAgICAgfVxyXG4gICAgICBsYXN0VG90YWwuY3VycmVudCA9IHRvdGFsO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgc29ja2V0LmRpc2Nvbm5lY3QoKTtcclxuICAgIH07XHJcbiAgfSwgW10pO1xyXG5cclxuICBpZiAocGlsbCkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgPEJveFxyXG4gICAgICAgIHN0eWxlPXt7IHBvc2l0aW9uOiAnZml4ZWQnLCByaWdodDogMjAsIGJvdHRvbTogMjAsIHpJbmRleDogMjEwMCwgd2lkdGg6IDI4MCwgY3Vyc29yOiAncG9pbnRlcicgfX1cclxuICAgICAgICB2YXJpYW50PVwid2hpdGVcIlxyXG4gICAgICAgIGJveFNoYWRvdz1cImNhcmRcIlxyXG4gICAgICAgIHA9XCJsZ1wiXHJcbiAgICAgICAgb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBgJHtBRE1JTl9ST09UX1BBVEh9L2xpdmUtY2hhdGA7XHJcbiAgICAgICAgfX1cclxuICAgICAgPlxyXG4gICAgICAgIDxCb3ggZGlzcGxheT1cImZsZXhcIiBhbGlnbkl0ZW1zPVwiY2VudGVyXCIganVzdGlmeUNvbnRlbnQ9XCJzcGFjZS1iZXR3ZWVuXCI+XHJcbiAgICAgICAgICA8VGV4dCBmb250V2VpZ2h0PVwiYm9sZFwiPlxyXG4gICAgICAgICAgICB7cGlsbC5jb3VudH0gdW5yZWFkIGNoYXR7cGlsbC5jb3VudCA9PT0gMSA/ICcnIDogJ3MnfVxyXG4gICAgICAgICAgPC9UZXh0PlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHtcclxuICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgIHNldFBpbGwobnVsbCk7XHJcbiAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgIHN0eWxlPXt7IGJvcmRlcjogJ25vbmUnLCBiYWNrZ3JvdW5kOiAnbm9uZScsIGN1cnNvcjogJ3BvaW50ZXInLCBmb250U2l6ZTogMTYsIGxpbmVIZWlnaHQ6IDEgfX1cclxuICAgICAgICAgICAgYXJpYS1sYWJlbD1cIkRpc21pc3NcIlxyXG4gICAgICAgICAgPlxyXG4gICAgICAgICAgICDDl1xyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9Cb3g+XHJcbiAgICAgICAgPFRleHQgZm9udFNpemU9XCJzbVwiIG10PVwiZGVmYXVsdFwiPlxyXG4gICAgICAgICAgQ2xpY2sgdG8gb3BlbiBMaXZlIENoYXRcclxuICAgICAgICA8L1RleHQ+XHJcbiAgICAgIDwvQm94PlxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIE5vIHVucmVhZCBtZXNzYWdlIHJpZ2h0IG5vdywgYnV0IHRoZSBhZG1pbiBoYXMgbmV2ZXIgZ3JhbnRlZCAob3JcclxuICAvLyBkZW5pZWQpIGRlc2t0b3AtYWxlcnQgcGVybWlzc2lvbiAtIG9mZmVyIGl0IGhlcmUgdG9vLCBub3Qgb25seSBvblxyXG4gIC8vIC9hZG1pbi9saXZlLWNoYXQsIHNvIHRoZXkgY2FuIG9wdCBpbiBmcm9tIHdoZXJldmVyIHRoZXkgbGFuZCBmaXJzdC5cclxuICAvLyBEaXNtaXNzaWJsZSBwZXIgc2Vzc2lvbiAobm90IHBlcnNpc3RlZCkgcmF0aGVyIHRoYW4gZ29uZSBmb3JldmVyOiBhXHJcbiAgLy8gXCJtYXliZSBsYXRlclwiIGNsaWNrIHNob3VsZG4ndCBxdWlldGx5IGRpc2FibGUgdGhlIG9mZmVyIG9uIGV2ZXJ5IGZ1dHVyZVxyXG4gIC8vIGxvZ2luLlxyXG4gIGlmIChub3RpZlBlcm1pc3Npb24gPT09ICdkZWZhdWx0JyAmJiAhZGlzbWlzc2VkUHJvbXB0KSB7XHJcbiAgICByZXR1cm4gKFxyXG4gICAgICA8Qm94IHN0eWxlPXt7IHBvc2l0aW9uOiAnZml4ZWQnLCByaWdodDogMjAsIGJvdHRvbTogMjAsIHpJbmRleDogMjEwMCwgd2lkdGg6IDI2MCB9fSB2YXJpYW50PVwid2hpdGVcIiBib3hTaGFkb3c9XCJjYXJkXCIgcD1cImRlZmF1bHRcIj5cclxuICAgICAgICA8Qm94IGRpc3BsYXk9XCJmbGV4XCIgYWxpZ25JdGVtcz1cImNlbnRlclwiIGp1c3RpZnlDb250ZW50PVwic3BhY2UtYmV0d2VlblwiPlxyXG4gICAgICAgICAgPFRleHQgZm9udFNpemU9XCJzbVwiIGZvbnRXZWlnaHQ9XCJib2xkXCI+XHJcbiAgICAgICAgICAgIEVuYWJsZSBjaGF0IGFsZXJ0cz9cclxuICAgICAgICAgIDwvVGV4dD5cclxuICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldERpc21pc3NlZFByb21wdCh0cnVlKX1cclxuICAgICAgICAgICAgc3R5bGU9e3sgYm9yZGVyOiAnbm9uZScsIGJhY2tncm91bmQ6ICdub25lJywgY3Vyc29yOiAncG9pbnRlcicsIGZvbnRTaXplOiAxNCwgbGluZUhlaWdodDogMSB9fVxyXG4gICAgICAgICAgICBhcmlhLWxhYmVsPVwiRGlzbWlzc1wiXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIMOXXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L0JveD5cclxuICAgICAgICA8VGV4dCBmb250U2l6ZT1cInNtXCIgbXQ9XCJkZWZhdWx0XCIgbWI9XCJkZWZhdWx0XCI+XHJcbiAgICAgICAgICBHZXQgYSBkZXNrdG9wIG5vdGlmaWNhdGlvbiB3aGVuIGEgY3VzdG9tZXIgc2VuZHMgYSBzdXBwb3J0IG1lc3NhZ2UsIGV2ZW4gZnJvbSBvdGhlciBhZG1pbiBwYWdlcy5cclxuICAgICAgICA8L1RleHQ+XHJcbiAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBOb3RpZmljYXRpb24ucmVxdWVzdFBlcm1pc3Npb24oKS50aGVuKChwKSA9PiBzZXROb3RpZlBlcm1pc3Npb24ocCkpfVxyXG4gICAgICAgICAgc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgYm9yZGVyOiAnbm9uZScsIGJvcmRlclJhZGl1czogNiwgYmFja2dyb3VuZDogJyMyNTYzZWInLCBjb2xvcjogJyNmZmYnLCBmb250V2VpZ2h0OiA3MDAsIHBhZGRpbmc6ICc4cHggMCcsIGN1cnNvcjogJ3BvaW50ZXInIH19XHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgRW5hYmxlIGFsZXJ0c1xyXG4gICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICA8L0JveD5cclxuICAgICk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbnVsbDtcclxufVxyXG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xyXG5pbXBvcnQgR2xvYmFsQ2hhdEFsZXJ0IGZyb20gJy4vZ2xvYmFsLWNoYXQtYWxlcnQuanMnO1xyXG5cclxuLyoqXHJcbiAqIEFkbWluSlMgcmVuZGVycyBUb3BCYXIgdW5jb25kaXRpb25hbGx5LCBvdXRzaWRlIHRoZSBwYWdlLXNwZWNpZmljXHJcbiAqIDxSb3V0ZXM+IChzZWUgYWRtaW5qcy9saWIvZnJvbnRlbmQvY29tcG9uZW50cy9hcHAvYXBwbGljYXRpb24uanMpLCBzb1xyXG4gKiBpdCdzIHRoZSBvbmUgYnVpbHQtaW4gb3ZlcnJpZGUgcG9pbnQgdGhhdCBzdXJ2aXZlcyBldmVyeSBuYXZpZ2F0aW9uIC1cclxuICogZXhhY3RseSB3aGF0IEdsb2JhbENoYXRBbGVydCBuZWVkcyB0byBzdGF5IG1vdW50ZWQgKGFuZCBpdHMgc29ja2V0XHJcbiAqIGNvbm5lY3RlZCkgYWNyb3NzIHRoZSB3aG9sZSBhZG1pbiBwYW5lbCwgbm90IGp1c3Qgb25lIHBhZ2UuIGBvdmVycmlkZSgpYFxyXG4gKiBhbHdheXMgcGFzc2VzIHRoZSB1bnRvdWNoZWQgb3JpZ2luYWwgY29tcG9uZW50IGluIGFzIGBPcmlnaW5hbENvbXBvbmVudGBcclxuICogKHNlZSBhZG1pbmpzL2xpYi9mcm9udGVuZC9ob2MvYWxsb3ctb3ZlcnJpZGUuanMpIC0gdGhpcyBmaWxlIHJlbmRlcnMgaXRcclxuICogYXMtaXMgYW5kIG5ldmVyIHJlaW1wbGVtZW50cyB0aGUgbmF2YmFyIGl0c2VsZi5cclxuICovXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFRvcEJhcldpdGhDaGF0QWxlcnQocHJvcHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ICYgeyBPcmlnaW5hbENvbXBvbmVudDogUmVhY3QuQ29tcG9uZW50VHlwZTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4gfSkge1xyXG4gIGNvbnN0IHsgT3JpZ2luYWxDb21wb25lbnQsIC4uLnJlc3QgfSA9IHByb3BzO1xyXG4gIHJldHVybiAoXHJcbiAgICA8PlxyXG4gICAgICA8T3JpZ2luYWxDb21wb25lbnQgey4uLnJlc3R9IC8+XHJcbiAgICAgIDxHbG9iYWxDaGF0QWxlcnQgLz5cclxuICAgIDwvPlxyXG4gICk7XHJcbn1cclxuIiwiQWRtaW5KUy5Vc2VyQ29tcG9uZW50cyA9IHt9XG5pbXBvcnQgRGFzaGJvYXJkIGZyb20gJy4uL3NyYy9hZG1pbi9jb21wb25lbnRzL2Rhc2hib2FyZCdcbkFkbWluSlMuVXNlckNvbXBvbmVudHMuRGFzaGJvYXJkID0gRGFzaGJvYXJkXG5pbXBvcnQgVG9wQmFyIGZyb20gJy4uL3NyYy9hZG1pbi9jb21wb25lbnRzL3RvcGJhci13aXRoLWNoYXQtYWxlcnQnXG5BZG1pbkpTLlVzZXJDb21wb25lbnRzLlRvcEJhciA9IFRvcEJhciJdLCJuYW1lcyI6WyJBRE1JTl9ST09UX1BBVEgiLCJQZW5kaW5nUmVxdWVzdHNQb3B1cCIsInN1bW1hcnkiLCJzZXRTdW1tYXJ5IiwidXNlU3RhdGUiLCJkaXNtaXNzZWQiLCJzZXREaXNtaXNzZWQiLCJwcmV2aW91c1BlbmRpbmciLCJ1c2VSZWYiLCJ1c2VFZmZlY3QiLCJhY3RpdmUiLCJsb2FkIiwiZmV0Y2giLCJjcmVkZW50aWFscyIsInRoZW4iLCJyIiwib2siLCJqc29uIiwiUHJvbWlzZSIsInJlamVjdCIsImJvZHkiLCJkYXRhIiwiY2F0Y2giLCJpbnRlcnZhbCIsIndpbmRvdyIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsImN1cnJlbnQiLCJ0b3RhbF9wZW5kaW5nIiwiUmVhY3QiLCJjcmVhdGVFbGVtZW50IiwiQm94Iiwic3R5bGUiLCJwb3NpdGlvbiIsImluc2V0IiwiYmFja2dyb3VuZCIsInpJbmRleCIsImRpc3BsYXkiLCJhbGlnbkl0ZW1zIiwianVzdGlmeUNvbnRlbnQiLCJvbkNsaWNrIiwidmFyaWFudCIsImJveFNoYWRvdyIsInAiLCJ3aWR0aCIsImJvcmRlclJhZGl1cyIsImUiLCJzdG9wUHJvcGFnYXRpb24iLCJINCIsIm1iIiwiVGV4dCIsInRvdGFsX25ld19sYXN0XzI0aCIsImJ5X3R5cGUiLCJmaWx0ZXIiLCJyb3ciLCJwZW5kaW5nIiwibWFwIiwia2V5IiwidHlwZSIsImhyZWYiLCJwYWRkaW5nIiwiYm9yZGVyQm90dG9tIiwidGV4dERlY29yYXRpb24iLCJmb250V2VpZ2h0IiwibGFiZWwiLCJCdXR0b24iLCJtdCIsInF1aWNrTGlua3MiLCJkZXNjcmlwdGlvbiIsImljb24iLCJyZXNvdXJjZUlkIiwiRGFzaGJvYXJkIiwib3ZlcmZsb3ciLCJweSIsInB4IiwiZmxleERpcmVjdGlvbiIsInRleHRBbGlnbiIsImdhcCIsInNyYyIsImFsdCIsImhlaWdodCIsIm1pbldpZHRoIiwiSDIiLCJjb2xvciIsImZvbnRTaXplIiwibGluZUhlaWdodCIsIm9wYWNpdHkiLCJncmlkVGVtcGxhdGVDb2x1bW5zIiwibGluayIsImN1cnNvciIsIm92ZXJmbG93V3JhcCIsIkljb24iLCJiZyIsInJvdW5kZWQiLCJzaXplIiwibXIiLCJ3aXRoTmF0aXZlQmxvYiIsIndpdGhOYXRpdmVBcnJheUJ1ZmZlciIsImlzVmlldyIsImxvb2t1cCIsImRlY29kZSIsImdsb2JhbFRoaXMiLCJFbWl0dGVyIiwiREVGQVVMVF9UUkFOU1BPUlRTIiwiU29ja2V0IiwiUkVTRVJWRURfRVZFTlRTIiwiRW5naW5lIiwicGxheUNoaW1lIiwiY3R4Iiwibm93IiwiY3VycmVudFRpbWUiLCJmb3JFYWNoIiwib2Zmc2V0IiwiaW5kZXgiLCJvc2NpbGxhdG9yIiwiY3JlYXRlT3NjaWxsYXRvciIsImdhaW4iLCJjcmVhdGVHYWluIiwiZnJlcXVlbmN5IiwidmFsdWUiLCJzZXRWYWx1ZUF0VGltZSIsImV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUiLCJjb25uZWN0IiwiZGVzdGluYXRpb24iLCJzdGFydCIsInN0b3AiLCJPUklHSU5BTF9USVRMRSIsImRvY3VtZW50IiwidGl0bGUiLCJ0aXRsZUZsYXNoVGltZXIiLCJ0aXRsZUZsYXNoT24iLCJzdGFydFRpdGxlRmxhc2giLCJ1bmRlZmluZWQiLCJzdG9wVGl0bGVGbGFzaCIsImFkZEV2ZW50TGlzdGVuZXIiLCJoaWRkZW4iLCJHbG9iYWxDaGF0QWxlcnQiLCJwaWxsIiwic2V0UGlsbCIsIm5vdGlmUGVybWlzc2lvbiIsInNldE5vdGlmUGVybWlzc2lvbiIsIk5vdGlmaWNhdGlvbiIsInBlcm1pc3Npb24iLCJkaXNtaXNzZWRQcm9tcHQiLCJzZXREaXNtaXNzZWRQcm9tcHQiLCJsYXN0VG90YWwiLCJhdWRpb0N0eCIsImF1ZGlvVW5sb2NrZWQiLCJ1bmxvY2siLCJDdG9yIiwiQXVkaW9Db250ZXh0Iiwid2Via2l0QXVkaW9Db250ZXh0Iiwib25jZSIsInBhc3NpdmUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwic29ja2V0IiwiaW8iLCJ3aXRoQ3JlZGVudGlhbHMiLCJvbiIsInJvd3MiLCJ0b3RhbCIsInJlZHVjZSIsInN1bSIsInVucmVhZF9ieV9hZG1pbiIsImNvdW50Iiwic3RhdGUiLCJuIiwidGFnIiwib25jbGljayIsImZvY3VzIiwibG9jYXRpb24iLCJkaXNjb25uZWN0IiwicmlnaHQiLCJib3R0b20iLCJib3JkZXIiLCJyZXF1ZXN0UGVybWlzc2lvbiIsIlRvcEJhcldpdGhDaGF0QWxlcnQiLCJwcm9wcyIsIk9yaWdpbmFsQ29tcG9uZW50IiwicmVzdCIsIkZyYWdtZW50IiwiQWRtaW5KUyIsIlVzZXJDb21wb25lbnRzIiwiVG9wQmFyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0VBR0EsTUFBTUEsaUJBQWUsR0FBRyxRQUFRO0VBR2hDLFNBQVNDLG9CQUFvQkEsR0FBRztJQUM5QixNQUFNLENBQUNDLE9BQU8sRUFBRUMsVUFBVSxDQUFDLEdBQUdDLGNBQVEsQ0FBd0IsSUFBSSxDQUFDO0lBQUUsTUFBTSxDQUFDQyxTQUFTLEVBQUVDLFlBQVksQ0FBQyxHQUFHRixjQUFRLENBQUMsS0FBSyxDQUFDO0VBQ3RILEVBQUEsTUFBTUcsZUFBZSxHQUFHQyxZQUFNLENBQWdCLElBQUksQ0FBQztFQUNuREMsRUFBQUEsZUFBUyxDQUFDLE1BQU07TUFDZCxJQUFJQyxNQUFNLEdBQUcsSUFBSTtNQUNqQixNQUFNQyxJQUFJLEdBQUdBLE1BQU1DLEtBQUssQ0FBQyxDQUFBLEVBQUdaLGlCQUFlLENBQUEsZ0JBQUEsQ0FBa0IsRUFBRTtFQUFFYSxNQUFBQSxXQUFXLEVBQUU7T0FBVyxDQUFDLENBQUNDLElBQUksQ0FBRUMsQ0FBQyxJQUFLQSxDQUFDLENBQUNDLEVBQUUsR0FBR0QsQ0FBQyxDQUFDRSxJQUFJLEVBQUUsR0FBR0MsT0FBTyxDQUFDQyxNQUFN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RyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUM7RUFDdkUsSUFBSSxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUM7RUFDckI7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxZQUFZO0VBQ3pDLElBQUksSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0VBQzdELElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0VBQ3JCLFFBQVEsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRTtFQUNoQyxRQUFRLElBQUksU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0VBQzNELFFBQVEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxHQUFHLEVBQUUsR0FBRyxTQUFTO0VBQy9FLElBQUk7RUFDSixJQUFJLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUM7RUFDckMsQ0FBQztFQUNEO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxZQUFZO0VBQ3RDLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDO0VBQ3JCLENBQUM7RUFDRDtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxHQUFHLEVBQUU7RUFDMUMsSUFBSSxJQUFJLENBQUMsRUFBRSxHQUFHLEdBQUc7RUFDakIsQ0FBQztFQUNEO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxVQUFVLEdBQUcsRUFBRTtFQUMxQyxJQUFJLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRztFQUNsQixDQUFDO0VBQ0Q7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLE9BQU8sQ0FBQyxTQUFTLENBQUMsU0FBUyxHQUFHLFVBQVUsTUFBTSxFQUFFO0VBQ2hELElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNO0VBQ3hCLENBQUM7O0VDM0RNLE1BQU0sT0FBTyxTQUFTQSxTQUFPLENBQUM7RUFDckMsSUFBSSxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtFQUMzQixRQUFRLElBQUksRUFBRTtFQUNkLFFBQVEsS0FBSyxFQUFFO0VBQ2YsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUU7RUFDdEIsUUFBUSxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUU7RUFDdEIsUUFBUSxJQUFJLEdBQUcsSUFBSSxRQUFRLEtBQUssT0FBTyxHQUFHLEVBQUU7RUFDNUMsWUFBWSxJQUFJLEdBQUcsR0FBRztFQUN0QixZQUFZLEdBQUcsR0FBRyxTQUFTO0VBQzNCLFFBQVE7RUFDUixRQUFRLElBQUksR0FBRyxJQUFJLElBQUksRUFBRTtFQUN6QixRQUFRLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxZQUFZO0VBQzdDLFFBQVEsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJO0VBQ3hCLFFBQVEscUJBQXFCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztFQUN6QyxRQUFRLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFlBQVksS0FBSyxLQUFLLENBQUM7RUFDdEQsUUFBUSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLG9CQUFvQixJQUFJLFFBQVEsQ0FBQztFQUN4RSxRQUFRLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLElBQUksSUFBSSxDQUFDO0VBQzlELFFBQVEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsSUFBSSxJQUFJLENBQUM7RUFDcEUsUUFBUSxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixNQUFNLElBQUksSUFBSSxFQUFFLEtBQUssTUFBTSxHQUFHLEVBQUUsR0FBRyxHQUFHLENBQUM7RUFDdEcsUUFBUSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDO0VBQ25DLFlBQVksR0FBRyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtFQUN6QyxZQUFZLEdBQUcsRUFBRSxJQUFJLENBQUMsb0JBQW9CLEVBQUU7RUFDNUMsWUFBWSxNQUFNLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixFQUFFO0VBQzlDLFNBQVMsQ0FBQztFQUNWLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztFQUNqRSxRQUFRLElBQUksQ0FBQyxXQUFXLEdBQUcsUUFBUTtFQUNuQyxRQUFRLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRztFQUN0QixRQUFRLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLElBQUksTUFBTTtFQUM3QyxRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsT0FBTyxFQUFFO0VBQzVDLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUU7RUFDNUMsUUFBUSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLEtBQUssS0FBSztFQUN0RCxRQUFRLElBQUksSUFBSSxDQUFDLFlBQVk7RUFDN0IsWUFBWSxJQUFJLENBQUMsSUFBSSxFQUFFO0VBQ3ZCLElBQUk7RUFDSixJQUFJLFlBQVksQ0FBQyxDQUFDLEVBQUU7RUFDcEIsUUFBUSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU07RUFDN0IsWUFBWSxPQUFPLElBQUksQ0FBQyxhQUFhO0VBQ3JDLFFBQVEsSUFBSSxDQUFDLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQztFQUNoQyxRQUFRLElBQUksQ0FBQyxDQUFDLEVBQUU7RUFDaEIsWUFBWSxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUk7RUFDckMsUUFBUTtFQUNSLFFBQVEsT0FBTyxJQUFJO0VBQ25CLElBQUk7RUFDSixJQUFJLG9CQUFvQixDQUFDLENBQUMsRUFBRTtFQUM1QixRQUFRLElBQUksQ0FBQyxLQUFLLFNBQVM7RUFDM0IsWUFBWSxPQUFPLElBQUksQ0FBQyxxQkFBcUI7RUFDN0MsUUFBUSxJQUFJLENBQUMscUJBQXFCLEdBQUcsQ0FBQztFQUN0QyxRQUFRLE9BQU8sSUFBSTtFQUNuQixJQUFJO0VBQ0osSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLEVBQUU7RUFDekIsUUFBUSxJQUFJLEVBQUU7RUFDZCxRQUFRLElBQUksQ0FBQyxLQUFLLFNBQVM7RUFDM0IsWUFBWSxPQUFPLElBQUksQ0FBQyxrQkFBa0I7RUFDMUMsUUFBUSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQztFQUNuQyxRQUFRLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLE1BQU0sSUFBSSxJQUFJLEVBQUUsS0FBSyxNQUFNLEdBQUcsTUFBTSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0VBQzdFLFFBQVEsT0FBTyxJQUFJO0VBQ25CLElBQUk7RUFDSixJQUFJLG1CQUFtQixDQUFDLENBQUMsRUFBRTtFQUMzQixRQUFRLElBQUksRUFBRTtFQUNkLFFBQVEsSUFBSSxDQUFDLEtBQUssU0FBUztFQUMzQixZQUFZLE9BQU8sSUFBSSxDQUFDLG9CQUFvQjtFQUM1QyxRQUFRLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxDQUFDO0VBQ3JDLFFBQVEsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLE9BQU8sTUFBTSxJQUFJLElBQUksRUFBRSxLQUFLLE1BQU0sR0FBRyxNQUFNLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7RUFDaEYsUUFBUSxPQUFPLElBQUk7RUFDbkIsSUFBSTtFQUNKLElBQUksb0JBQW9CLENBQUMsQ0FBQyxFQUFFO0VBQzVCLFFBQVEsSUFBSSxFQUFFO0VBQ2QsUUFBUSxJQUFJLENBQUMsS0FBSyxTQUFTO0VBQzNCLFlBQVksT0FBTyxJQUFJLENBQUMscUJBQXFCO0VBQzdDLFFBQVEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUM7RUFDdEMsUUFBUSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsT0FBTyxNQUFNLElBQUksSUFBSSxFQUFFLEtBQUssTUFBTSxHQUFHLE1BQU0sR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztFQUM3RSxRQUFRLE9BQU8sSUFBSTtFQUNuQixJQUFJO0VBQ0osSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFO0VBQ2YsUUFBUSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU07RUFDN0IsWUFBWSxPQUFPLElBQUksQ0FBQyxRQUFRO0VBQ2hDLFFBQVEsSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDO0VBQ3pCLFFBQVEsT0FBTyxJQUFJO0VBQ25CLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLG9CQUFvQixHQUFHO0VBQzNCO0VBQ0EsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWE7RUFDL0IsWUFBWSxJQUFJLENBQUMsYUFBYTtFQUM5QixZQUFZLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxLQUFLLENBQUMsRUFBRTtFQUN6QztFQUNBLFlBQVksSUFBSSxDQUFDLFNBQVMsRUFBRTtFQUM1QixRQUFRO0VBQ1IsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxJQUFJLENBQUMsRUFBRSxFQUFFO0VBQ2IsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0VBQzdDLFlBQVksT0FBTyxJQUFJO0VBQ3ZCLFFBQVEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJSSxRQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDO0VBQ3JELFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU07RUFDbEMsUUFBUSxNQUFNLElBQUksR0FBRyxJQUFJO0VBQ3pCLFFBQVEsSUFBSSxDQUFDLFdBQVcsR0FBRyxTQUFTO0VBQ3BDLFFBQVEsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLO0VBQ2xDO0VBQ0EsUUFBUSxNQUFNLGNBQWMsR0FBRyxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxZQUFZO0VBQzlELFlBQVksSUFBSSxDQUFDLE1BQU0sRUFBRTtFQUN6QixZQUFZLEVBQUUsSUFBSSxFQUFFLEVBQUU7RUFDdEIsUUFBUSxDQUFDLENBQUM7RUFDVixRQUFRLE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxLQUFLO0VBQ2pDLFlBQVksSUFBSSxDQUFDLE9BQU8sRUFBRTtFQUMxQixZQUFZLElBQUksQ0FBQyxXQUFXLEdBQUcsUUFBUTtFQUN2QyxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQztFQUMzQyxZQUFZLElBQUksRUFBRSxFQUFFO0VBQ3BCLGdCQUFnQixFQUFFLENBQUMsR0FBRyxDQUFDO0VBQ3ZCLFlBQVk7RUFDWixpQkFBaUI7RUFDakI7RUFDQSxnQkFBZ0IsSUFBSSxDQUFDLG9CQUFvQixFQUFFO0VBQzNDLFlBQVk7RUFDWixRQUFRLENBQUM7RUFDVDtFQUNBLFFBQVEsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDO0VBQ3JELFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLFFBQVEsRUFBRTtFQUNyQyxZQUFZLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRO0VBQ3pDO0VBQ0EsWUFBWSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU07RUFDbEQsZ0JBQWdCLGNBQWMsRUFBRTtFQUNoQyxnQkFBZ0IsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0VBQzdDLGdCQUFnQixNQUFNLENBQUMsS0FBSyxFQUFFO0VBQzlCLFlBQVksQ0FBQyxFQUFFLE9BQU8sQ0FBQztFQUN2QixZQUFZLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUU7RUFDckMsZ0JBQWdCLEtBQUssQ0FBQyxLQUFLLEVBQUU7RUFDN0IsWUFBWTtFQUNaLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTTtFQUNqQyxnQkFBZ0IsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUM7RUFDMUMsWUFBWSxDQUFDLENBQUM7RUFDZCxRQUFRO0VBQ1IsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7RUFDdEMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7RUFDaEMsUUFBUSxPQUFPLElBQUk7RUFDbkIsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksT0FBTyxDQUFDLEVBQUUsRUFBRTtFQUNoQixRQUFRLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7RUFDNUIsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sR0FBRztFQUNiO0VBQ0EsUUFBUSxJQUFJLENBQUMsT0FBTyxFQUFFO0VBQ3RCO0VBQ0EsUUFBUSxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU07RUFDakMsUUFBUSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQztFQUNqQztFQUNBLFFBQVEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU07RUFDbEMsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztFQUN6TTtFQUNBLFFBQVEsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7RUFDL0QsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sR0FBRztFQUNiLFFBQVEsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUM7RUFDakMsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7RUFDakIsUUFBUSxJQUFJO0VBQ1osWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7RUFDbEMsUUFBUTtFQUNSLFFBQVEsT0FBTyxDQUFDLEVBQUU7RUFDbEIsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsRUFBRSxDQUFDLENBQUM7RUFDMUMsUUFBUTtFQUNSLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFO0VBQ3RCO0VBQ0EsUUFBUSxRQUFRLENBQUMsTUFBTTtFQUN2QixZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQztFQUMvQyxRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDO0VBQzdCLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFO0VBQ2pCLFFBQVEsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDO0VBQ3ZDLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFO0VBQ3RCLFFBQVEsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7RUFDbkMsUUFBUSxJQUFJLENBQUMsTUFBTSxFQUFFO0VBQ3JCLFlBQVksTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO0VBQ2hELFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNO0VBQ25DLFFBQVE7RUFDUixhQUFhLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7RUFDdEQsWUFBWSxNQUFNLENBQUMsT0FBTyxFQUFFO0VBQzVCLFFBQVE7RUFDUixRQUFRLE9BQU8sTUFBTTtFQUNyQixJQUFJO0VBQ0o7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFO0VBQ3JCLFFBQVEsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0VBQzNDLFFBQVEsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUU7RUFDaEMsWUFBWSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztFQUN6QyxZQUFZLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtFQUMvQixnQkFBZ0I7RUFDaEIsWUFBWTtFQUNaLFFBQVE7RUFDUixRQUFRLElBQUksQ0FBQyxNQUFNLEVBQUU7RUFDckIsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRTtFQUNwQixRQUFRLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztFQUMxRCxRQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0VBQ3hELFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUM7RUFDaEUsUUFBUTtFQUNSLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxPQUFPLEdBQUc7RUFDZCxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxLQUFLLFVBQVUsRUFBRSxDQUFDO0VBQ3ZELFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQztFQUM1QixRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFO0VBQzlCLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxNQUFNLEdBQUc7RUFDYixRQUFRLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSTtFQUNqQyxRQUFRLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSztFQUNsQyxRQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDO0VBQ3BDLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxVQUFVLEdBQUc7RUFDakIsUUFBUSxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUU7RUFDNUIsSUFBSTtFQUNKO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUU7RUFDakMsUUFBUSxJQUFJLEVBQUU7RUFDZCxRQUFRLElBQUksQ0FBQyxPQUFPLEVBQUU7RUFDdEIsUUFBUSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxNQUFNLElBQUksSUFBSSxFQUFFLEtBQUssTUFBTSxHQUFHLE1BQU0sR0FBRyxFQUFFLENBQUMsS0FBSyxFQUFFO0VBQzFFLFFBQVEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7RUFDNUIsUUFBUSxJQUFJLENBQUMsV0FBVyxHQUFHLFFBQVE7RUFDbkMsUUFBUSxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxDQUFDO0VBQ3ZELFFBQVEsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtFQUN2RCxZQUFZLElBQUksQ0FBQyxTQUFTLEVBQUU7RUFDNUIsUUFBUTtFQUNSLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxTQUFTLEdBQUc7RUFDaEIsUUFBUSxJQUFJLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLGFBQWE7RUFDcEQsWUFBWSxPQUFPLElBQUk7RUFDdkIsUUFBUSxNQUFNLElBQUksR0FBRyxJQUFJO0VBQ3pCLFFBQVEsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUU7RUFDakUsWUFBWSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRTtFQUNoQyxZQUFZLElBQUksQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQUM7RUFDakQsWUFBWSxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUs7RUFDdEMsUUFBUTtFQUNSLGFBQWE7RUFDYixZQUFZLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFO0VBQ2pELFlBQVksSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJO0VBQ3JDLFlBQVksTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNO0VBQ2xELGdCQUFnQixJQUFJLElBQUksQ0FBQyxhQUFhO0VBQ3RDLG9CQUFvQjtFQUNwQixnQkFBZ0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztFQUM3RTtFQUNBLGdCQUFnQixJQUFJLElBQUksQ0FBQyxhQUFhO0VBQ3RDLG9CQUFvQjtFQUNwQixnQkFBZ0IsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSztFQUNuQyxvQkFBb0IsSUFBSSxHQUFHLEVBQUU7RUFDN0Isd0JBQXdCLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSztFQUNsRCx3QkFBd0IsSUFBSSxDQUFDLFNBQVMsRUFBRTtFQUN4Qyx3QkFBd0IsSUFBSSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBRSxHQUFHLENBQUM7RUFDakUsb0JBQW9CO0VBQ3BCLHlCQUF5QjtFQUN6Qix3QkFBd0IsSUFBSSxDQUFDLFdBQVcsRUFBRTtFQUMxQyxvQkFBb0I7RUFDcEIsZ0JBQWdCLENBQUMsQ0FBQztFQUNsQixZQUFZLENBQUMsRUFBRSxLQUFLLENBQUM7RUFDckIsWUFBWSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFO0VBQ3JDLGdCQUFnQixLQUFLLENBQUMsS0FBSyxFQUFFO0VBQzdCLFlBQVk7RUFDWixZQUFZLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU07RUFDakMsZ0JBQWdCLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDO0VBQzFDLFlBQVksQ0FBQyxDQUFDO0VBQ2QsUUFBUTtFQUNSLElBQUk7RUFDSjtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSSxXQUFXLEdBQUc7RUFDbEIsUUFBUSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVE7RUFDN0MsUUFBUSxJQUFJLENBQUMsYUFBYSxHQUFHLEtBQUs7RUFDbEMsUUFBUSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRTtFQUM1QixRQUFRLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQztFQUMvQyxJQUFJO0VBQ0o7O0VDM1dBO0VBQ0E7RUFDQTtFQUNBLE1BQU0sS0FBSyxHQUFHLEVBQUU7RUFDaEIsU0FBUyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRTtFQUMzQixJQUFJLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFO0VBQ2pDLFFBQVEsSUFBSSxHQUFHLEdBQUc7RUFDbEIsUUFBUSxHQUFHLEdBQUcsU0FBUztFQUN2QixJQUFJO0VBQ0osSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUU7RUFDckIsSUFBSSxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksWUFBWSxDQUFDO0VBQ3RELElBQUksTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU07RUFDaEMsSUFBSSxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRTtFQUN4QixJQUFJLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJO0VBQzVCLElBQUksTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDO0VBQ2hFLElBQUksTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFFBQVE7RUFDdkMsUUFBUSxJQUFJLENBQUMsc0JBQXNCLENBQUM7RUFDcEMsUUFBUSxLQUFLLEtBQUssSUFBSSxDQUFDLFNBQVM7RUFDaEMsUUFBUSxhQUFhO0VBQ3JCLElBQUksSUFBSSxFQUFFO0VBQ1YsSUFBSSxJQUFJLGFBQWEsRUFBRTtFQUN2QixRQUFRLEVBQUUsR0FBRyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDO0VBQ3RDLElBQUk7RUFDSixTQUFTO0VBQ1QsUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0VBQ3hCLFlBQVksS0FBSyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7RUFDakQsUUFBUTtFQUNSLFFBQVEsRUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUM7RUFDdEIsSUFBSTtFQUNKLElBQUksSUFBSSxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtFQUNyQyxRQUFRLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVE7RUFDcEMsSUFBSTtFQUNKLElBQUksT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDO0VBQ3ZDO0VBQ0E7RUFDQTtFQUNBLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO0VBQ3RCLElBQUksT0FBTztFQUNYLElBQUksTUFBTTtFQUNWLElBQUksRUFBRSxFQUFFLE1BQU07RUFDZCxJQUFJLE9BQU8sRUFBRSxNQUFNO0VBQ25CLENBQUMsQ0FBQzs7RUN4Q0YsTUFBTTFHLGVBQWUsR0FBRyxRQUFROztFQUVoQztFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsU0FBUzJHLFNBQVNBLENBQUNDLEdBQWlCLEVBQUU7RUFDcEMsRUFBQSxNQUFNQyxHQUFHLEdBQUdELEdBQUcsQ0FBQ0UsV0FBVztJQUMzQixDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQ0MsT0FBTyxDQUFDLENBQUNDLE1BQU0sRUFBRUMsS0FBSyxLQUFLO0VBQ25DLElBQUEsTUFBTUMsVUFBVSxHQUFHTixHQUFHLENBQUNPLGdCQUFnQixFQUFFO0VBQ3pDLElBQUEsTUFBTUMsSUFBSSxHQUFHUixHQUFHLENBQUNTLFVBQVUsRUFBRTtNQUM3QkgsVUFBVSxDQUFDeEQsSUFBSSxHQUFHLE1BQU07TUFDeEJ3RCxVQUFVLENBQUNJLFNBQVMsQ0FBQ0MsS0FBSyxHQUFHTixLQUFLLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHO01BQ3BERyxJQUFJLENBQUNBLElBQUksQ0FBQ0ksY0FBYyxDQUFDLE1BQU0sRUFBRVgsR0FBRyxHQUFHRyxNQUFNLENBQUM7RUFDOUNJLElBQUFBLElBQUksQ0FBQ0EsSUFBSSxDQUFDSyw0QkFBNEIsQ0FBQyxJQUFJLEVBQUVaLEdBQUcsR0FBR0csTUFBTSxHQUFHLEtBQUssQ0FBQztFQUNsRUksSUFBQUEsSUFBSSxDQUFDQSxJQUFJLENBQUNLLDRCQUE0QixDQUFDLE1BQU0sRUFBRVosR0FBRyxHQUFHRyxNQUFNLEdBQUcsSUFBSSxDQUFDO01BQ25FRSxVQUFVLENBQUNRLE9BQU8sQ0FBQ04sSUFBSSxDQUFDLENBQUNNLE9BQU8sQ0FBQ2QsR0FBRyxDQUFDZSxXQUFXLENBQUM7RUFDakRULElBQUFBLFVBQVUsQ0FBQ1UsS0FBSyxDQUFDZixHQUFHLEdBQUdHLE1BQU0sQ0FBQztNQUM5QkUsVUFBVSxDQUFDVyxJQUFJLENBQUNoQixHQUFHLEdBQUdHLE1BQU0sR0FBRyxJQUFJLENBQUM7RUFDdEMsRUFBQSxDQUFDLENBQUM7RUFDSjs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLE1BQU1jLGNBQWMsR0FBRyxPQUFPQyxRQUFRLEtBQUssV0FBVyxHQUFHQSxRQUFRLENBQUNDLEtBQUssR0FBRyxFQUFFO0VBQzVFLElBQUlDLGVBQW1DO0VBQ3ZDLElBQUlDLFlBQVksR0FBRyxLQUFLO0VBQ3hCLFNBQVNDLGVBQWVBLEdBQUc7SUFDekIsSUFBSUYsZUFBZSxLQUFLRyxTQUFTLEVBQUU7RUFDbkNILEVBQUFBLGVBQWUsR0FBR3pHLE1BQU0sQ0FBQ0MsV0FBVyxDQUFDLE1BQU07TUFDekN5RyxZQUFZLEdBQUcsQ0FBQ0EsWUFBWTtNQUM1QkgsUUFBUSxDQUFDQyxLQUFLLEdBQUdFLFlBQVksR0FBRyxDQUFBLGlCQUFBLEVBQW9CSixjQUFjLENBQUEsQ0FBRSxHQUFHQSxjQUFjO0lBQ3ZGLENBQUMsRUFBRSxJQUFJLENBQUM7RUFDVjtFQUNBLFNBQVNPLGNBQWNBLEdBQUc7SUFDeEIsSUFBSUosZUFBZSxLQUFLRyxTQUFTLEVBQUU7RUFDakM1RyxJQUFBQSxNQUFNLENBQUNFLGFBQWEsQ0FBQ3VHLGVBQWUsQ0FBQztFQUNyQ0EsSUFBQUEsZUFBZSxHQUFHRyxTQUFTO0VBQzdCLEVBQUE7SUFDQUwsUUFBUSxDQUFDQyxLQUFLLEdBQUdGLGNBQWM7RUFDakM7RUFDQSxJQUFJLE9BQU9DLFFBQVEsS0FBSyxXQUFXLEVBQUU7RUFDbkNBLEVBQUFBLFFBQVEsQ0FBQ08sZ0JBQWdCLENBQUMsa0JBQWtCLEVBQUUsTUFBTTtFQUNsRCxJQUFBLElBQUksQ0FBQ1AsUUFBUSxDQUFDUSxNQUFNLEVBQUVGLGNBQWMsRUFBRTtFQUN4QyxFQUFBLENBQUMsQ0FBQztFQUNGN0csRUFBQUEsTUFBTSxDQUFDOEcsZ0JBQWdCLENBQUMsT0FBTyxFQUFFRCxjQUFjLENBQUM7RUFDbEQ7RUFJQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDZSxTQUFTRyxlQUFlQSxHQUFHO0lBQ3hDLE1BQU0sQ0FBQ0MsSUFBSSxFQUFFQyxPQUFPLENBQUMsR0FBR3RJLGNBQVEsQ0FBMkIsSUFBSSxDQUFDO0VBQ2hFLEVBQUEsTUFBTSxDQUFDdUksZUFBZSxFQUFFQyxrQkFBa0IsQ0FBQyxHQUFHeEksY0FBUSxDQUNwRCxPQUFPeUksWUFBWSxLQUFLLFdBQVcsR0FBRyxhQUFhLEdBQUdBLFlBQVksQ0FBQ0MsVUFDckUsQ0FBQztJQUNELE1BQU0sQ0FBQ0MsZUFBZSxFQUFFQyxrQkFBa0IsQ0FBQyxHQUFHNUksY0FBUSxDQUFDLEtBQUssQ0FBQztFQUM3RCxFQUFBLE1BQU02SSxTQUFTLEdBQUd6SSxZQUFNLENBQWdCLElBQUksQ0FBQztFQUM3QyxFQUFBLE1BQU0wSSxRQUFRLEdBQUcxSSxZQUFNLENBQXNCLElBQUksQ0FBQztFQUNsRCxFQUFBLE1BQU0ySSxhQUFhLEdBQUczSSxZQUFNLENBQUMsS0FBSyxDQUFDOztFQUVuQztFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0FDLEVBQUFBLGVBQVMsQ0FBQyxNQUFNO01BQ2QsU0FBUzJJLE1BQU1BLEdBQUc7UUFDaEIsSUFBSUQsYUFBYSxDQUFDeEgsT0FBTyxFQUFFO1FBQzNCLE1BQU0wSCxJQUFJLEdBQUc3SCxNQUFNLENBQUM4SCxZQUFZLElBQUs5SCxNQUFNLENBQTZEK0gsa0JBQWtCO1FBQzFILElBQUksQ0FBQ0YsSUFBSSxFQUFFO0VBQ1hILE1BQUFBLFFBQVEsQ0FBQ3ZILE9BQU8sR0FBRyxJQUFJMEgsSUFBSSxFQUFFO1FBQzdCRixhQUFhLENBQUN4SCxPQUFPLEdBQUcsSUFBSTtFQUM5QixJQUFBO0VBQ0FvRyxJQUFBQSxRQUFRLENBQUNPLGdCQUFnQixDQUFDLGFBQWEsRUFBRWMsTUFBTSxFQUFFO0VBQUVJLE1BQUFBLElBQUksRUFBRSxJQUFJO0VBQUVDLE1BQUFBLE9BQU8sRUFBRTtFQUFLLEtBQUMsQ0FBQztFQUMvRTFCLElBQUFBLFFBQVEsQ0FBQ08sZ0JBQWdCLENBQUMsU0FBUyxFQUFFYyxNQUFNLEVBQUU7RUFBRUksTUFBQUEsSUFBSSxFQUFFO0VBQUssS0FBQyxDQUFDO0VBQzVELElBQUEsT0FBTyxNQUFNO0VBQ1h6QixNQUFBQSxRQUFRLENBQUMyQixtQkFBbUIsQ0FBQyxhQUFhLEVBQUVOLE1BQU0sQ0FBQztFQUNuRHJCLE1BQUFBLFFBQVEsQ0FBQzJCLG1CQUFtQixDQUFDLFNBQVMsRUFBRU4sTUFBTSxDQUFDO01BQ2pELENBQUM7SUFDSCxDQUFDLEVBQUUsRUFBRSxDQUFDO0VBRU4zSSxFQUFBQSxlQUFTLENBQUMsTUFBTTtNQUNkLE1BQU1rSixNQUFNLEdBQUdDLE1BQUUsQ0FBQztFQUFFQyxNQUFBQSxlQUFlLEVBQUU7RUFBSyxLQUFDLENBQUM7RUFFNUNGLElBQUFBLE1BQU0sQ0FBQ0csRUFBRSxDQUFDLFlBQVksRUFBR0MsSUFBZ0IsSUFBSztRQUM1QyxNQUFNQyxLQUFLLEdBQUdELElBQUksQ0FBQ0UsTUFBTSxDQUFDLENBQUNDLEdBQUcsRUFBRTVHLEdBQUcsS0FBSzRHLEdBQUcsSUFBSTVHLEdBQUcsQ0FBQzZHLGVBQWUsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUUsSUFBSWxCLFNBQVMsQ0FBQ3RILE9BQU8sS0FBSyxJQUFJLElBQUlxSSxLQUFLLEdBQUdmLFNBQVMsQ0FBQ3RILE9BQU8sRUFBRTtFQUMzRCtHLFFBQUFBLE9BQU8sQ0FBQztFQUFFMEIsVUFBQUEsS0FBSyxFQUFFSjtFQUFNLFNBQUMsQ0FBQztFQUN6QixRQUFBLElBQUlqQyxRQUFRLENBQUNRLE1BQU0sRUFBRUosZUFBZSxFQUFFO0VBQ3RDLFFBQUEsSUFBSWUsUUFBUSxDQUFDdkgsT0FBTyxJQUFJdUgsUUFBUSxDQUFDdkgsT0FBTyxDQUFDMEksS0FBSyxLQUFLLFNBQVMsRUFBRTFELFNBQVMsQ0FBQ3VDLFFBQVEsQ0FBQ3ZILE9BQU8sQ0FBQztVQUN6RixJQUFJLE9BQU9rSCxZQUFZLEtBQUssV0FBVyxJQUFJQSxZQUFZLENBQUNDLFVBQVUsS0FBSyxTQUFTLEVBQUU7WUFDaEYsSUFBSTtFQUNGLFlBQUEsTUFBTXdCLENBQUMsR0FBRyxJQUFJekIsWUFBWSxDQUFDLHFCQUFxQixFQUFFO2dCQUNoRHpILElBQUksRUFBRTRJLEtBQUssS0FBSyxDQUFDLEdBQUcsZ0NBQWdDLEdBQUcsQ0FBQSxFQUFHQSxLQUFLLENBQUEsdUNBQUEsQ0FBeUM7RUFDeEdPLGNBQUFBLEdBQUcsRUFBRTtFQUNQLGFBQUMsQ0FBQztjQUNGRCxDQUFDLENBQUNFLE9BQU8sR0FBRyxNQUFNO2dCQUNoQmhKLE1BQU0sQ0FBQ2lKLEtBQUssRUFBRTtFQUNkakosY0FBQUEsTUFBTSxDQUFDa0osUUFBUSxDQUFDL0csSUFBSSxHQUFHLENBQUEsRUFBRzNELGVBQWUsQ0FBQSxVQUFBLENBQVk7Y0FDdkQsQ0FBQztFQUNILFVBQUEsQ0FBQyxDQUFDLE1BQU07RUFDTjtFQUNBO0VBQ0E7RUFBQSxVQUFBO0VBRUosUUFBQTtFQUNGLE1BQUEsQ0FBQyxNQUFNLElBQUlnSyxLQUFLLEtBQUssQ0FBQyxFQUFFO1VBQ3RCdEIsT0FBTyxDQUFDLElBQUksQ0FBQztFQUNmLE1BQUE7UUFDQU8sU0FBUyxDQUFDdEgsT0FBTyxHQUFHcUksS0FBSztFQUMzQixJQUFBLENBQUMsQ0FBQztFQUVGLElBQUEsT0FBTyxNQUFNO1FBQ1hMLE1BQU0sQ0FBQ2dCLFVBQVUsRUFBRTtNQUNyQixDQUFDO0lBQ0gsQ0FBQyxFQUFFLEVBQUUsQ0FBQztFQUVOLEVBQUEsSUFBSWxDLElBQUksRUFBRTtFQUNSLElBQUEsb0JBQ0U1RyxzQkFBQSxDQUFBQyxhQUFBLENBQUNDLGdCQUFHLEVBQUE7RUFDRkMsTUFBQUEsS0FBSyxFQUFFO0VBQUVDLFFBQUFBLFFBQVEsRUFBRSxPQUFPO0VBQUUySSxRQUFBQSxLQUFLLEVBQUUsRUFBRTtFQUFFQyxRQUFBQSxNQUFNLEVBQUUsRUFBRTtFQUFFekksUUFBQUEsTUFBTSxFQUFFLElBQUk7RUFBRVEsUUFBQUEsS0FBSyxFQUFFLEdBQUc7RUFBRTZDLFFBQUFBLE1BQU0sRUFBRTtTQUFZO0VBQ2pHaEQsTUFBQUEsT0FBTyxFQUFDLE9BQU87RUFDZkMsTUFBQUEsU0FBUyxFQUFDLE1BQU07RUFDaEJDLE1BQUFBLENBQUMsRUFBQyxJQUFJO1FBQ05ILE9BQU8sRUFBRUEsTUFBTTtFQUNiaEIsUUFBQUEsTUFBTSxDQUFDa0osUUFBUSxDQUFDL0csSUFBSSxHQUFHLENBQUEsRUFBRzNELGVBQWUsQ0FBQSxVQUFBLENBQVk7RUFDdkQsTUFBQTtFQUFFLEtBQUEsZUFFRjZCLHNCQUFBLENBQUFDLGFBQUEsQ0FBQ0MsZ0JBQUcsRUFBQTtFQUFDTSxNQUFBQSxPQUFPLEVBQUMsTUFBTTtFQUFDQyxNQUFBQSxVQUFVLEVBQUMsUUFBUTtFQUFDQyxNQUFBQSxjQUFjLEVBQUM7RUFBZSxLQUFBLGVBQ3BFVixzQkFBQSxDQUFBQyxhQUFBLENBQUNvQixpQkFBSSxFQUFBO0VBQUNhLE1BQUFBLFVBQVUsRUFBQztFQUFNLEtBQUEsRUFDcEIwRSxJQUFJLENBQUMyQixLQUFLLEVBQUMsY0FBWSxFQUFDM0IsSUFBSSxDQUFDMkIsS0FBSyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsR0FDN0MsQ0FBQyxlQUNQdkksc0JBQUEsQ0FBQUMsYUFBQSxDQUFBLFFBQUEsRUFBQTtFQUNFNEIsTUFBQUEsSUFBSSxFQUFDLFFBQVE7UUFDYmxCLE9BQU8sRUFBR00sQ0FBQyxJQUFLO1VBQ2RBLENBQUMsQ0FBQ0MsZUFBZSxFQUFFO1VBQ25CMkYsT0FBTyxDQUFDLElBQUksQ0FBQztRQUNmLENBQUU7RUFDRjFHLE1BQUFBLEtBQUssRUFBRTtFQUFFOEksUUFBQUEsTUFBTSxFQUFFLE1BQU07RUFBRTNJLFFBQUFBLFVBQVUsRUFBRSxNQUFNO0VBQUVzRCxRQUFBQSxNQUFNLEVBQUUsU0FBUztFQUFFTCxRQUFBQSxRQUFRLEVBQUUsRUFBRTtFQUFFQyxRQUFBQSxVQUFVLEVBQUU7U0FBSTtRQUM5RixZQUFBLEVBQVc7T0FBUyxFQUNyQixNQUVPLENBQ0wsQ0FBQyxlQUNOeEQsc0JBQUEsQ0FBQUMsYUFBQSxDQUFDb0IsaUJBQUksRUFBQTtFQUFDa0MsTUFBQUEsUUFBUSxFQUFDLElBQUk7RUFBQ2xCLE1BQUFBLEVBQUUsRUFBQztPQUFTLEVBQUMseUJBRTNCLENBQ0gsQ0FBQztFQUVWLEVBQUE7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsRUFBQSxJQUFJeUUsZUFBZSxLQUFLLFNBQVMsSUFBSSxDQUFDSSxlQUFlLEVBQUU7RUFDckQsSUFBQSxvQkFDRWxILHNCQUFBLENBQUFDLGFBQUEsQ0FBQ0MsZ0JBQUcsRUFBQTtFQUFDQyxNQUFBQSxLQUFLLEVBQUU7RUFBRUMsUUFBQUEsUUFBUSxFQUFFLE9BQU87RUFBRTJJLFFBQUFBLEtBQUssRUFBRSxFQUFFO0VBQUVDLFFBQUFBLE1BQU0sRUFBRSxFQUFFO0VBQUV6SSxRQUFBQSxNQUFNLEVBQUUsSUFBSTtFQUFFUSxRQUFBQSxLQUFLLEVBQUU7U0FBTTtFQUFDSCxNQUFBQSxPQUFPLEVBQUMsT0FBTztFQUFDQyxNQUFBQSxTQUFTLEVBQUMsTUFBTTtFQUFDQyxNQUFBQSxDQUFDLEVBQUM7RUFBUyxLQUFBLGVBQzlIZCxzQkFBQSxDQUFBQyxhQUFBLENBQUNDLGdCQUFHLEVBQUE7RUFBQ00sTUFBQUEsT0FBTyxFQUFDLE1BQU07RUFBQ0MsTUFBQUEsVUFBVSxFQUFDLFFBQVE7RUFBQ0MsTUFBQUEsY0FBYyxFQUFDO0VBQWUsS0FBQSxlQUNwRVYsc0JBQUEsQ0FBQUMsYUFBQSxDQUFDb0IsaUJBQUksRUFBQTtFQUFDa0MsTUFBQUEsUUFBUSxFQUFDLElBQUk7RUFBQ3JCLE1BQUFBLFVBQVUsRUFBQztFQUFNLEtBQUEsRUFBQyxxQkFFaEMsQ0FBQyxlQUNQbEMsc0JBQUEsQ0FBQUMsYUFBQSxDQUFBLFFBQUEsRUFBQTtFQUNFNEIsTUFBQUEsSUFBSSxFQUFDLFFBQVE7RUFDYmxCLE1BQUFBLE9BQU8sRUFBRUEsTUFBTXdHLGtCQUFrQixDQUFDLElBQUksQ0FBRTtFQUN4Q2hILE1BQUFBLEtBQUssRUFBRTtFQUFFOEksUUFBQUEsTUFBTSxFQUFFLE1BQU07RUFBRTNJLFFBQUFBLFVBQVUsRUFBRSxNQUFNO0VBQUVzRCxRQUFBQSxNQUFNLEVBQUUsU0FBUztFQUFFTCxRQUFBQSxRQUFRLEVBQUUsRUFBRTtFQUFFQyxRQUFBQSxVQUFVLEVBQUU7U0FBSTtRQUM5RixZQUFBLEVBQVc7T0FBUyxFQUNyQixNQUVPLENBQ0wsQ0FBQyxlQUNOeEQsc0JBQUEsQ0FBQUMsYUFBQSxDQUFDb0IsaUJBQUksRUFBQTtFQUFDa0MsTUFBQUEsUUFBUSxFQUFDLElBQUk7RUFBQ2xCLE1BQUFBLEVBQUUsRUFBQyxTQUFTO0VBQUNqQixNQUFBQSxFQUFFLEVBQUM7RUFBUyxLQUFBLEVBQUMsa0dBRXhDLENBQUMsZUFDUHBCLHNCQUFBLENBQUFDLGFBQUEsQ0FBQSxRQUFBLEVBQUE7RUFDRTRCLE1BQUFBLElBQUksRUFBQyxRQUFRO0VBQ2JsQixNQUFBQSxPQUFPLEVBQUVBLE1BQU1xRyxZQUFZLENBQUNrQyxpQkFBaUIsRUFBRSxDQUFDakssSUFBSSxDQUFFNkIsQ0FBQyxJQUFLaUcsa0JBQWtCLENBQUNqRyxDQUFDLENBQUMsQ0FBRTtFQUNuRlgsTUFBQUEsS0FBSyxFQUFFO0VBQUVZLFFBQUFBLEtBQUssRUFBRSxNQUFNO0VBQUVrSSxRQUFBQSxNQUFNLEVBQUUsTUFBTTtFQUFFakksUUFBQUEsWUFBWSxFQUFFLENBQUM7RUFBRVYsUUFBQUEsVUFBVSxFQUFFLFNBQVM7RUFBRWdELFFBQUFBLEtBQUssRUFBRSxNQUFNO0VBQUVwQixRQUFBQSxVQUFVLEVBQUUsR0FBRztFQUFFSCxRQUFBQSxPQUFPLEVBQUUsT0FBTztFQUFFNkIsUUFBQUEsTUFBTSxFQUFFO0VBQVU7T0FBRSxFQUN2SixlQUVPLENBQ0wsQ0FBQztFQUVWLEVBQUE7RUFFQSxFQUFBLE9BQU8sSUFBSTtFQUNiOztFQzNOQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNlLFNBQVN1RixtQkFBbUJBLENBQUNDLEtBQW9HLEVBQUU7SUFDaEosTUFBTTtNQUFFQyxpQkFBaUI7TUFBRSxHQUFHQztFQUFLLEdBQUMsR0FBR0YsS0FBSztJQUM1QyxvQkFDRXBKLHNCQUFBLENBQUFDLGFBQUEsQ0FBQUQsc0JBQUEsQ0FBQXVKLFFBQUEsRUFBQSxJQUFBLGVBQ0V2SixzQkFBQSxDQUFBQyxhQUFBLENBQUNvSixpQkFBaUIsRUFBS0MsSUFBTyxDQUFDLGVBQy9CdEosc0JBQUEsQ0FBQUMsYUFBQSxDQUFDMEcsZUFBZSxFQUFBLElBQUUsQ0FDbEIsQ0FBQztFQUVQOztFQ3JCQTZDLE9BQU8sQ0FBQ0MsY0FBYyxHQUFHLEVBQUU7RUFFM0JELE9BQU8sQ0FBQ0MsY0FBYyxDQUFDL0csU0FBUyxHQUFHQSxTQUFTO0VBRTVDOEcsT0FBTyxDQUFDQyxjQUFjLENBQUNDLE1BQU0sR0FBR0EsbUJBQU07Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMSwyLDMsNCw1LDYsNyw4LDksMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTksMjAsMjEsMjIsMjMsMjQsMjUsMjYsMjcsMjhdfQ==
