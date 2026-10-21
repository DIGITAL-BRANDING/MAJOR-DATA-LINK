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
      appName: 'K-Tech Solutions',
      tagline: 'Partner Portal',
      documentation: 'Documentation',
      dashboard: 'Dashboard',
      logout: 'Fita'
    },
    enterpriseApi: {
      documentation: 'Bayanan API',
      signIn: 'Shiga Partner',
      eyebrow: 'Enterprise API access',
      heroTitle: 'Gina samfurinka da ingantattun identity da digital service APIs.',
      heroBody: 'Haɗa NIN da BVN verification, data, airtime, wallet funding da asynchronous identity services cikin integration guda mai tsaro. Kowane enterprise partner yana samun tsari da farashi na musamman bayan dubawa.',
      apply: 'Nemi API access',
      viewDocs: 'Duba technical docs',
      trust: { https: 'HTTPS kawai', idempotency: 'Idempotent transactions', webhooks: 'Signed webhook events' },
      servicesEyebrow: 'Abin da za ku gina',
      servicesTitle: 'Services da aka shirya don production integration',
      servicesBody: 'Yi amfani da API mai tsari, cikakkun references da delivery events domin customers su san matsayin request daga farko zuwa ƙarshe.',
      services: {
        identity: { title: 'Identity verification', body: 'NIN, BVN da identity service workflows tare da provider routing, references da status tracking.' },
        data: { title: 'Data da airtime', body: 'Sayi data plans da airtime ta authenticated API guda mai kariyar idempotency.' },
        wallet: { title: 'Wallet funding', body: 'Caji partner wallet da dedicated account ko secure one-off transfer flow.' },
        async: { title: 'Async operations', body: 'Tura requests masu ɗaukar lokaci sannan ka karɓi signed webhook updates idan sun kammala.' }
      },
      accessEyebrow: 'Tsare-tsaren access',
      accessTitle: 'Zaɓi tsarin da ya dace da kasuwancinka',
      accessBody: 'An haɗa plan ɗinka da company account ɗinka. Ana iya tattauna enterprise pricing ga kowane partner kuma shi kaɗai zai gan shi a portal ɗinsa.',
      recommended: 'Mafi dacewa',
      choosePlan: 'Fara application',
      plans: {
        starter: { title: 'Starter', body: 'Ga teams da ke fara gwajin integration.', features: ['Enterprise registration da aka duba', 'NIN/BVN API bayan approval', 'Standard rate limits', 'Partner dashboard da documentation'] },
        growth: { title: 'Growth', body: 'Ga products masu yawan customer requests.', features: ['Dukkan Starter', 'Higher request limits bisa yarjejeniya', 'Webhook delivery da retries', 'Private negotiated pricing offer'] },
        enterprise: { title: 'Enterprise', body: 'Ga high-volume platforms da strategic partners.', features: ['Custom service access plan', 'Custom pricing ga kowane service', 'Integration support da monitoring', 'Dedicated commercial relationship'] }
      },
      promise: {
        security: { title: 'Tsaro tun daga farko', body: 'Ana ajiye keys a matsayin hashes, ana amfani da HTTPS, kuma za a iya tabbatar da webhook events da secret.' },
        keys: { title: 'Controlled API keys', body: 'Ƙirƙira, sa wa suna, rotate da revoke keys daga partner portal ba tare da fallasa tsoffin secrets ba.' },
        support: { title: 'Ganin aikin system', body: 'Bi transactions, webhook health, request updates da integration activity daga portal guda.' }
      }
    },
    registrationPage: {
      eyebrow: 'Enterprise onboarding',
      title: 'Nemi production API access',
      body: 'Faɗa mana game da kamfaninku da integration ɗinku domin mu shirya service access, limits da farashin kasuwanci na musamman.',
      signIn: 'Kuna da account?',
      benefit1: 'Ƙungiyar API ta K-Tech Solutions za ta duba application ɗinku.',
      benefit2: 'Partner da aka amince da shi zai samu controlled keys da farashi na sirri.',
      benefit3: 'Za ku iya fara da sandbox sannan ku koma production bayan approval.',
      stepCompany: 'Kamfani',
      stepIntegration: 'Integration',
      stepAccess: 'Access',
      companySection: 'Bayanan kamfani',
      companyHint: 'Yi amfani da bayanan kasuwancin da aka yi rajista domin a iya tabbatar da application ɗinku.',
      integrationSection: 'Tsarin integration',
      integrationHint: 'Zaɓi services da environment da samfurinku yake buƙata.',
      accountSection: 'Asusun portal',
      accountHint: 'Ƙirƙiri secure account da za ku yi amfani da shi wajen bin approval, keys, farashi da API activity.',
      companyRequired: 'Cika sunan kamfani, babban contact da nau’in kasuwanci kafin ci gaba.',
      integrationRequired: 'Zaɓi aƙalla service guda kuma ka bayyana integration da haruffa 10 ko fiye.',
      consent: 'Na tabbatar cewa bayanan da na bayar gaskiya ne, kuma na amince K-Tech Solutions ta tuntube ni game da API access da onboarding.',
      consentRequired: 'Da fatan za a tabbatar da amincewar application kafin submit.',
      back: 'Koma baya',
      next: 'Ci gaba',
      submit: 'Tura enterprise application',
      submitting: 'Ana tura application…'
    },
    notifications: {
      recent: 'Sanarwa na baya-bayan nan',
      empty: 'Babu sanarwa tukuna.'
    },
    auth: {
      login: 'Shiga',
      register: 'Yi rajista',
      businessName: 'Sunan kamfani',
      businessNamePlaceholder: 'misali Kindness Digital Branding',
      contactName: 'Sunan babban contact',
      contactNamePlaceholder: 'Cikakken sunan mai kula da asusun',
      companyRegistrationNumber: 'Lambar rajistar kamfani (na zaɓi)',
      companyRegistrationNumberPlaceholder: 'Lambar RC / BN',
      businessType: 'Nau’in kasuwanci',
      selectBusinessType: 'Zaɓi nau’in kasuwanci',
      otherBusinessType: 'Wani nau’i',
      website: 'Website na kamfani (na zaɓi)',
      expectedVolume: 'Adadin API requests na wata (na zaɓi)',
      environment: 'Yanayin integration',
      requestedServices: 'Services da kuke buƙata (na zaɓi)',
      requestedServicesPlaceholder: 'Raba da comma, misali NIN, BVN, IPE Clearance',
      useCase: 'Ta yaya za ku yi amfani da API?',
      useCasePlaceholder: 'Bayyana samfurinku, customers, da tsarin integration ɗinku.',
      technicalEmail: 'Email na technical contact (na zaɓi)',
      technicalPhone: 'Lambar technical contact (na zaɓi)',
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      phone: 'Lambar waya (na zaɓi)',
      phonePlaceholder: '08012345678',
      password: 'Password',
      passwordPlaceholderRegister: 'Aƙalla haruffa 8',
      loginCta: 'Shiga',
      registerCta: 'Ƙirƙiri asusun kamfani',
      registerNotice:
        'Wannan enterprise application zai taimaka mana mu fahimci kamfaninku da bukatun integration. Admin din K-Tech Solutions zai amince da asusun kafin ku iya ƙirƙirar live API key ko sarrafa transactions. Offer code da farashin rangwamenku za su bayyana a dashboard bayan rajista.',
      genericError: 'Wani abu ya faru. Da fatan za a sake gwadawa.'
    },
    enterpriseOffer: {
      title: 'Rangwamen enterprise naka na sirri',
      body: 'Wannan code yana nuna farashin da aka keɓe wa kamfaninku kawai. Ajiye shi tare da bayanan integration ɗinku.'
    },
    banner: {
      pendingTitle: 'Ana bitar rajistarku',
      pendingBody:
        'Za a fara duba kamfaninku kafin ku iya ƙirƙirar live API key ko fara sarrafa transactions. Za mu tuntube ku ta imel ({{email}}) idan an amince.',
      rejectedTitle: 'Ana buƙatar ƙarin bitar API application ɗinku',
      rejectedBody: 'Ba a amince da application ɗin a wannan lokacin ba. Duba notifications don review note ko tuntuɓi K-Tech Solutions don mataki na gaba.',
      suspendedTitle: 'An dakatar da wannan asusun',
      suspendedBody: 'Tuntuɓi K-Tech Solutions don ƙarin bayani game da wannan asusun.'
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
    quickLinks: {
      label: 'Sassan partner portal',
      overview: 'Overview',
      wallet: 'Wallet da keys',
      webhooks: 'Webhooks',
      activity: 'Ayyuka',
      transactions: 'Transactions',
      pricing: 'Farashi',
      documentation: 'Documentation'
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
      exactTransferFailed: 'An kasa ƙirƙirar Exact Transfer account',
      bvnIntro: 'Ana bayar da funding account ɗin da sunan mai kasuwancin, don haka ku shigar da BVN ɗinsa sau ɗaya. Ba mu adana cikakkiyar lambar ba.',
      bvnLabel: 'BVN na mai kasuwanci (lambobi 11)',
      bvnPrivacy: 'Ana adana lambobi 4 na ƙarshe kawai.'
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
      revokeFailed: 'An kasa soke key ɗin',
      rotateTitle: 'Sabunta key',
      rotatedNotice: 'An sabunta key. Ajiye sabon key yanzu; an soke tsohon key.',
      rotateFailed: 'An kasa sabunta key',
      keyLabel: 'Sunan key',
      active: 'aiki',
      revoked: 'an soke',
      activeCount: '{{count}} masu aiki'
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
      retryFailed: 'Dawo da tsofaffin updates',
      retryQueued: 'An saka tsofaffin updates {{count}} domin a aika.',
      retryNone: 'Babu tsohon transaction update da ke jiran aikawa.',
      retryFailedError: 'An kasa sake aika updates din',
      recentDeliveries: 'Webhooks na baya-bayan nan',
      refresh: 'Sake dubawa',
      noDeliveries: 'Babu webhook delivery tukuna.',
      historyFailed: 'An kasa loda jerin webhook deliveries',
      attempts: 'ƙoƙari {{count}}',
      retryOne: 'Sake gwadawa yanzu',
      deliveryRetried: 'An sake aika webhook ɗin cikin nasara.',
      deliveryRetryQueued: 'An saka webhook ɗin domin a sake aikawa.',
      healthTitle: 'Lafiyar webhook',
      last30Days: 'Bayanan isarwa na kwanaki 30 da suka wuce',
      delivered: 'An isar',
      failed: 'An kasa',
      pending: 'Ana jira',
      lastFailure: 'Isarwar da ta kasa ta ƙarshe',
      healthFailed: 'An kasa ɗaukar bayanan lafiyar webhook',
      configuredNotice: 'An saita webhook. Ajiye secret ɗin yanzu; ba za a sake nuna shi ba.'
    },
    pricing: {
      title: 'Farashin Sabis',
      subtitle:
        'Farashin wholesale - farashin data/airtime yana canzawa bisa plan, duba <code>GET /data/plans/:network</code> a documentation don ainihin farashi na yanzu.'
    },
    callsSummary: {
      title: 'Taƙaitawar API Calls',
      searchPlaceholder: 'Nemo reference, provider ref ko bayanin aiki',
      filters: 'Tacewa',
      allStatuses: 'Dukkan matsayi',
      allTypes: 'Dukkan services',
      from: 'Daga',
      to: 'Zuwa',
      exportCsv: 'Fitar da CSV',
      details: 'Cikakkun bayanai',
      detailTitle: 'Cikakken transaction',
      timeline: 'Timeline',
      close: 'Rufe',
      colReference: 'Reference',
      colType: 'Nau\'i',
      colAmount: 'Adadin kuɗi',
      colBalanceBefore: 'Balance kafin',
      colBalanceAfter: 'Balance bayan',
      colStatus: 'Matsayi',
      colDate: 'Kwanan wata',
      empty: 'Babu API call da aka samu.'
    },
    activity: {
      title: 'Cibiyar ayyuka',
      subtitle: 'Timeline guda na transactions, request updates, webhooks da ayyukan API key.',
      search: 'Nemo activity',
      all: 'Dukkan activity',
      transactions: 'Transactions',
      updates: 'Request updates',
      webhooks: 'Webhooks',
      apiKeys: 'API keys',
      refresh: 'Sake dubawa',
      empty: 'Babu activity da aka samu.'
    },
    language: {
      label: 'Harshe',
      en: 'Turanci',
      ha: 'Hausa'
    },
    docs: {
      pageTitle: 'API Documentation',
      pageSubtitle: 'K-Tech Solutions Partner Platform',
      intro:
        'Duk abin da kuke bukata don haɗa K-Tech Solutions cikin app ɗinku — data & airtime, NIN/BVN verification slips, wallet funding, da async identity services. Duk endpoints suna karɓar JSON kuma ana tantance su ta API key ɗinku.',
      keyNotice: 'Ba mu iya nuna live API key ɗinku a nan (ana ajiye shi a matsayin hash kaɗai, ba a taɓa ajiye shi a bayyane bayan an ƙirƙira shi ba) —',
      keyNoticeLink: 'je zuwa dashboard ɗinku',
      keyNoticeSuffix: 'don ƙirƙira/duba API keys ɗinku.',
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
