# Major Data Link Partner API

**Version:** 1.0 (commercial partner specification)  
**Currency:** NGN (Naira)  
**Format:** JSON over HTTPS

## Manufa

Wannan API ɗin na bai wa approved partners damar sayar da Data, Airtime,
Cable TV, da Electricity ta manhajarsu/website dinsu. Partner zai caje
abokin cinikinsa yadda ya ga dama, sannan a cire masa kuɗin wholesale daga
partner wallet dinsa a Major Data Link.

> **Muhimmi:** Kada a bai wa partner login na admin, API token na upstream
> provider, ko JWT/PIN na customer. Partner API sai an kare shi da **API key
> na partner**, IP allow-list (idan zai yiwu), da partner wallet daban.

## Production access

Za a ba partner `base_url` da `X-API-Key` bayan an amince da shi kuma an biya
kuɗin fara amfani/ya saka kuɗi a partner wallet. `webhook_secret` sai partner
ya saita webhook URL dinsa; secret ɗin yana bayyana sau ɗaya ne kawai.

| Abu | Ma'ana |
| --- | --- |
| `base_url` | Production URL, misali `https://api.yourdomain.com/api/v1` |
| `X-API-Key` | Sirrin key na wannan partner kawai |

Ana amfani da **HTTPS kawai**. Kar a sa API key a Flutter/web frontend ko a
public GitHub repository; a ajiye shi a server/environment variable na partner.

## Deployment da ƙirƙirar partner

Bayan deploy, a fara aiwatar da Prisma migration sannan a ƙirƙiri partner daga
backend directory:

```bash
npm run prisma:migrate:deploy
npm run partner:create -- "Sunan Kasuwanci" partner@example.com 50000 08012345678
```

Command ɗin zai nuna API key **sau ɗaya kawai**. A ba partner key ɗin ta hanya
mai tsaro, kuma a saka opening balance a Naira a argument na uku (misali `50000`).
Phone number na huɗu yana da muhimmanci idan partner zai sami permanent funding
account.
Idan key ya zube, a revoke shi a database/admin tooling sannan a ƙirƙiri sabo;
ba a ajiye plaintext key a database.

## Farashi da biyan kuɗi

Farashin data plans yana canzawa. Partner ya riƙa kiran `GET /data/plans` kafin
ya nuna farashi ko ya sayar da plan. `amount` da API ta dawo da shi shi ne
wholesale/partner debit price a Naira; partner zai iya ƙara ribarsa kafin ya
nuna retail price.

### Tsarin farashi da za a iya amfani da shi

Waɗannan **samfuran tiers ne**, ba lallai su zama final price ba. Owner ya
cika su kafin ya wallafa documentation ga partners.

| Tier | Kuɗin farawa | Minimum wallet float | Amfani |
| --- | ---: | ---: | --- |
| Starter | ₦[Cika] | ₦[Cika] | Ƙaramin reseller/app |
| Business | ₦[Cika] | ₦[Cika] | Yawan transactions, webhook |
| Enterprise | A tattauna | A tattauna | Custom limits, support, IP allow-list |

Za a iya cajin partner ta hanyoyi uku: one-time onboarding fee, monthly API
access fee, ko margin da ke cikin wholesale price. A bayyana wanda aka zaɓa a
contract/invoice; kar a ɓoye fee bayan transaction.

## Authentication

Kowane request na partner API yana buƙatar headers masu zuwa:

```http
X-API-Key: mdl_live_your_secret_key
Content-Type: application/json
Accept: application/json
Idempotency-Key: unique-request-id
```

- `X-API-Key` wajibi ne ga duk endpoint sai health check.
- `Idempotency-Key` wajibi ne ga duk purchase request. Idan partner ya sake
  tura request iri ɗaya saboda timeout, ba za a cire wallet sau biyu ba.
- A samar da key ɗaya ga production, wani daban ga sandbox. Idan key ya zube,
  a revoke/rotate shi nan da nan.

## Response format

Success:

```json
{
  "status": true,
  "message": "Transaction processed",
  "data": {
    "reference": "MDL-20260904-ABC123",
    "balance_after": 12500
  }
}
```

