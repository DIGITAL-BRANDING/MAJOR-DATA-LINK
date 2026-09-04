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

Za a ba partner abubuwa uku bayan an amince da shi kuma an biya kuɗin fara
amfani/ya saka kuɗi a partner wallet:

| Abu | Ma'ana |
| --- | --- |
| `base_url` | Production URL, misali `https://api.yourdomain.com/api/v1` |
| `X-API-Key` | Sirrin key na wannan partner kawai |
| `webhook_secret` | Sirrin HMAC don tabbatar da webhook da aka aika masa |

Ana amfani da **HTTPS kawai**. Kar a sa API key a Flutter/web frontend ko a
public GitHub repository; a ajiye shi a server/environment variable na partner.

## Deployment da ƙirƙirar partner

Bayan deploy, a fara aiwatar da Prisma migration sannan a ƙirƙiri partner daga
backend directory:

```bash
npm run prisma:migrate:deploy
npm run partner:create -- "Sunan Kasuwanci" partner@example.com 50000
```

Command ɗin zai nuna API key **sau ɗaya kawai**. A ba partner key ɗin ta hanya
mai tsaro, kuma a saka opening balance a Naira a argument na uku (misali `50000`).
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
ya dawo `pending`, partner ya duba wannan endpoint ko ya jira webhook; kada ya
sake sayar da order ɗin da sabon idempotency key.

## Webhooks

Partner zai iya samar da HTTPS webhook URL. Major Data Link zai tura event
idan transaction da farko ya tsaya `pending` sannan aka tabbatar da sakamakonsa.

Headers:

```http
X-MDL-Event: transaction.updated
X-MDL-Signature: sha256=<HMAC-SHA256 raw request body>
```

Payload:

```json
{
  "event": "transaction.updated",
  "data": {
    "reference": "MDL-20260904-ABC123",
    "status": "success",
    "type": "data_purchase",
    "amount": 350,
    "message": "Transaction processed"
  }
}
```

Partner ya tabbatar da HMAC da `webhook_secret`, ya mayar da HTTP `200` cikin
seconds 10, kuma ya sarrafa event sau da yawa (idempotently). Kada a dogara da
webhook kaɗai; a rika iya kiran transaction status.

## Rate limits da operational rules

- Suggested limit: 60 requests/minute/partner; purchase endpoint 30/minute.
- A yi exponential backoff a 429/5xx: 1s, 2s, 4s, 8s (max 4 retries).
- A yi amfani da amount da plan ID daga latest plans response; kar a hard-code
  plan price.
- Phone/meter/smartcard da partner ya aiko na iya zama personal data. A yi
  amfani da HTTPS, a rage log, kuma a bi NDPA/ka'idojin sirri.
- Refund ba automatic bane ga duk `pending`; a tabbatar da status da reference
  kafin a yi reverse ko a sake kaya.

## Abubuwan da ake bukata kafin a wallafa wannan ga partners

Backend ɗin na yanzu yana da `/api` endpoints na **customer app**, masu amfani
da `Authorization: Bearer <user JWT>` da transaction PIN. Ba daidai ba ne a
sayar da waɗancan endpoints kai tsaye ga resellers. A aiwatar da waɗannan kafin
production partner launch:

1. Ƙirƙiri `Partner` da `PartnerApiKey` tables (key hash kawai, ba plain key).
2. Ƙirƙiri partner-auth middleware da `/api/v1` routes masu zaman kansu.
3. Yi partner wallet/ledger daban da user wallet; duk debit/refund ya zama
   atomic kuma idempotent.
4. Ƙara transaction lookup da `reference`, audit log, rate-limit per API key,
   key revoke/rotate, da optional IP allow-list.
5. Ƙara signed outbound webhooks, retry queue, sandbox keys, da partner portal
   don funding, usage, da API-key rotation.
6. Yi review na legal/compliance da agreement kafin fara caji ko sarrafa bayanan
   masu amfani.

## Support

Don samun API access, partner ya aiko da business name, technical contact,
production webhook URL (idan ana so), expected monthly volume, da IP addresses
(idan ana amfani da allow-list) zuwa: **[cika support email/WhatsApp]**.
