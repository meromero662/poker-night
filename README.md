# PotSplit

**A shared poker-night ledger for buy-ins, cashouts, and settlements.**

[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Android-245b46)](#platforms)
[![Firebase](https://img.shields.io/badge/backend-Firebase-ffca28)](#technology-stack)
[![Capacitor](https://img.shields.io/badge/mobile-Capacitor-119eff)](#android-development)

PotSplit helps a poker group track money during a session and calculate who should pay whom at the end. It combines a lightweight web interface with Firebase-backed group collaboration and an Android wrapper.

**Live web app:** https://poker-night-22bd4.web.app/

> **Project status:** Actively developed. The `mobile-app` branch contains the documented web and Android source. Review the deployment configuration and verify the target branch before publishing.

## Features

- **Buy-in tracking** — record multiple buy-ins for each player.
- **Cashout tracking** — enter each player's final cashout.
- **Settlement calculation** — calculate net balances and suggested payments.
- **Shared poker groups** — create or join a group using an invitation code.
- **Google sign-in** — authenticate for access to shared data.
- **Bank-managed sessions** — group ownership controls session changes.
- **Real-time synchronization** — view Firestore-backed updates across devices.
- **Game archive** — retain previous sessions and review historical settlements.
- **Mobile-friendly interface** — responsive layout with Android support through Capacitor.

## How it works

1. **Sign in** with Google.
2. **Create a group** or **join an existing group** with its code.
3. **Record buy-ins** as players add money to the pot.
4. **Enter cashouts** when the session ends.
5. **Open Settle** to see player balances and suggested transfers.
6. **Archive or reset** the session when appropriate.

In shared groups, the **Bank** is the group owner. Firestore security rules allow group members to read shared session data, while restricting writes to the Bank. Do not assume that a visible UI control grants database permission: Firestore rules are authoritative.

## Platforms

| Platform | Implementation |
| --- | --- |
| Web | HTML, CSS, and vanilla JavaScript |
| Android | Capacitor wrapping the web application |
| Authentication | Firebase Authentication with Google sign-in |
| Database | Cloud Firestore |
| Web hosting | Firebase Hosting |

The Android application ID is `com.mero.pokernight`. The Capacitor configuration sets `webDir` to `www` and configures the Firebase Authentication plugin with Google as a provider and `skipNativeAuth: true`.

## Technology stack

- **Frontend:** HTML5, CSS, JavaScript (no frontend framework)
- **Firebase JS SDK:** Firebase compat scripts used by the web interface
- **Backend services:** Firebase Authentication and Cloud Firestore
- **Android bridge:** Capacitor 8 and `@capacitor-firebase/authentication`
- **Build tooling:** Node.js/npm, Capacitor CLI, Android Studio/Gradle
- **Access control:** Firestore rules in `firestore.rules`

Dependency versions and supported SDK levels are defined in `package.json` and the Android Gradle configuration; refer to those files rather than treating this README as a version lock.

## Project structure

```text
poker-night/
├── index.html                 # Root copy of the web application
├── www/
│   └── index.html             # Capacitor web assets
├── firestore.rules            # Firestore access-control rules
├── firebase.json              # Firebase Hosting and Firestore configuration
├── .firebaserc                # Default Firebase project
├── capacitor.config.json      # Capacitor application and plugin settings
├── package.json               # JavaScript dependencies
└── android/                   # Native Android project
```

The web interface currently keeps its HTML, CSS, and JavaScript together in `index.html`. Both HTML copies are maintained in the repository. **When changing the app, keep `index.html` and `www/index.html` synchronized** until the project deliberately adopts a single source-of-truth/build process.

## Getting started

### Prerequisites

Install:

- Git
- A supported Node.js LTS release and npm
- Firebase CLI for hosting or rules deployment
- Android Studio and an appropriate Android SDK/JDK for Android builds

Firebase access is required for deployment. Google authentication also requires the relevant Firebase/Google provider configuration.

### Clone and install

```bash
git clone https://github.com/meromero662/poker-night.git
cd poker-night
git switch mobile-app
npm install
```

> `npm test` is **not currently a working test suite**: the repository's `package.json` contains a placeholder test script. Do not treat it as a passing validation command.

### Run the web app locally

The app uses Firebase services and browser authentication. Serve the project with a local HTTP server instead of relying on `file://` URLs:

```bash
npx serve .
```

Open the localhost URL printed by the server. If Google sign-in is required, the local domain must be authorized in Firebase Authentication. Some authentication and native-plugin behavior differs between a desktop browser and Android.

### Firebase configuration

The repository's `.firebaserc` identifies the Firebase project as `poker-night-22bd4`.

The checked-in `firebase.json` currently has:

```json
{
  "hosting": {
    "public": "."
  }
}
```

**Important deployment distinction:** Capacitor's `webDir` is `www`, but the checked-in Hosting public directory is currently `.`. A local working copy may have different Hosting settings. Before deploying, inspect `firebase.json`, confirm which `index.html` is intended to be served, and ensure temporary files, backups, and sensitive files cannot be published. Do not change the Hosting directory without checking the full deployment implications.

Deploy Hosting **only after reviewing the target project and public directory**:

```bash
firebase login
firebase use poker-night-22bd4
firebase deploy --only hosting
```

Deploying Firestore rules is a **separate security-sensitive operation**:

```bash
firebase deploy --only firestore:rules
```

Review and test rules before publishing them; a Hosting deployment does not require redeploying rules.

## Android development

The Android project is managed by Capacitor and lives in `android/`.

After making and validating changes to `www/index.html`:

```bash
npx cap sync android
npx cap open android
```

Use Android Studio to build and test the app. For release distribution, use an appropriately configured **signed release build** and preserve the existing signing identity. Never commit signing keystores, passwords, service-account credentials, or local signing configuration.

**Android sign-in:** The Firebase Authentication plugin is configured for Google authentication. Native Google sign-in requires correct Firebase project registration, signing certificate fingerprints, and Android configuration. Validate it on a device or emulator; browser sign-in alone does not verify the native flow.

## Data and security model

The checked-in Firestore rules define these access boundaries:

| Collection or path | Access summary |
| --- | --- |
| `users/{userId}/...` | Only the authenticated owner may read/write |
| `groupCodes/{code}` | Authenticated users may get a code; listing and changes to existing codes are denied |
| `groups/{groupId}` | The Bank controls group creation and updates; the Bank and members may read |
| `groups/{groupId}/members/{userId}` | Membership creation is validated against required fields and the group's invitation code; the Bank manages existing members |
| Other documents under a group | Bank and members may read; only the Bank may write |

This is a summary, not a replacement for `firestore.rules`. **Always review the actual rules** when changing group membership, archives, session storage, or permissions.

Firebase web configuration values are client-facing identifiers, **not** substitutes for Firestore security rules. Never place admin credentials or private service-account keys in the frontend.

## Development guidelines

1. **Work on a feature branch.** Keep `mobile-app` stable and review changes before merging.
2. **Protect financial calculations.** Changes to buy-ins, cashouts, rounding, or settlement logic require deliberate test cases.
3. **Preserve authorization boundaries.** Do not relax Firestore rules to work around client errors.
4. **Keep both HTML copies in sync.** Confirm that the intended web and Android versions match.
5. **Prefer small, reviewable changes.** Add short comments that explain purpose or non-obvious behavior.
6. **Validate web and Android separately.** Firebase Hosting and a signed APK are distinct release artifacts.
7. **Avoid committing secrets or generated artifacts.** Check the diff before pushing.

### Suggested manual regression checklist

- Sign in and sign out.
- Create a group and join it from a second account.
- Confirm a non-Bank member can view but cannot modify shared session data.
- Add and edit buy-ins; verify the pot total.
- Enter cashouts and check that settlements balance.
- Archive a game and review its historical results.
- Reset a session only after confirming the selected action.
- Remove a group member and verify access is revoked.
- Verify updates appear across two devices.
- Test Google sign-in on Android before distributing an APK.

Automated regression coverage should be added over time. In particular, settlement edge cases and Firestore authorization rules merit dedicated tests.

## Deployment and release checklist

Before any release:

- Confirm the Git branch and check for uncommitted local changes.
- Review the diff, especially `firebase.json` and `firestore.rules`.
- Verify `index.html` and `www/index.html` are consistent.
- Test buy-ins, cashouts, settlement calculations, and permissions.
- Verify the Firebase project and Hosting public directory.
- For Android, sync web assets, test native sign-in, and build with the correct signing key.
- Deploy only the intended Firebase resources.
- Smoke-test the live web app or installed Android build.

## Troubleshooting

**Changes appear on Android but not on the website**  
Check which directory Firebase Hosting publishes and whether the updated files were deployed.

**Changes appear on the website but not in the Android app**  
Run `npx cap sync android`, rebuild, and install the updated Android build.

**Google sign-in fails**  
Verify the Firebase Authentication provider, authorized web domains, Android application registration, and signing fingerprints.

**Permission denied in Firestore**  
Check the signed-in user, current group membership, Bank ownership, and `firestore.rules`. Do not weaken the rules as a quick fix.

**The local Git branch is behind GitHub**  
Run `git status` before pulling or switching branches. Preserve local edits and backups rather than overwriting them.

## Contributing

Improvements are welcome through focused pull requests. Describe the user-visible change, note any Firebase/Android impact, and include the manual or automated checks performed. Avoid unrelated formatting or refactoring in security-sensitive changes.

## License

The package manifest currently declares `ISC`, but a standalone license file has not been verified here. Confirm the repository's licensing terms before redistribution or external contribution.

---

**PotSplit** — keep the poker night about the game, not the math.