Failure:

```json
{
  "status": false,
  "message": "Insufficient partner wallet balance",
  "code": "INSUFFICIENT_BALANCE"
}
```

## HTTP status codes

| Code | Ma'ana | Abin da partner zai yi |
| --- | --- | --- |
| 200 / 201 | An karɓa/an gama | Duba `status` a response |
| 400 | Request ba daidai ba | Gyara request |
| 401 | API key babu ko ba daidai ba | Duba/rotate key |
| 403 | Partner ba shi da damar service | Tuntuɓi support |
| 409 | An sake amfani da reference/key ba daidai ba | Yi amfani da sabon unique key |
| 422 | Fields ba su cika ka'ida ba | Duba validation details |
| 429 | An wuce rate limit | Jira sannan a retry da exponential backoff |
| 500 / 502 / 503 | Matsalar sabar/provider | Kada a ƙirƙiri sabon purchase; bincika status da reference |

## Endpoints

### Ayyukan da suke live a v1

Wannan release ta kunna **wallet balance, data plans/data purchase, airtime
purchase, NIN/BVN slip verification, da transaction lookup**. Cable TV, electricity, da webhooks suna
cikin wannan commercial specification amma ba a kunna su a `/api/v1` ba tukuna;
kar a tallata su ga partner sai an fitar da su.

### 1. Health check

`GET /health`

Ana amfani da shi don sanin ko service tana aiki.

```json
{ "status": true, "service": "major-data-link-partner-api" }
```

### 2. Partner wallet balance

`GET /wallet/balance`

```json
{
  "status": true,
  "data": { "balance": 25000, "currency": "NGN" }
}
```

### 2a. Partner wallet funding

`GET /wallet/balance` kuma yana iya dawo da permanent partner funding account:

```json
{
  "status": true,
  "data": {
    "balance": 25000,
    "currency": "NGN",
    "virtual_account_number": "0123456789",
    "virtual_account_bank": "PalmPay"
  }
}
```

Idan `virtual_account_number` babu, partner zai iya kiran:

`POST /wallet/funding-account`

Wannan yana ƙirƙirar permanent virtual account idan payment gateway ta yarda
da partner profile. Ana buƙatar phone number a partner profile.

Idan permanent account bai samu ba saboda KYC/gateway policy, yi amfani da
Exact Transfer:

`POST /wallet/fund/dynamic`

```json
{ "amount": 50000 }
```

Response zai ba da temporary account number, reference, da expiry. Partner zai
biya exact amount, sannan zai iya duba transaction da `POST /wallet/fund/verify`
da `{ "reference": "..." }`.

### 3. Data networks/plans

`GET /data/plans/{network}`

`network` misali: `MTN`, `GLO`, `AIRTEL`, ko `9MOBILE` (a yi amfani da exact
value da service ta bayar).

Optional query: `?category=SME`

```json
{
  "status": true,
  "data": [
    {
      "id": "plan-id-from-api",
      "name": "1GB SME",
      "amount": 350,
      "validity": "30 days"
    }
  ]
}
```

### 4. Buy data

`POST /data/purchase`

```json
{
  "network": "MTN",
  "plan_id": "plan-id-from-api",
  "phone": "08012345678"
}
```

```bash
curl -X POST "$BASE_URL/data/purchase" \
  -H "X-API-Key: $MDL_API_KEY" \
  -H "Idempotency-Key: 7c22f0d2-unique-per-order" \
  -H "Content-Type: application/json" \
  -d '{"network":"MTN","plan_id":"plan-id-from-api","phone":"08012345678"}'
```

### 5. Buy airtime

`POST /airtime/purchase`

```json
{
  "network": "AIRTEL",
  "phone": "08012345678",
  "amount": 100
}
```

### 5a. NIN/BVN verification

**Farashi:** `GET /verification/prices` — a kira wannan kafin request saboda
farashi da availability na iya canzawa.

**NIN Slip by NIN:** `POST /verification/nin/by-nin`

```json
{ "nin": "12345678901", "tier": "premium" }
```

