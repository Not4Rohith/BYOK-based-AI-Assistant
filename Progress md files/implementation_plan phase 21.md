# Implementation Plan - Phase 21: Secure Mobile Credential Storage (Android Keystore / iOS Keychain)

This plan details **Phase 21** of the **Personal AI Task Manager**, implementing encrypted secure credential storage for mobile devices per Section 8 of the architecture specification.

---

## Technical Approach & Credential Security Rules

Per Section 8 of the specification, **API keys and secrets belong strictly to the user**:

```
+-------------------------------------------------------------+
|                  MOBILE CREDENTIAL MODEL                    |
|                                                             |
|   Android Keystore                  iOS Keychain            |
|   (AES-256 Encrypted)             (Hardware Keychain)       |
|            \                               /                |
|             \                             /                 |
|              v                           v                  |
|          Secure Local Mobile Storage (No Plaintext DB)      |
|          - MongoDB Atlas Connection URI                     |
|          - BYOK AI Keys (OpenRouter, Gemini, Grok)          |
|          - Google OAuth Refresh Tokens                      |
+-------------------------------------------------------------+
```

### Strict Restrictions (Section 8)
- Never store API keys in MongoDB in plain text.
- Never commit credentials to Git repositories.
- Never expose API credentials in public frontend JavaScript bundles.

---

## Proposed Changes

### Mobile Secure Storage Module (`apps/mobile/src/services/`)
#### [NEW] [apps/mobile/src/services/secureStore.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/mobile/src/services/secureStore.ts)
- Hardware-backed mobile secure storage engine utilizing Android Keystore / iOS Keychain encryption wrappers for MongoDB URI, BYOK AI keys, and Google OAuth tokens.

#### [MODIFY] [apps/mobile/src/services/mobileStorage.ts](file:///home/rohith/Documents/AI%20Task%20Manager/apps/mobile/src/services/mobileStorage.ts)
- Connect `secureStore` to load and save encrypted user API keys and database connection strings locally on-device.

---

## Verification Plan

### Automated Tests
- Build backend: `npm run build:backend`
- Build frontend: `npm run build:desktop`

### Manual Verification
- Verify `secureStore.ts` encrypts API keys and MongoDB connection strings before saving to mobile storage.
- Confirm plain-text credentials are never written to MongoDB or log outputs.
