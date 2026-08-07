# MAJOR DATA-LINK - Play Store Listing Kit

## 1. App Title (30 characters max)

Recommended:

```text
MAJOR DATA-LINK
```

Alternative with keywords, still under 30 characters:

```text
MAJOR DATA-LINK - Data & Bills
```

## 2. Short Description (80 characters max)

```text
Buy data, airtime, pay bills and fund your wallet fast and securely.
```

## 3. Full Description (4000 characters max)

```text
MAJOR DATA-LINK is an all-in-one wallet app for buying data, airtime, bill payments, result checker PINs, recharge cards, data cards and other VTU services in Nigeria.

FUND YOUR WALLET
Fund your wallet through supported payment channels and get transaction updates when your payment is confirmed.

DATA AND AIRTIME
Buy data and airtime for MTN, Airtel, Glo and 9mobile. Select available plans, view prices and validity, then complete purchases directly from your wallet.

BILLS PAYMENT
Pay supported cable TV and electricity bills from one simple app.

RESULT CHECKER AND EDUCATION SERVICES
Purchase WAEC and NECO result checker PINs and supported education service tokens where available.

RECHARGE AND DATA CARDS
Access recharge card and data card services for personal use, resellers and small businesses.

REFERRALS AND NOTIFICATIONS
Invite others, track transactions and receive important account, wallet and service notifications.

SECURITY
MAJOR DATA-LINK supports password login, transaction PIN, optional biometric login, 6-digit login PIN and BVN-based KYC where required. KYC is handled through BVN and bank account verification only. No selfie or camera capture is required.

SUPPORT
Contact support from inside the app by email or WhatsApp whenever you need help with wallet funding, purchases, failed transactions or account issues.

MAJOR DATA-LINK helps you manage everyday data, airtime, bills and wallet transactions from one secure mobile app.
```

## 4. Category And Tags

Category: Finance

Suggested tags and keywords: data, airtime, VTU, bills, wallet, MTN, Airtel, Glo, 9mobile, DStv, GOtv, electricity, WAEC, NECO, recharge card, data card.

## 5. Graphics And Screenshots

Required/recommended assets prepared in `play_store_assets`:

- Feature graphic: `feature_graphic_1024x500.png`
- Phone screenshots: 8 PNG files, 1080x1920 portrait
- Alt text file: `ALT_TEXT.md`

Google Play requirements to remember:

- Feature graphic: 1024 x 500, JPEG or 24-bit PNG, no alpha.
- Screenshots: minimum 2, maximum 8 per device type.
- Screenshot minimum dimension: 320 px, maximum dimension: 3840 px.
- For better Play promotion eligibility, use at least 4 phone screenshots at 1080 x 1920 portrait.

## 6. Content Rating Questionnaire

Recommended answers based on current app behavior:

| Question | Answer |
|---|---|
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Drugs, alcohol, tobacco references | No |
| Simulated gambling | No |
| Real-money purchases of goods/services | Yes - data, airtime, bills and wallet-based VTU services |
| Shares user location | No |
| Public user-to-user communication | No |

Expected rating should be a low general audience rating, subject to Google/IARC review.

## 7. Target Audience

Primary audience: 18+

Reason: the app handles wallet transactions, payment records and BVN-based KYC. Select that the app is not designed for children.

## 8. Data Safety Form

Does the app collect or share user data? Yes.

### Personal Info

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Name | Yes | No | Account management, app functionality |
| Email address | Yes | No | Account creation, login, support |
| Phone number | Yes | No | Account management, transactions, support |
| User IDs | Yes | No | Account management |
| Address | No | No | Not collected |

### Financial Info

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| User payment info | Yes | Yes, with payment processor where needed | Wallet funding and payment processing |
| Purchase history | Yes | No | Transaction history and support |
| Other financial info | Yes, BVN/bank verification details where required | Yes, with verification/payment provider where needed | KYC, fraud prevention, wallet security |

Important note: the app should not store full BVN. It should only submit it for verification and store the safe verification status or last digits where required.

### Photos Or Videos

Not collected for KYC. No selfie capture is required. If profile image upload is fully removed, answer Photos/Videos as not collected. If any profile image picker/upload still exists in your final build, answer Photos as collected for account personalization.

### App Activity

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| App interactions | Yes | No | App functionality, transaction records, notifications |

### Device Or Other IDs

| Data type | Collected | Shared | Purpose |
|---|---|---|---|
| Device or other IDs | Yes, FCM token | Yes, with Firebase/Google for push notifications | Push notification delivery |

### Location

Not collected.

### Standard Follow-up Answers

- Data encrypted in transit: Yes, app uses HTTPS API endpoints.
- Data deletion request available: Yes, if the account deactivation/delete flow is working in the app.
- Data collection required or optional: account data is required; some security/KYC data is required for wallet limits or compliance.
- Data processed ephemerally: No, most account and transaction data is stored for app functionality, accounting, fraud prevention and support.

## 9. Financial Services Declaration

Suggested wording:

```text
MAJOR DATA-LINK provides wallet-based VTU, data, airtime and bill payment services. The app does not provide loans, credit, investment products, insurance, cryptocurrency services or gambling. Payment processing and verification may be handled by supported licensed third-party providers such as Paystack and telecom/VTU service providers.
```

If asked whether the app provides loans or credit: No.

## 10. Play Console Contact Details

Support email:

```text
abdulmhassan02@gmail.com
```

Additional support email:

```text
imam.datasub21@gmail.com
```

Support WhatsApp/phone:

```text
+234 803 567 9448
```

Admin WhatsApp:

```text
+234 706 769 3590
```

Privacy Policy URL:

```text
https://imamdatasubweb-production-4f62.up.railway.app/privacy-policy
```

Terms URL:

```text
https://imamdatasubweb-production-4f62.up.railway.app/terms
```

## 11. Final Checklist Before Submission

- [ ] Upload app icon: 512 x 512 PNG with alpha, max 1024 KB.
- [ ] Upload feature graphic: 1024 x 500 PNG/JPEG, no alpha.
- [ ] Upload at least 4 phone screenshots, ideally all 8 prepared screenshots.
- [ ] Add privacy policy URL in Play Console.
- [ ] Confirm the same privacy policy link is available inside the app.
- [ ] Complete Data Safety form honestly based on the final APK/AAB permissions and behavior.
- [ ] Complete Content Rating questionnaire.
- [ ] Complete Financial Services declaration.
- [ ] Confirm account deletion/deactivation works if you declare data deletion support.
- [ ] Use a release AAB signed with your upload key for production.

