# OS-level Push Notifications (FCM) — Setup

The app sends OS-level push notifications to the iOS and Android apps when a
table is assigned to a player's match, using **Firebase Cloud Messaging
(FCM)**. The code is implemented; the steps below are the one-time setup that
requires accounts/credentials.

Until the server env vars are set, push is a safe no-op — the web app still
shows in-app/realtime toasts via Pusher.

## How it works

- **Server** ([netlify/functions/utils/push.js](netlify/functions/utils/push.js))
  stores device tokens (`pushTokens` collection) and sends via FCM HTTP v1.
  Wired into the table-assignment flow in
  [liveScoreHandlers.js](netlify/functions/utils/liveScoreHandlers.js).
- **Client** ([src/utils/push.ts](src/utils/push.ts)) registers the device
  with FCM via `cordova-plugin-firebasex-messaging` and syncs the token to the server
  (`registerPushToken`). Foreground messages show an in-app toast; background
  messages are delivered by the OS.
- **Web** browsers keep using Pusher + the Web Notifications API (no FCM).

## 1. Create a Firebase project

1. <https://console.firebase.google.com> → Add project (can reuse one).
2. Add an **Android app**: package name **`ca.vttc.app`** (matches
   `apk/config.xml`). Download **`google-services.json`** → place at
   **`apk/google-services.json`**.
3. Add an **iOS app**: bundle id **`com.lynqu.vttclive`** (matches
   `ios/config.xml`). Download **`GoogleService-Info.plist`** → place at
   **`ios/GoogleService-Info.plist`**.

## 2. iOS — APNs auth key (required for iOS push)

1. Apple Developer → Certificates, IDs & Profiles → **Keys** → create a key
   with **Apple Push Notifications service (APNs)** enabled. Download the
   `.p8` and note the **Key ID** and your **Team ID** (`4LM22ZM9VZ`).
2. Firebase Console → Project Settings → **Cloud Messaging** → **Apple app
   configuration** → upload the `.p8` with the Key ID + Team ID.
3. The App ID `com.lynqu.vttclive` must have the **Push Notifications**
   capability enabled (Apple Developer portal). `cordova-plugin-firebasex-messaging`
   adds the entitlement; the build uses `-allowProvisioningUpdates` so Xcode
   can register it. (Push is **not** available on the iOS Simulator — test on
   a real device.)

## 3. Server credentials (env)

Firebase Console → Project Settings → **Service accounts** → **Generate new
private key** (downloads a JSON). From it, set these env vars (locally in
`.env`, and on Netlify under Site settings → Environment variables):

```
FCM_PROJECT_ID   = <project_id>
FCM_CLIENT_EMAIL = <client_email>
FCM_PRIVATE_KEY  = "<private_key with literal \n for newlines>"
```

## 4. Install the plugin into the native projects

The plugin is declared in `apk/config.xml` and `ios/config.xml`. Install it
into the already-added platforms (or it restores automatically on a fresh
`*:prepare`):

```
cd apk && npx cordova plugin add cordova-plugin-firebasex-messaging
cd ios && npx cordova plugin add cordova-plugin-firebasex-messaging
```

Then rebuild:

```
npm run apk:build      # Android
npm run ios:build      # iOS (device)
```

## 5. Test

1. Deploy the functions (or run `netlify dev`) with the FCM env set.
2. Install the rebuilt app on a device, log in.
3. Assign a table to a match involving that player → the device receives a
   push ("Your match has been assigned to table N"), even when the app is
   backgrounded.

## Notes

- `google-services.json` / `GoogleService-Info.plist` are required at build
  time. They contain project config (no service-account secret) and are
  generally safe to commit so CI/other machines can build.
- The service-account **private key** (`FCM_PRIVATE_KEY`) is a secret — keep
  it only in env vars, never in the repo.
