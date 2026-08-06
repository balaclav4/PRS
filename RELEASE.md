# Release checklist

State as of the last commit. Items are marked done only where they have actually
been verified, not merely written.

## Blocking

- [ ] **Run on real hardware.** Nothing in this app has ever executed outside
      react-native-web. `expo-sqlite`, `expo-camera`, `expo-image-picker`,
      `expo-haptics` and the AsyncStorage auth persistence have never run once.
      The SQLite path in particular is guarded only by a schema linter, and photo
      capture depends on native EXIF handling that the web canvas path does not
      exercise. Build a development client and work through capture, load dev,
      ballistics and sign-in on a device before anything else here matters.

- [ ] **Verify account deletion with a throwaway account.** The code
      reauthenticates and calls `deleteUser`, and the prompt is verified, but the
      destructive call is not — confirming it means deleting a real account.
      Create one via "Create an account", delete it, confirm it is gone from the
      Firebase console. App Review will do exactly this.

- [ ] **Delete Firestore data on account deletion.** Deletion currently removes
      the auth record but not the documents under `users/{uid}`. Firestore has no
      client-side recursive delete, so this needs a Cloud Function. Required for
      GDPR, and a partial client-side sweep would silently miss subcollections.

- [ ] **Privacy policy URL.** Required by App Store Connect, and the app collects
      email addresses through authentication. Drafts are in `docs/PRIVACY.md` and
      `docs/TERMS.md` — they need a lawyer's review, six placeholders filled
      (company name, address, jurisdiction, two contact emails, dates) and
      hosting at a public URL.

- [ ] **Training Data Contribution is documented but not built.** Both documents
      describe an opt-in that does not exist yet. Either build it — Settings
      toggle, default off, consent recorded with a timestamp and policy version —
      or remove those sections before publishing. Describing a control the user
      cannot find is worse than not offering it.

- [ ] **EAS secrets.** `.env.local` is gitignored and is not available to cloud
      builds, so the six `EXPO_PUBLIC_FIREBASE_*` values must be registered with
      EAS or builds will ship unconfigured and run local-only:

      eas secret:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value <value>

      (repeat for AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID,
      APP_ID). They are inlined into the bundle in plain text by design — a
      Firebase web key identifies a project and is not a credential. Firestore
      rules are the access control.

- [ ] **Firestore rules** need `loaddev` and `dopecards`, which the mobile app
      has and the web app does not. A recursive wildcard covers both and anything
      added later:

      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      Separately, `training-data` is a root-level collection the web app reads and
      writes but no rule matches, so it is currently denied for everyone.

- [ ] **Apple privacy nutrition labels** in App Store Connect. What is collected:
      email address, linked to identity, for account management. Nothing else
      leaves the device — target photos are never stored, and no analytics or
      tracking SDK is present.

## Done

- [x] `expo-doctor` passes 20/20.
- [x] Bundle identifiers, versions and build numbers set for both platforms.
- [x] Camera and photo library usage descriptions written for iOS and Android.
- [x] Icons, adaptive icons and splash screen configured.
- [x] `eas.json` with development, preview and production profiles.
- [x] `npm test` — 23 checks: a syntax gate, a schema gate and 21 harnesses.

## Not blocking

- Cloud sync is unwired. The reconciliation engine is built and tested; nothing
  writes to Firestore yet. The app is honest about this — Account says data stays
  on the device.
- The bullet-hole detector has a known gap on splatter targets (Shoot-N-C, Dirty
  Bird), recorded in `scripts/test-detect.mjs` rather than papered over. It needs
  real photographs of that target type to fix responsibly.
- Theme and unit preferences are per-device. They will follow the account once
  sync lands.

## Exempt

- **Sign in with Apple** is not required. It applies only to apps offering
  third-party or social login; this app is email/password only.
