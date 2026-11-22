# Android and offline play

## Install the web app

Open Goat Records in Chrome or Edge on an HTTPS site, or use a localhost server for desktop testing. Use the browser's install command. The manifest launches the game in a standalone landscape window. The first visit must finish loading while online. Once the service worker controls the page, the game can launch and play offline.

Opening the extracted ZIP's `index.html` works through `file://`, with browser storage where supported. The service worker is registered only on HTTP or HTTPS. The game uses relative paths and needs no external requests during play. A site's saves are scoped to its browser origin. Use **Export save** and **Import save** when moving between a file, a hosted site, a browser, or a wrapper.

On Android, Back closes the top open panel. For example, Back from the Inbox returns to the phone, and Back again closes the phone.

## Validate a build

1. Serve the game root locally and open it in Chrome. In DevTools **Application**, check the manifest and service worker. Confirm installability, then reload once with the network set to Offline. The label, street, and saved run should load. Chrome removed the dedicated PWA category from newer Lighthouse versions. [Chrome installability documentation](https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest)
2. Install the app and test landscape, panel navigation and Back, album production, and save export/import. Repeat on a physical Android device before distribution.
3. Extract the game ZIP and open `index.html`. Check the same game entry point and save controls over `file://`.
4. When updating the game shell, update the `sw.js` cache version and include any new JavaScript, CSS, and icon paths. The old shell stays with existing sessions until the new worker can replace it.

## The Android app

`android-app/` holds a Capacitor wrapper that bundles the game's files into an Android app, so it opens offline from the first launch. The app id is `com.goatrecords.game` and the app is locked to landscape. Its launcher icons and splash screens are made from the game's icon.

1. Install Node 22 or newer and Android Studio (with the Android SDK and a JDK 21).
2. In `android-app/`, run `npm install`, then `npm run sync`. This copies `index.html`, the manifest, the service worker, `src/`, `styles/` and `icons/` into `www/` and updates the Android project.
3. Run `npm run open` to open the project in Android Studio. Run it on an emulator or a device, then build a signed Android App Bundle (**Build → Generate Signed App Bundle**). Keep the signing key out of the repository.
4. Run `npm run sync` again after every change to the game.

In the app, **Export save** writes the save file and opens Android's share sheet, so it can go to Files, Drive or another app. **Import save** uses the system file picker. Back closes the top open panel. On short screens such as a phone held sideways, the top bar takes two short rows.

What has been checked, and what has not: the project is generated from Capacitor 8 with the file and share plugins, and `tests/android-ui-test.cjs` checks the export path and that every file the page and the offline cache name is bundled. The game was laid out at 844 × 390 and 740 × 360. The app has not been built here, run on an emulator, or tested on a physical device; the Android SDK was not available in the build environment. Do those before any release.

## Prepare a Play Store build

- **Trusted Web Activity.** Host the game and manifest on a stable HTTPS origin. Use Bubblewrap to create a wrapper for that manifest, set the Android package ID, and sign an Android App Bundle. Publish Digital Asset Links at `/.well-known/assetlinks.json` on the game origin using the package ID and the Play signing certificate fingerprint. Test domain verification and offline relaunch on a device. This route uses the browser's storage for the hosted origin. [Android's TWA quick start](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)
- **Capacitor.** Package the game files in the configured web asset directory, add Android, and sync the files. Set landscape orientation in the Android project. Test the WebView's Back behavior and save file picker and export on an Android device, then build a signed Android App Bundle in Android Studio. A bundled build can open without a first network visit. [Capacitor for Android](https://capacitorjs.com/docs/android)
- **Store assets.** Use [the 512 px store icon](../icons/play-store-icon.png) and [the 1024 × 500 feature graphic](../icons/play-store-feature.png). The manifest uses separate 192 px and 512 px launcher assets. Add device screenshots, verify the current Play Console requirements, and test the signed bundle on an internal track before submitting it. [Google Play asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
