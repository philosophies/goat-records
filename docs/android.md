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

## Prepare a Play Store build

- **Trusted Web Activity.** Host the game and manifest on a stable HTTPS origin. Use Bubblewrap to create a wrapper for that manifest, set the Android package ID, and sign an Android App Bundle. Publish Digital Asset Links at `/.well-known/assetlinks.json` on the game origin using the package ID and the Play signing certificate fingerprint. Test domain verification and offline relaunch on a device. This route uses the browser's storage for the hosted origin. [Android's TWA quick start](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)
- **Capacitor.** Package the game files in the configured web asset directory, add Android, and sync the files. Set landscape orientation in the Android project. Test the WebView's Back behavior and save file picker and export on an Android device, then build a signed Android App Bundle in Android Studio. A bundled build can open without a first network visit. [Capacitor for Android](https://capacitorjs.com/docs/android)
- **Store assets.** Use [the 512 px store icon](../icons/play-store-icon.png) and [the 1024 × 500 feature graphic](../icons/play-store-feature.png). The manifest uses separate 192 px and 512 px launcher assets. Add device screenshots, verify the current Play Console requirements, and test the signed bundle on an internal track before submitting it. [Google Play asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
