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
    enterpriseApi: {
      documentation: 'API documentation',
      signIn: 'Partner sign in',
      eyebrow: 'Enterprise API access',
      heroTitle: 'Build your product on reliable identity and digital service APIs.',
      heroBody: 'One secure integration for NIN and BVN verification, data, airtime, wallet funding and asynchronous identity services. Every enterprise partner receives a reviewed access plan and a private pricing offer.',
      apply: 'Apply for API access',
      viewDocs: 'Explore technical docs',
      trust: { https: 'HTTPS-only API', idempotency: 'Idempotent transactions', webhooks: 'Signed webhook events' },
      servicesEyebrow: 'What you can build',
      servicesTitle: 'Services designed for production integrations',
      servicesBody: 'Use a predictable API surface, detailed references and delivery events to keep your customers informed from request to completion.',
      services: {
        identity: { title: 'Identity verification', body: 'NIN, BVN and identity service workflows with provider routing, references and status tracking.' },
        data: { title: 'Data & airtime', body: 'Purchase data plans and airtime through one authenticated API with idempotency protection.' },
        wallet: { title: 'Wallet funding', body: 'Fund your partner wallet using a dedicated account or a secure one-off transfer flow.' },
        async: { title: 'Async operations', body: 'Submit long-running requests and receive signed webhook updates when they resolve.' }
      },
      accessEyebrow: 'Access plans',
      accessTitle: 'Choose the operating model that fits your business',
      accessBody: 'Your approved plan is attached to your company account. Enterprise pricing can be negotiated per partner and is visible only inside your portal.',
      recommended: 'Recommended',
      choosePlan: 'Start application',
      plans: {
        starter: { title: 'Starter', body: 'For teams validating an integration.', features: ['Reviewed enterprise registration', 'NIN/BVN API access after approval', 'Standard rate limits', 'Partner dashboard and documentation'] },
        growth: { title: 'Growth', body: 'For products processing regular customer volume.', features: ['Everything in Starter', 'Higher request limits by agreement', 'Webhook delivery and retries', 'Private negotiated pricing offer'] },
        enterprise: { title: 'Enterprise', body: 'For high-volume platforms and strategic partners.', features: ['Custom service access plan', 'Custom pricing per service', 'Integration support and monitoring', 'Dedicated commercial relationship'] }
      },
      promise: {
        security: { title: 'Security by default', body: 'Keys are stored as hashes, requests use HTTPS, and webhook events can be verified with a secret.' },
        keys: { title: 'Controlled API keys', body: 'Create, label, rotate and revoke keys from your partner portal without exposing old secrets.' },
        support: { title: 'Operational visibility', body: 'Track transactions, webhook health, request updates and integration activity from one portal.' }
      }
    },
    registrationPage: {
      eyebrow: 'Enterprise onboarding',
      title: 'Apply for production API access',
      body: 'Tell us about your company and integration so we can prepare the right service access, limits and private commercial offer for your team.',
      signIn: 'Already have an account?',
      benefit1: 'Your application is reviewed by the K-Tech Solutions API team.',
      benefit2: 'Approved partners receive controlled keys and a private pricing offer.',
      benefit3: 'You can start in sandbox and move to production after approval.',
      stepCompany: 'Company',
      stepIntegration: 'Integration',
      stepAccess: 'Access',
      companySection: 'Company profile',
      companyHint: 'Use your registered business details so our team can verify the application.',
      integrationSection: 'Integration plan',
      integrationHint: 'Select the services and environment your product needs.',
      accountSection: 'Portal account',
      accountHint: 'Create the secure account you will use to track approval, keys, pricing and API activity.',
      companyRequired: 'Complete the business name, primary contact and business type before continuing.',
      integrationRequired: 'Select at least one service and describe your integration in at least 10 characters.',
      consent: 'I confirm that these details are accurate and agree that K-Tech Solutions may contact me about API access and onboarding.',
      consentRequired: 'Please confirm the application consent before submitting.',
      back: 'Back',
      next: 'Continue',
      submit: 'Submit enterprise application',
      submitting: 'Submitting application…'
    },
    notifications: {
      recent: 'Recent notifications',
      empty: 'No notifications yet.'
    },
    auth: {
      login: 'Log in',
      register: 'Register',
      businessName: 'Business name',
      businessNamePlaceholder: 'e.g. Kindness Digital Branding',
      contactName: 'Primary contact name',
      contactNamePlaceholder: 'Full name of the account owner',
      companyRegistrationNumber: 'Company registration number (optional)',
      companyRegistrationNumberPlaceholder: 'RC / BN number',
      businessType: 'Business type',
      selectBusinessType: 'Select business type',
      otherBusinessType: 'Other',
      website: 'Company website (optional)',
      expectedVolume: 'Expected monthly API requests (optional)',
      environment: 'Integration environment',
      requestedServices: 'Services you need (optional)',
      requestedServicesPlaceholder: 'Comma-separated, e.g. NIN, BVN, IPE Clearance',
      useCase: 'How will you use the API?',
      useCasePlaceholder: 'Tell us about your product, customers, and integration plan.',
      technicalEmail: 'Technical contact email (optional)',
      technicalPhone: 'Technical contact phone (optional)',
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      phone: 'Phone number (optional)',
      phonePlaceholder: '08012345678',
      password: 'Password',
      passwordPlaceholderRegister: 'At least 8 characters',
      loginCta: 'Log in',
      registerCta: 'Create company account',
      backToEnterprise: 'Enterprise API',
      loginEyebrow: 'Secure partner access',
      loginTitle: 'Operate your API business with confidence.',
      loginBody: 'Sign in to manage API keys, wallet funding, webhooks, service pricing, and every transaction from one controlled enterprise workspace.',
      loginPrompt: 'Use your approved company account to continue to the partner control center.',
      loginFeatureSecurity: 'Protected access',
      loginFeatureKeys: 'Controlled API keys',
      loginFeatureMonitoring: 'Live monitoring',
      loginSecurityNote: 'Your credentials are encrypted in transit.',
      viewDocumentation: 'Read API documentation',
      newPartner: 'New enterprise partner?',
      startOnboarding: 'Start 3-step onboarding',
      registerNotice:
        "This enterprise application helps us review your business and integration needs. A K-Tech Solutions admin will approve the account before you can generate a live API key or process transactions. Your private offer code and negotiated prices will appear in the dashboard after registration.",
      genericError: 'Something went wrong. Please try again.'
    },
    enterpriseOffer: {
      title: 'Your private enterprise offer',
      body: 'This code identifies the negotiated pricing assigned only to your company. Keep it with your integration records.'
    },
    banner: {
      pendingTitle: 'Your registration is under review',
      pendingBody:
        'We\'re reviewing your company before you can generate a live API key or start processing transactions. We\'ll reach out to you by email ({{email}}) once approved.',
      rejectedTitle: 'Your API application needs further review',
      rejectedBody: 'This application was not approved at this time. Check your notifications for the review note or contact K-Tech Solutions for next steps.',
      suspendedTitle: 'This account has been suspended',
      suspendedBody: 'Contact K-Tech Solutions for more information about this account.'
    },
    onboarding: {
      title: 'Developer onboarding center',
      subtitle: 'Complete the steps below to prepare your company for reliable production API integration.',
      progress: '{{completed}} of {{total}} steps complete',
      applicationStatus: 'Application status',
      status: {
        active: 'Approved and active',
        pending_review: 'Pending review',
        rejected: 'Needs further review',
        suspended: 'Suspended'
      },
      registrationTitle: 'Enterprise profile submitted',
      registrationBody: 'Your company and integration profile has been recorded.',
      approvalTitle: 'Application approved',
      approvalBody: {
        active: 'Your account is approved and can use live partner features.',
        pending_review: 'Our team is reviewing your company and integration plan.',
        rejected: 'Review the notification sent to your account and contact support for next steps.',
        suspended: 'Your account is currently suspended. Contact support before continuing.'
      },
      walletTitle: 'Fund your partner wallet',
      walletBody: 'Maintain at least ₦{{minimum}} to activate identity API access.',
      apiKeyTitle: 'Create a live API key',
      apiKeyBody: 'Generate a key after approval and store it securely in your server environment.',
      webhookTitle: 'Configure your webhook',
      webhookBody: 'Add a secure callback URL so your system receives transaction status updates.',
      completed: 'Complete',
      openStep: 'Open step',
      ready: 'Your partner account is ready for production integration.'
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
    quickLinks: {
      label: 'Partner portal sections',
      overview: 'Overview',
      onboarding: 'Developer center',
      wallet: 'Wallet & keys',
      webhooks: 'Webhooks',
      activity: 'Activity',
      transactions: 'Transactions',
      pricing: 'Pricing',
      documentation: 'Documentation',
      openMenu: 'Menu',
      closeMenu: 'Close'
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
      exactTransferFailed: 'Could not create Exact Transfer account',
      bvnIntro: 'Your funding account is issued in the name of the business owner, so enter their BVN once. We do not keep the full number.',
      bvnLabel: 'Owner BVN (11 digits)',
      bvnPrivacy: 'Only the last 4 digits are stored.'
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
      revokeFailed: 'Could not revoke key',
      rotateTitle: 'Rotate key',
      rotatedNotice: 'Key rotated. Save the new key now; the old key is revoked.',
      rotateFailed: 'Could not rotate key',
      keyLabel: 'Key label',
      active: 'active',
      revoked: 'revoked',
      activeCount: '{{count}} active'
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
      retryFailed: 'Recover missed updates',
      retryQueued: 'Queued {{count}} missed update(s) for delivery.',
      retryNone: 'No old transaction updates are waiting for delivery.',
      retryFailedError: 'Could not retry failed updates',
      recentDeliveries: 'Recent webhook deliveries',
      refresh: 'Refresh',
      noDeliveries: 'No webhook deliveries yet.',
      historyFailed: 'Could not load webhook deliveries',
      attempts: '{{count}} attempt(s)',
      retryOne: 'Retry now',
      deliveryRetried: 'Webhook delivery retried successfully.',
      deliveryRetryQueued: 'Webhook retry queued.',
      healthTitle: 'Webhook health',
      last30Days: 'Delivery performance over the last 30 days',
      delivered: 'Delivered',
      failed: 'Failed',
      pending: 'Pending',
      lastFailure: 'Last failed delivery',
      healthFailed: 'Could not load webhook health',
      configuredNotice: 'Webhook configured. Save the secret now; it will not be shown again.'
    },
    pricing: {
      title: 'Service Pricing',
      subtitle: 'Your active partner rates for available services.',
      eyebrow: 'Partner price book',
      availableServices: 'Available services',
      allCategories: 'All services',
      show: 'Show',
      entries: 'entries',
      search: 'Search services…',
      service: 'Service',
      category: 'Category',
      partnerPrice: 'Your price (₦)',
      empty: 'No services match your filters.',
      showing: 'Showing {{start}}–{{end}} of {{total}} services',
      previous: 'Previous',
      next: 'Next',
      page: 'Page {{page}} of {{pages}}',
      categories: {
        airtime: 'Airtime', data: 'Data', cable: 'Cable TV', education: 'Education', electricity: 'Electricity',
        nin: 'NIN', bvn: 'BVN', jamb: 'JAMB', cac: 'CAC', tax: 'Tax', other: 'Other'
      }
    },
    callsSummary: {
      title: 'API Calls Summary',
      transactionsSubtitle: 'Review your partner transaction ledger and inspect individual references.',
      searchPlaceholder: 'Search reference, provider ref or description',
      filters: 'Filters',
      allStatuses: 'All statuses',
      allTypes: 'All services',
      from: 'From',
      to: 'To',
      exportCsv: 'Export CSV',
      clearFilters: 'Clear filters',
      show: 'Show',
      entries: 'entries',
      showingTransactions: 'Showing {{start}}–{{end}} of {{total}} transactions',
      previous: 'Previous',
      next: 'Next',
      colNin: 'NIN',
      protectedIdentifier: 'Protected',
      details: 'Details',
      detailTitle: 'Transaction details',
      timeline: 'Timeline',
      close: 'Close',
      colReference: 'Transaction ID',
      colType: 'Type',
      colAmount: 'Price (₦)',
      colBalanceBefore: 'Balance before',
      colBalanceAfter: 'Balance after',
      colStatus: 'Status',
      colDate: 'Date',
      empty: 'No API calls found.'
    },
    activity: {
      title: 'Activity center',
      subtitle: 'A unified timeline of transactions, request updates, webhooks and API key actions.',
      search: 'Search activity',
      all: 'All activity',
      transactions: 'Transactions',
      updates: 'Request updates',
      webhooks: 'Webhooks',
      apiKeys: 'API keys',
      refresh: 'Refresh',
      empty: 'No activity found.'
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
        identity: 'Identity & Manual Services',
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