**NIN Slip by phone:** `POST /verification/nin/by-phone`

```json
{ "phone": "08012345678", "tier": "standard" }
```

**NIN Slip by demographic:** `POST /verification/nin/by-demographic`

```json
{ "firstname": "Amina", "lastname": "Usman", "dob": "1996-05-18", "gender": "FEMALE" }
```

**BVN Slip:** `POST /verification/bvn/slip`

```json
{ "bvn": "12345678901", "tier": "premium" }
```

Kowane verification request yana buƙatar `Idempotency-Key`. Response na iya
ƙunsar `user_data`, `pdf_base64`, ko `pdf_url`; waɗannan bayanai ne masu
matuƙar sirri. Partner ya adana su ne kawai idan yana da doka/consent, kada ya
rubuta su a application logs, kuma ya mayar da response da `Cache-Control: no-store`.

### 5b. Async NIN services

Waɗannan services suna mayar da `202 Accepted` tare da `ticket_id`. Partner ya
riƙa poll status endpoint da ticket ɗin; kada ya sake submit da sabon
`Idempotency-Key` yayin da `status` yake `pending`.

| Service | Submit | Status |
| --- | --- | --- |
| NIN Validation | `POST /verification/nin/validation` | `GET /verification/nin/validation/{ticket_id}` |
| NIN IPE Clearance | `POST /verification/nin/ipe-clearance` | `GET /verification/nin/ipe-clearance/{ticket_id}` |
| NIN Personalization | `POST /verification/nin/personalization` | `GET /verification/nin/personalization/{ticket_id}` |

NIN Validation body:

```json
{ "nin": "12345678901", "validation_type": "nin_validation" }
```

`validation_type` zai iya zama: `nin_validation`, `no_record`, `sim`,
`bank_validation`, `update_records`, `modification`, `photo_error`, ko
`v.nin_validation`.

IPE Clearance ko Personalization body:

```json
{ "tracking_id": "your-tracking-id" }
```

### 6. Cable TV *(planned)*

**Plans:** `GET /cable/plans/{provider}`

**Validate smartcard:** `POST /cable/validate`

```json
{ "provider": "DSTV", "smartcard_number": "1234567890" }
```

**Subscribe:** `POST /cable/subscribe`

```json
{
  "provider": "DSTV",
  "smartcard_number": "1234567890",
  "plan_id": "plan-id-from-api"
}
```

### 7. Electricity *(planned)*

**Discos:** `GET /electricity/providers`

**Validate meter:** `POST /electricity/validate`

```json
{
  "disco": "IKEDC",
  "meter_number": "12345678901",
  "meter_type": "prepaid"
}
```

**Buy electricity:** `POST /electricity/purchase`

```json
{
  "disco": "IKEDC",
  "meter_number": "12345678901",
  "meter_type": "prepaid",
  "amount": 1000
}
```

Response na successful prepaid purchase zai iya ƙunsar `token` da `units`:

```json
{
  "status": true,
  "message": "Electricity token sent",
  "data": {
    "reference": "MDL-20260904-ABC123",
    "balance_after": 24000,
    "token": "1234-5678-9012-3456-7890",
    "units": "12.5"
  }
}
```

### 8. Transaction status

`GET /transactions/{reference}`

```json
{
  "status": true,
  "data": {
    "reference": "MDL-20260904-ABC123",
    "type": "data_purchase",
    "status": "success",
    "amount": 350,
    "created_at": "2026-09-04T10:30:00.000Z"
  }
}
```

`status` zai zama `pending`, `success`, `failed`, ko `reversed`. Idan purchase
ya dawo `pending`, partner ya duba wannan endpoint; backend kuma yana reconcile
pending NIN Validation/IPE/Personalization tickets a background kuma zai aika
webhook da zarar upstream ta ba terminal result. Kada ya sake sayar da order
ɗin da sabon idempotency key.

## Webhooks

Webhooks suna aiki ne bayan partner ya saita public HTTPS callback URL. Major
Data Link yana ajiye event a durable delivery queue kafin ya aika shi; don haka
restart ko temporary network failure ba zai ɓatar da event ba.

