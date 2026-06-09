# VTTC APK build (Cordova)

This directory wraps the built web app (`../dist`) into a Cordova
Android project so it can be packaged as an APK.

## Prerequisites

- Node.js (already required by the root project)
- Android SDK + JDK (Android Studio installs both; ensure `ANDROID_HOME`
  and `JAVA_HOME` are set in your shell)
- The root `npm install` has already run, so the root `cordova` CLI is
  available via `npx cordova` from the project root.

## API host

The Vite client picks the API host as:

| Build | Host source |
| --- | --- |
| `npm run dev:client` / `npm start` | `http://<page-host>:8888` (netlify dev) |
| Production web build with no env  | same origin (`''`) |
| Production web build with env     | `VITE_PROD_HOST` |

For an APK there's no usable "same origin", so `VITE_PROD_HOST` **must**
be set when running the apk scripts. The simplest way:

```bash
# In the project root (next to package.json):
echo 'VITE_PROD_HOST=https://your-deployed-app.example.com' >> .env.production
```

Vite reads `.env.production` automatically during `vite build`.
Alternatively pass it inline:

```bash
VITE_PROD_HOST=https://your-deployed-app.example.com npm run apk:build
```

## One-time setup (per checkout)

```bash
npm install                 # at the project root, installs Cordova CLI
npm run apk:prepare         # installs cordova-android, adds android platform
```

## Build a debug APK

```bash
npm run apk:build
```

Output: `apk/platforms/android/app/build/outputs/apk/debug/app-debug.apk`

## Build a release APK

```bash
npm run apk:build:release
```

You'll need to sign + zipalign the resulting unsigned APK with your
keystore the first time (Cordova will print the path).

## What each script does

- `apk:sync` — `vite build` then copy `../dist/` into `./www/`.
- `apk:prepare` — installs apk-local devDependencies (cordova-android)
  and adds the android platform.
- `apk:build` / `apk:build:release` — runs `apk:sync` then
  `cordova build android` (with `--release` for the second).

## Upload built APK to Google Drive

`npm run apk:build` (and `apk:build:release`) automatically uploads the
freshly-built APK to a Google Drive folder owned by
**vttclive@gmail.com** via `apk/upload-to-gdrive.js`. The uploader runs
as a `post` hook, uses a stored OAuth refresh token (so the build stays
non-interactive), and **no-ops with a friendly message** when the
required env vars aren't set — so devs without upload access can still
build locally.

### One-time setup

1. **Make a Google Cloud OAuth client** for vttclive@gmail.com:
   - Go to <https://console.cloud.google.com>, sign in as vttclive.
   - Create (or reuse) a project, enable **Google Drive API**.
   - APIs & Services → Credentials → Create credentials → **OAuth client
     ID** → Application type **Desktop app**. Save the client id and
     client secret.

2. **Get a refresh token** using the OAuth Playground:
   - Open <https://developers.google.com/oauthplayground>.
   - Gear icon → tick "Use your own OAuth credentials" → paste the
     client id + secret.
   - Step 1: scope `https://www.googleapis.com/auth/drive.file` →
     "Authorize APIs" → sign in as vttclive → allow.
   - Step 2: "Exchange authorization code for tokens" → copy the
     **refresh token**.

3. **Create the destination folder** in vttclive's Drive (e.g. "VTTC
   APK Builds"). Open the folder; the id is the last segment of the
   URL (`drive.google.com/drive/folders/<FOLDER_ID>`).

4. **Add the credentials to the root `.env`**:

   ```env
   GDRIVE_CLIENT_ID=<from step 1>
   GDRIVE_CLIENT_SECRET=<from step 1>
   GDRIVE_REFRESH_TOKEN=<from step 2>
   GDRIVE_FOLDER_ID=<from step 3>
   ```

That's it — the next `npm run apk:build` will upload `app-debug.apk`
into the folder. Override the source path with `GDRIVE_APK_PATH=...` if
needed.

## Troubleshooting

- "API requests fail in the APK": confirm `VITE_PROD_HOST` was set when
  `vite build` ran. Open Chrome DevTools → `chrome://inspect` and pick
  the device WebView to inspect.
- "API requests are blocked by mixed-content": ensure `VITE_PROD_HOST`
  uses `https://`. The Android WebView blocks `http` from a
  `cordova-released` page by default.
