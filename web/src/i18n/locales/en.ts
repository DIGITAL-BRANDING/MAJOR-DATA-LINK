const en = {
  partnerPortal: {
    common: {
      loading: 'Loading…',
      copy: 'Copy',
      copied: 'Copied.',
      save: 'Save',
      generate: 'Generate',
      revoke: 'Revoke'
    },
    header: {
      appName: 'K-Tech Solutions',
      tagline: 'Partner Portal',
      documentation: 'Documentation',
      dashboard: 'Dashboard',
      logout: 'Log out'
    },
    auth: {
      login: 'Log in',
      register: 'Register',
      businessName: 'Business name',
      businessNamePlaceholder: 'e.g. Kindness Digital Branding',
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      phone: 'Phone number (optional)',
      phonePlaceholder: '08012345678',
      password: 'Password',
      passwordPlaceholderRegister: 'At least 8 characters',
      loginCta: 'Log in',
      registerCta: 'Create company account',
      registerNotice:
        "After registering, a K-Tech Solutions admin will review your company before you can generate a live API key or process transactions - but you can log into the dashboard right away to check your registration status.",
      genericError: 'Something went wrong. Please try again.'
    },
    banner: {
      pendingTitle: 'Your registration is under review',
      pendingBody:
        'We\'re reviewing your company before you can generate a live API key or start processing transactions. We\'ll reach out to you by email ({{email}}) once approved.',
      suspendedTitle: 'This account has been suspended',
      suspendedBody: 'Contact K-Tech Solutions for more information about this account.'
    },
    hero: {
      welcomeBack: 'Welcome back',
      walletBalance: 'Partner wallet balance'
    },
    metrics: {
      todayCalls: "Today's Calls",
      totalCalls: 'Total Calls',
      totalSpend: 'Total Spend',
      successfulCalls: 'Successful Calls',
      failedCalls: 'Failed Calls'
    },
    callsOverview: {
      title: 'API Calls Overview (Last 30 Days)',
      empty: 'No data yet.'
    },
    wallet: {
      title: 'Partner funding account',
      permanentAccount: 'Permanent account',
      bankTransferFallback: 'Bank transfer',
      transferHint: 'Transfer to this account to fund your Partner wallet.',
      copyAccountNumber: 'Copy account number',
      createAccount: 'Create funding account',
      creating: 'Please wait…',
      exactTransferLabel: 'Exact Transfer (fallback, one-off amount)',
      amountPlaceholder: 'Amount (₦)',
      refLabel: 'Ref',
      expiresLabel: 'Expires',
      fundingAccountCreated: 'Your permanent funding account is ready.',
      fundingAccountFailed: 'Could not create funding account',
      exactTransferFailed: 'Could not create Exact Transfer account'
    },
    apiKeys: {
      title: 'API keys',
      newKey: 'New key',
      pendingApprovalTooltip: 'Your company needs to be approved before you can generate a live key',
      revealNotice: 'Save this key now - it will not be shown again:',
      savedIt: "I've saved it",
      noKeys: 'No API key yet.',
      revokedOn: 'Revoked {{date}}',
      lastUsedOn: 'Last used {{date}}',
      neverUsed: 'Never used yet',
      revokeTitle: 'Revoke',
      revokedNotice: 'Key revoked.',
      generateFailed: 'Could not generate API key',
      revokeFailed: 'Could not revoke key'
    },
    webhook: {
      title: 'Webhook',
      description: "We'll send you a <code>transaction.updated</code> event whenever a transaction that first came back \"pending\" resolves.",
      urlPlaceholder: 'https://yourapp.com/webhooks/mdl',
      secretNotice: 'Webhook secret (save it now, it will not be shown again):',
      sendTest: 'Send test event',
      testQueued: 'Test event queued - check your endpoint in a moment.',
      saveFailed: 'Could not save webhook URL',
      testFailed: 'Could not queue test event',
      configuredNotice: 'Webhook configured. Save the secret now; it will not be shown again.'
    },
    pricing: {
      title: 'Service Pricing',
      subtitle:
        'Wholesale price - data/airtime pricing varies by plan, see <code>GET /data/plans/:network</code> in the documentation for current pricing.'
    },
    callsSummary: {
      title: 'API Calls Summary',
      searchPlaceholder: 'Search by reference',
      colReference: 'Reference',
      colType: 'Type',
      colAmount: 'Amount',
      colBalanceBefore: 'Balance before',
      colBalanceAfter: 'Balance after',
      colStatus: 'Status',
      colDate: 'Date',
      empty: 'No API calls found.'
    },
    language: {
      label: 'Language',
      en: 'English',
      ha: 'Hausa'
    },
    docs: {
      pageTitle: 'API Documentation',
      pageSubtitle: 'K-Tech Solutions Partner Platform',
      intro:
        'Everything you need to integrate K-Tech Solutions into your own application — data & airtime, NIN/BVN verification slips, wallet funding, and async identity services. All endpoints accept JSON and are authenticated with your API key.',
      keyNotice:
        "We can't show your live API key here (it's stored as a hash only, never in plain text after it's created) —",
      keyNoticeLink: 'go to your dashboard',
      keyNoticeSuffix: 'to generate/view your API keys.',
      sections: {
        auth: 'Authentication',
        wallet: 'Wallet & Funding',
        dataAirtime: 'Data & Airtime',
        nin: 'NIN Slips',
        bvn: 'BVN Slips',
        async: 'Async Services',
        transactions: 'Transactions',
        webhooks: 'Webhooks',
        errors: 'Error Handling'
      },
      auth: {
        body: 'Include your API key in the <code>X-API-Key</code> header on every request. Never send it as a body or query parameter, and never embed it in a mobile app or public frontend.',
        idempotencyNote:
          '<code>Idempotency-Key</code> is required on every purchase/submit endpoint (8-128 characters, unique per order on your side). Retry the exact same request with the same key any time - it will never be charged twice.'
      },
      wallet: {
        intro: 'Every purchase debits your partner wallet directly - fund it via a permanent virtual account or a one-off Exact Transfer.',
        balance: 'Check wallet balance',
        createAccount: 'Create a permanent funding account',
        createAccountBody: "Provisions a dedicated bank account number - any transfer to it credits your wallet automatically.",
        dynamic: 'One-off Exact Transfer'
      },
      dataAirtime: {
        categories: 'List data plan categories',
        plans: 'List data plans',
        buyData: 'Buy data',
        buyAirtime: 'Buy airtime',
        pendingNote:
          'A purchase can come back <code>"status": false</code> with <code>"pending"</code> reflected in a later <code>GET /transactions/:reference</code> call, if the provider itself is still confirming the order. Never re-submit as a new order when this happens - your Idempotency-Key already covers a retry.'
      },
      nin: { intro: 'Instant slip generation - returns a PDF (base64) and the underlying record.' },
      async: {
        intro:
          "NIN Validation, Personalization, and IPE Clearance don't return an instant result: a request is <bold>submitted</bold> (this deducts your balance and returns a <code>ticket_id</code>), an admin processes it, and you <bold>check status</bold> later with that <code>ticket_id</code> to see the outcome.",
        pollNote: "Poll a ticket at a reasonable interval (e.g. every 1-2 minutes) - not in a tight loop. Configure a",
        pollNoteLink: 'webhook',
        pollNoteSuffix: 'to be notified the moment a ticket resolves instead of polling at all.',
        submitRequest: 'Submit request',
        checkStatus: 'Check status'
      },
      transactions: {
        lookup: 'Look up a single transaction',
        list: 'List recent transactions'
      },
      webhooks: {
        intro: 'Configure a webhook URL from your',
        introLink: 'dashboard',
        introSuffix: "to get notified when a transaction that first came back pending later resolves.",
        headers: 'Headers',
        payload: 'Payload',
        note:
          "Verify the HMAC signature with your webhook secret, respond <code>200</code> within 10 seconds, and handle the event idempotently - a delivery may be retried (30s, 2m, 10m, 1h, then 6h) if your endpoint doesn't acknowledge it in time."
      },
      errors: {
        intro: 'All API responses share a consistent shape. Check the <code>status</code> field for success or failure.',
        code200: 'Success',
        code400: 'Bad request - invalid parameters, insufficient balance, or record not found',
        code401: 'Unauthorized - missing or invalid API key',
        code404: 'Not found - unknown ticket_id or transaction reference',
        code422: 'Missing/invalid Idempotency-Key',
        code429: 'Too many requests - rate limit exceeded'
      },
      params: { parameter: 'Parameter', type: 'Type', required: 'Required', description: 'Description', yes: 'Yes', no: 'No' },
      response: 'Response'
    }
  }
} as const;

export default en;