### Saita webhook

`POST /webhook`

```json
{ "webhook_url": "https://partner.example.com/webhooks/major-data-link" }
```

Response zai ƙunshi `webhook_secret` sau ɗaya kawai. A ajiye shi a server
environment variable. Sake kiran endpoint ɗin yana rotate secret; queued old
deliveries za su ci gaba da amfani da old secret snapshot har su gama retry.

`GET /webhook` yana nuna URL da ko webhook an saita (`configured`), amma ba ya
taɓa mayar da secret.

Don gwaji: `POST /webhook/test`. Don delivery history: `GET /webhook/deliveries`.

URL dole ne HTTPS kuma ya nuna public internet host; localhost, private IP,
credentials a URL, da URL fragment ba a amince da su ba.

### Event da signature

Ana aika `transaction.updated` ga kowane terminal partner ledger transaction
(`success` ko `reversed`), ciki har da purchase da wallet funding. Ba a aika
NIN/BVN/PDF ko sauran PII a webhook payload ba; a samu irin bayanan ta secure
API request ɗin partner idan doka/consent ta bada dama.

Headers:

```http
X-MDL-Event: transaction.updated
X-MDL-Event-ID: 018f...
X-MDL-Timestamp: 1767600000
X-MDL-Signature: sha256=<HMAC-SHA256("<timestamp>.<raw request body>")>
```

Payload:

```json
{
  "id": "018f...",
  "event": "transaction.updated",
  "created_at": "2026-09-05T10:30:00.000Z",
  "data": {
    "reference": "MDL-20260904-ABC123",
    "status": "success",
    "type": "data_purchase",
    "amount": 350,
      "balance_after": 12150,
      "provider": "techhub"
  }
}
```

Partner ya tabbatar da HMAC-SHA256 da `webhook_secret` a kan **raw bytes** na
body tare da timestamp (`timestamp + '.' + rawBody`). Ya ƙi stale timestamp
(misali fiye da minti 5), ya deduplicate da `X-MDL-Event-ID`/payload `id`, kuma
ya mayar da HTTP 2xx cikin seconds 10. Duk non-2xx ko timeout ana retry sau 8:
1, 2, 4, 8, 16, 32, sannan 60 minutes. Delivery semantics **at-least-once** ne,
don haka partner ya zama idempotent. Status API shi ne source of truth idan
delivery ta gaza.

## Rate limits da operational rules

- Suggested limit: 60 requests/minute/partner; purchase endpoint 30/minute.
- Webhook retry ana sarrafa shi da backend: 1, 2, 4, 8, 16, 32, 60 minutes;
  max attempts 8. Partner zai maida 2xx bayan ya queue event a nasa side.
- A yi amfani da amount da plan ID daga latest plans response; kar a hard-code
  plan price.
- Phone/meter/smartcard da partner ya aiko na iya zama personal data. A yi
  amfani da HTTPS, a rage log, kuma a bi NDPA/ka'idojin sirri.
- Refund ba automatic bane ga duk `pending`; a tabbatar da status da reference
  kafin a yi reverse ko a sake kaya.

## Abubuwan da ke bukatar ƙarin planning kafin a faɗaɗa API

Backend ɗin na yanzu yana da `/api` endpoints na **customer app**, masu amfani
da `Authorization: Bearer <user JWT>` da transaction PIN. Ba daidai ba ne a
sayar da waɗancan endpoints kai tsaye ga resellers. A aiwatar da waɗannan kafin
production partner launch:

An riga an gina partner/auth, partner wallet/ledger, rate limits, status lookup,
partner portal, da signed outbound webhook queue. Abubuwan da suka rage kafin
faɗaɗa commercial program sun haɗa da sandbox environment daban, optional IP
allow-list, da review na legal/compliance/agreement kafin fara caji ko sarrafa bayanan
masu amfani.

## Support

Don samun API access, partner ya aiko da business name, technical contact,
production webhook URL (idan ana so), expected monthly volume, da IP addresses
(idan ana amfani da allow-list) zuwa: **[cika support email/WhatsApp]**.
