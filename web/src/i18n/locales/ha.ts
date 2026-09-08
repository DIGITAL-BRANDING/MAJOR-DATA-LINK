const ha = {
  partnerPortal: {
    common: {
      loading: 'Ana lodawa…',
      copy: 'Kwafi',
      copied: 'An kwafi.',
      save: 'Ajiye',
      generate: 'Ƙirƙira',
      revoke: 'Soke'
    },
    header: {
      appName: 'Major Data Link',
      tagline: 'Partner Portal',
      documentation: 'Documentation',
      dashboard: 'Dashboard',
      logout: 'Fita'
    },
    auth: {
      login: 'Shiga',
      register: 'Yi rajista',
      businessName: 'Sunan kamfani',
      businessNamePlaceholder: 'misali Kindness Digital Branding',
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      phone: 'Lambar waya (na zaɓi)',
      phonePlaceholder: '08012345678',
      password: 'Password',
      passwordPlaceholderRegister: 'Aƙalla haruffa 8',
      loginCta: 'Shiga',
      registerCta: 'Ƙirƙiri asusun kamfani',
      registerNotice:
        'Bayan rajista, admin din Major Data Link zai fara duba kamfaninku kafin ku iya ƙirƙirar live API key ko sarrafa transactions - amma za ku iya shiga dashboard ɗin nan take don duba matsayin rajistarku.',
      genericError: 'Wani abu ya faru. Da fatan za a sake gwadawa.'
    },
    banner: {
      pendingTitle: 'Ana bitar rajistarku',
      pendingBody:
        'Za a fara duba kamfaninku kafin ku iya ƙirƙirar live API key ko fara sarrafa transactions. Za mu tuntube ku ta imel ({{email}}) idan an amince.',
      suspendedTitle: 'An dakatar da wannan asusun',
      suspendedBody: 'Tuntuɓi Major Data Link don ƙarin bayani game da wannan asusun.'
    },
    hero: {
      welcomeBack: 'Barka da dawowa',
      walletBalance: 'Ma\'aunin wallet na Partner'
    },
    metrics: {
      todayCalls: 'Calls na Yau',
      totalCalls: 'Jimlar Calls',
      totalSpend: 'Jimlar Kashewa',
      successfulCalls: 'Calls masu Nasara',
      failedCalls: 'Calls da suka Kasa'
    },
    callsOverview: {
      title: 'Bayanin API Calls (Kwana 30 na Baya)',
      empty: 'Babu bayanai tukuna.'
    },
    wallet: {
      title: 'Asusun caji na Partner',
      permanentAccount: 'Dindindin account',
      bankTransferFallback: 'Bank transfer',
      transferHint: 'Yi transfer zuwa wannan account don cajin wallet ɗinku na Partner.',
      copyAccountNumber: 'Kwafi lambar account',
      createAccount: 'Ƙirƙiri funding account',
      creating: 'Da fatan za a jira…',
      exactTransferLabel: 'Exact Transfer (zaɓi na dabam, adadin sau ɗaya)',
      amountPlaceholder: 'Adadin kuɗi (₦)',
      refLabel: 'Ref',
      expiresLabel: 'Zai ƙare',
      fundingAccountCreated: 'An kirkiri permanent funding account ɗinku.',
      fundingAccountFailed: 'An kasa ƙirƙirar funding account',
      exactTransferFailed: 'An kasa ƙirƙirar Exact Transfer account'
    },
    apiKeys: {
      title: 'API keys',
      newKey: 'Sabon key',
      pendingApprovalTooltip: 'Dole a fara amincewa da kamfaninku kafin ku iya ƙirƙirar live key',
      revealNotice: 'Ajiye wannan key ɗin yanzu - ba za a sake nuna shi ba:',
      savedIt: 'Na ajiye shi',
      noKeys: 'Babu API key tukuna.',
      revokedOn: 'An soke {{date}}',
      lastUsedOn: 'An yi amfani da shi na ƙarshe {{date}}',
      neverUsed: 'Ba a taɓa amfani da shi ba tukuna',
      revokeTitle: 'Soke',
      revokedNotice: 'An soke key ɗin.',
      generateFailed: 'An kasa ƙirƙirar API key',
      revokeFailed: 'An kasa soke key ɗin'
    },
    webhook: {
      title: 'Webhook',
      description: 'Za a tura muku <code>transaction.updated</code> event idan wani transaction da farko ya tsaya "pending" ya warware.',
      urlPlaceholder: 'https://yourapp.com/webhooks/mdl',
      secretNotice: 'Webhook secret (ajiye yanzu, ba za a sake nuna shi ba):',
      sendTest: 'Tura test event',
      testQueued: 'An sanya test event a layi - duba endpoint ɗinku a cikin dakiku kaɗan.',
      saveFailed: 'An kasa ajiye webhook URL',
      testFailed: 'An kasa sanya test event a layi',
      configuredNotice: 'An saita webhook. Ajiye secret ɗin yanzu; ba za a sake nuna shi ba.'
    },
    pricing: {
      title: 'Farashin Sabis',
      subtitle:
        'Farashin wholesale - farashin data/airtime yana canzawa bisa plan, duba <code>GET /data/plans/:network</code> a documentation don ainihin farashi na yanzu.'
    },
    callsSummary: {
      title: 'Taƙaitawar API Calls',
      searchPlaceholder: 'Nemo ta reference',
      colReference: 'Reference',
      colType: 'Nau\'i',
      colAmount: 'Adadin kuɗi',
      colBalanceBefore: 'Balance kafin',
      colBalanceAfter: 'Balance bayan',
      colStatus: 'Matsayi',
      colDate: 'Kwanan wata',
      empty: 'Babu API call da aka samu.'
    },
    language: {
      label: 'Harshe',
      en: 'Turanci',
      ha: 'Hausa'
    },
    docs: {
      pageTitle: 'API Documentation',
      pageSubtitle: 'Major Data Link Partner Platform',
      intro:
        'Duk abin da kuke bukata don haɗa Major Data Link cikin app ɗinku — data & airtime, NIN/BVN verification slips, wallet funding, da async identity services. Duk endpoints suna karɓar JSON kuma ana tantance su ta API key ɗinku.',
      keyNotice: 'Ba mu iya nuna live API key ɗinku a nan (ana ajiye shi a matsayin hash kaɗai, ba a taɓa ajiye shi a bayyane bayan an ƙirƙira shi ba) —',
      keyNoticeLink: 'je zuwa dashboard ɗinku',
      keyNoticeSuffix: 'don ƙirƙira/duba API keys ɗinku.',
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
        body: 'Sanya API key ɗinku a cikin <code>X-API-Key</code> header a kowane request. Kada a taɓa turawa a matsayin body ko query parameter, kuma kada a taɓa saka shi a mobile app ko public frontend.',
        idempotencyNote:
          '<code>Idempotency-Key</code> ana bukatarsa a kowane purchase/submit endpoint (haruffa 8-128, na musamman ga kowane order a bangarenku). Za ku iya sake tura iri ɗaya request da iri ɗaya key a kowane lokaci - ba za a taɓa cajin ku sau biyu ba.'
      },
      wallet: {
        intro: 'Kowace purchase tana cire kuɗi kai tsaye daga wallet ɗinku na Partner - ku caje shi ta hanyar permanent virtual account ko Exact Transfer sau ɗaya.',
        balance: 'Duba ma\'aunin wallet',
        createAccount: 'Ƙirƙiri permanent funding account',
        createAccountBody: 'Yana samar da wata keɓantacciyar lambar account ta bank - duk wani transfer zuwa gareta yana cajin wallet ɗinku kai tsaye.',
        dynamic: 'Exact Transfer sau ɗaya'
      },
      dataAirtime: {
        categories: 'Jerin data plan categories',
        plans: 'Jerin data plans',
        buyData: 'Sayi data',
        buyAirtime: 'Sayi airtime',
        pendingNote:
          'Purchase na iya dawowa da <code>"status": false</code> tare da <code>"pending"</code> a wani GET /transactions/:reference na baya, idan provider yana ci gaba da tabbatarwa. Kada a sake tura sabon order idan haka ya faru - Idempotency-Key ɗinku ya riga ya rufe retry.'
      },
      nin: { intro: 'Slip generation nan take - yana dawo da PDF (base64) da bayanan da ke ƙasa.' },
      async: {
        intro:
          'NIN Validation, Personalization, da IPE Clearance ba sa dawowa da sakamako nan take: ana <bold>tura request</bold> (wannan yana cire kuɗi kuma yana dawo da <code>ticket_id</code>), admin yana sarrafa shi, sannan ku <bold>duba status</bold> daga baya da wancan <code>ticket_id</code> don ganin sakamako.',
        pollNote: 'Ku bincika ticket a wani lokaci mai kyau (misali kowane minti 1-2) - ba a cikin tight loop ba. Ku saita',
        pollNoteLink: 'webhook',
        pollNoteSuffix: 'don a sanar da ku nan take ticket ya warware maimakon ku rika duba shi kullum.',
        submitRequest: 'Tura request',
        checkStatus: 'Duba status'
      },
      transactions: {
        lookup: 'Duba wani transaction guda ɗaya',
        list: 'Jerin transactions na baya-bayan nan'
      },
      webhooks: {
        intro: 'Saita webhook URL daga',
        introLink: 'dashboard',
        introSuffix: 'ɗinku don a sanar da ku idan wani transaction da farko ya dawo pending ya warware.',
        headers: 'Headers',
        payload: 'Payload',
        note:
          'Tabbatar da HMAC signature da webhook secret ɗinku, ku mayar da <code>200</code> cikin seconds 10, kuma ku sarrafa event ɗin idempotently - ana iya sake tura delivery (30s, 2m, 10m, 1h, sannan 6h) idan endpoint ɗinku bai amsa akan lokaci ba.'
      },
      errors: {
        intro: 'Duk amsoshin API suna da tsari iri ɗaya. Duba filin <code>status</code> don sanin nasara ko gazawa.',
        code200: 'Nasara',
        code400: 'Bad request - parameters ba daidai ba, balance bai isa ba, ko ba a sami record ba',
        code401: 'Unauthorized - babu API key ko ba daidai ba',
        code404: 'Ba a samu ba - ticket_id ko transaction reference ba a sani ba',
        code422: 'Idempotency-Key ya ɓace ko ba daidai ba',
        code429: 'Yawan requests da yawa - rate limit ya cika'
      },
      params: { parameter: 'Parameter', type: 'Nau\'i', required: 'Ya wajaba', description: 'Bayani', yes: 'Eh', no: "A'a" },
      response: 'Response'
    }
  }
} as const;

export default ha;
