/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2017, 2019 Michael Telatynski <7t3chguy@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Squirrel on windows starts the app with various flags
// as hooks to tell us when we've been installed/uninstalled
// etc.
const checkSquirrelHooks = require('./squirrelhooks');
if (checkSquirrelHooks()) return;

const argv = require('minimist')(process.argv, {
    alias: {help: "h"},
});

const {app, ipcMain, powerSaveBlocker, BrowserWindow, Menu, autoUpdater, protocol} = require('electron');
const AutoLaunch = require('auto-launch');
const path = require('path');
const ioHook = require('iohook');

const tray = require('./tray');
const vectorMenu = require('./vectormenu');
const webContentsHandler = require('./webcontents-handler');
const updater = require('./updater');
const { migrateFromOldOrigin } = require('./originMigrator');

const windowStateKeeper = require('electron-window-state');
const Store = require('electron-store');

if (argv["help"]) {
    console.log("Options:");
    console.log("  --profile-dir {path}: Path to where to store the profile.");
    console.log("  --profile {name}:     Name of alternate profile to use, allows for running multiple accounts.");
    console.log("  --devtools:           Install and use react-devtools and react-perf.");
    console.log("  --no-update:          Disable automatic updating.");
    console.log("  --hidden:             Start the application hidden in the system tray.");
    console.log("  --help:               Displays this help message.");
    console.log("And more such as --proxy, see:" +
        "https://github.com/electron/electron/blob/master/docs/api/chrome-command-line-switches.md");
    app.exit();
}

// boolean flag set whilst we are doing one-time origin migration
// We only serve the origin migration script while we're actually
// migrating to mitigate any risk of it being used maliciously.
let migratingOrigin = false;

if (argv['profile-dir']) {
    app.setPath('userData', argv['profile-dir']);
} else if (argv['profile']) {
    app.setPath('userData', `${app.getPath('userData')}-${argv['profile']}`);
}

let vectorConfig = {};
try {
    vectorConfig = require('../../webapp/config.json');
} catch (e) {
    // it would be nice to check the error code here and bail if the config
    // is unparseable, but we get MODULE_NOT_FOUND in the case of a missing
    // file or invalid json, so node is just very unhelpful.
    // Continue with the defaults (ie. an empty config)
}

try {
    // Load local config and use it to override values from the one baked with the build
    const localConfig = require(path.join(app.getPath('userData'), 'config.json'));
    vectorConfig = Object.assign(vectorConfig, localConfig);
} catch (e) {
    // Could not load local config, this is expected in most cases.
}

const store = new Store({ name: "electron-config" });

let mainWindow = null;
global.appQuitting = false;
global.minimizeToTray = store.get('minimizeToTray', true);


// handle uncaught errors otherwise it displays
// stack traces in popup dialogs, which is terrible (which
// it will do any time the auto update poke fails, and there's
// no other way to catch this error).
// Assuming we generally run from the console when developing,
// this is far preferable.
process.on('uncaughtException', function(error) {
    console.log('Unhandled exception', error);
});

let focusHandlerAttached = false;
ipcMain.on('setBadgeCount', function(ev, count) {
    app.setBadgeCount(count);
    if (count === 0 && mainWindow) {
        mainWindow.flashFrame(false);
    }
});

ipcMain.on('loudNotification', function() {
    if (process.platform === 'win32' && mainWindow && !mainWindow.isFocused() && !focusHandlerAttached) {
        mainWindow.flashFrame(true);
        mainWindow.once('focus', () => {
            mainWindow.flashFrame(false);
            focusHandlerAttached = false;
        });
        focusHandlerAttached = true;
    }
});

let powerSaveBlockerId;
ipcMain.on('app_onAction', function(ev, payload) {
    switch (payload.action) {
        case 'call_state':
            if (powerSaveBlockerId && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
                if (payload.state === 'ended') {
                    powerSaveBlocker.stop(powerSaveBlockerId);
                }
            } else {
                if (payload.state === 'connected') {
                    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
                }
            }
            break;
    }
});

autoUpdater.on('update-downloaded', (ev, releaseNotes, releaseName, releaseDate, updateURL) => {
    if (!mainWindow) return;
    // forward to renderer
    mainWindow.webContents.send('update-downloaded', {
        releaseNotes,
        releaseName,
        releaseDate,
        updateURL,
    });
});

ipcMain.on('ipcCall', async function(ev, payload) {
    if (!mainWindow) return;

    const args = payload.args || [];
    let ret;

    switch (payload.name) {
        case 'getUpdateFeedUrl':
            ret = autoUpdater.getFeedURL();
            break;
        case 'getAutoLaunchEnabled':
            ret = await launcher.isEnabled();
            break;
        case 'setAutoLaunchEnabled':
            if (args[0]) {
                launcher.enable();
            } else {
                launcher.disable();
            }
            break;
        case 'getMinimizeToTrayEnabled':
            ret = global.minimizeToTray;
            break;
        case 'setMinimizeToTrayEnabled':
            store.set('minimizeToTray', global.minimizeToTray = args[0]);
            break;
        case 'getAutoHideMenuBarEnabled':
            ret = global.mainWindow.isMenuBarAutoHide();
            break;
        case 'setAutoHideMenuBarEnabled':
            store.set('autoHideMenuBar', args[0]);
            global.mainWindow.setAutoHideMenuBar(args[0]);
            global.mainWindow.setMenuBarVisibility(!args[0]);
            break;
        case 'getAppVersion':
            ret = app.getVersion();
            break;
        case 'focusWindow':
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            } else if (!mainWindow.isVisible()) {
                mainWindow.show();
            } else {
                mainWindow.focus();
            }
            break;
        case 'origin_migrate':
            migratingOrigin = true;
            await migrateFromOldOrigin();
            migratingOrigin = false;
            break;
        case 'getConfig':
            ret = vectorConfig;
            break;
        default:
            mainWindow.webContents.send('ipcReply', {
                id: payload.id,
                error: "Unknown IPC Call: " + payload.name,
            });
            return;
    }

    mainWindow.webContents.send('ipcReply', {
        id: payload.id,
        reply: ret,
    });
});

app.commandLine.appendSwitch('--enable-usermedia-screen-capturing');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    console.log('Other instance detected: exiting');
    app.exit();
}

const launcher = new AutoLaunch({
    name: vectorConfig.brand || 'Riot',
    isHidden: true,
    mac: {
        useLaunchAgent: true,
    },
});

// Register the scheme the app is served from as 'standard'
// which allows things like relative URLs and IndexedDB to
// work.
// Also mark it as secure (ie. accessing resources from this
// protocol and HTTPS won't trigger mixed content warnings).
protocol.registerSchemesAsPrivileged([{
    scheme: 'vector',
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
    },
}]);

app.on('ready', () => {
    if (argv['devtools']) {
        try {
            const { default: installExt, REACT_DEVELOPER_TOOLS, REACT_PERF } = require('electron-devtools-installer');
            installExt(REACT_DEVELOPER_TOOLS)
                .then((name) => console.log(`Added Extension: ${name}`))
                .catch((err) => console.log('An error occurred: ', err));
            installExt(REACT_PERF)
                .then((name) => console.log(`Added Extension: ${name}`))
                .catch((err) => console.log('An error occurred: ', err));
        } catch (e) {
            console.log(e);
        }
    }

    protocol.registerFileProtocol('vector', (request, callback) => {
        if (request.method !== 'GET') {
            callback({error: -322}); // METHOD_NOT_SUPPORTED from chromium/src/net/base/net_error_list.h
            return null;
        }

        const parsedUrl = new URL(request.url);
        if (parsedUrl.protocol !== 'vector:') {
            callback({error: -302}); // UNKNOWN_URL_SCHEME
            return;
        }
        if (parsedUrl.host !== 'vector') {
            callback({error: -105}); // NAME_NOT_RESOLVED
            return;
        }

        const target = parsedUrl.pathname.split('/');

        // path starts with a '/'
        if (target[0] !== '') {
            callback({error: -6}); // FILE_NOT_FOUND
            return;
        }

        if (target[target.length - 1] == '') {
            target[target.length - 1] = 'index.html';
        }

        let baseDir;
        // first part of the path determines where we serve from
        if (migratingOrigin && target[1] === 'origin_migrator_dest') {
            // the origin migrator destination page
            // (only the destination script needs to come from the
            // custom protocol: the source part is loaded from a
            // file:// as that's the origin we're migrating from).
            baseDir = __dirname + "/../../origin_migrator/dest";
        } else if (target[1] === 'webapp') {
            baseDir = __dirname + "/../../webapp";
        } else {
            callback({error: -6}); // FILE_NOT_FOUND
            return;
        }

        // Normalise the base dir and the target path separately, then make sure
        // the target path isn't trying to back out beyond its root
        baseDir = path.normalize(baseDir);

        const relTarget = path.normalize(path.join(...target.slice(2)));
        if (relTarget.startsWith('..')) {
            callback({error: -6}); // FILE_NOT_FOUND
            return;
        }
        const absTarget = path.join(baseDir, relTarget);

        callback({
            path: absTarget,
        });
    }, (error) => {
        if (error) console.error('Failed to register protocol');
    });

    if (argv['no-update']) {
        console.log('Auto update disabled via command line flag "--no-update"');
    } else if (vectorConfig['update_base_url']) {
        console.log(`Starting auto update with base URL: ${vectorConfig['update_base_url']}`);
        updater.start(vectorConfig['update_base_url']);
    } else {
        console.log('No update_base_url is defined: auto update is disabled');
    }

    // It's important to call `path.join` so we don't end up with the packaged
    // asar in the final path.
    const iconFile = `riot.${process.platform === 'win32' ? 'ico' : 'png'}`;
    const iconPath = path.join(__dirname, "..", "..", "img", iconFile);

    // Load the previous window state with fallback to defaults
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1024,
        defaultHeight: 768,
    });

    const preloadScript = path.normalize(`${__dirname}/preload.js`);
    mainWindow = global.mainWindow = new BrowserWindow({
        icon: iconPath,
        show: false,
        autoHideMenuBar: store.get('autoHideMenuBar', true),

        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        webPreferences: {
            preload: preloadScript,
            nodeIntegration: false,
            sandbox: true,
            enableRemoteModule: false,
            // We don't use this: it's useful for the preload script to
            // share a context with the main page so we can give select
            // objects to the main page. The sandbox option isolates the
            // main page from the background script.
            contextIsolation: false,
            webgl: false,
        },
    });
    mainWindow.loadURL('vector://vector/webapp/');
    Menu.setApplicationMenu(vectorMenu);

    // explicitly hide because setApplicationMenu on Linux otherwise shows...
    // https://github.com/electron/electron/issues/9621
    mainWindow.hide();

    // Create trayIcon icon
    tray.create({
        icon_path: iconPath,
        brand: vectorConfig.brand || 'Riot',
    });

    mainWindow.once('ready-to-show', () => {
        mainWindowState.manage(mainWindow);

        if (!argv['hidden']) {
            mainWindow.show();
        } else {
            // hide here explicitly because window manage above sometimes shows it
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = global.mainWindow = null;
    });
    mainWindow.on('close', (e) => {
        if (global.minimizeToTray && !global.appQuitting && (tray.hasTray() || process.platform === 'darwin')) {
            // On Mac, closing the window just hides it
            // (this is generally how single-window Mac apps
            // behave, eg. Mail.app)
            e.preventDefault();
            mainWindow.hide();
            return false;
        }
    });
    mainWindow.on('blur', () => {
        // Stop recording keypresses if Riot loses focus
        // Used for Push-To-Talk, keypress recording only triggered when setting
        // a global shortcut in Settings
        mainWindow.webContents.send('window-blurred');
        stopListeningKeys();
    });

    if (process.platform === 'win32') {
        // Handle forward/backward mouse buttons in Windows
        mainWindow.on('app-command', (e, cmd) => {
            if (cmd === 'browser-backward' && mainWindow.webContents.canGoBack()) {
                mainWindow.webContents.goBack();
            } else if (cmd === 'browser-forward' && mainWindow.webContents.canGoForward()) {
                mainWindow.webContents.goForward();
            }
        });
    }

    webContentsHandler(mainWindow.webContents);
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    mainWindow.show();
});

app.on('before-quit', () => {
    global.appQuitting = true;
    if (mainWindow) {
        mainWindow.webContents.send('before-quit');
    }
});

app.on('second-instance', (ev, commandLine, workingDirectory) => {
    // If other instance launched with --hidden then skip showing window
    if (commandLine.includes('--hidden')) return;

    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// Counter for keybindings we have registered
let ioHookTasks = 0;

// Limit for amount of keybindings that can be
// registered at once.
const keybindingRegistrationLimit = 1;

// Fires when a global keybinding is being registered
ipcMain.on('register-keybinding', function(ev, keybinding) {
    // Prevent registering more than the defined limit
    if (ioHookTasks >= keybindingRegistrationLimit) {
        ioHookTasks = keybindingRegistrationLimit;
        return;
    }

    // Start listening for global keyboard shortcuts
    if (ioHookTasks <= 0) {
        ioHookTasks = 0;
        ioHook.start();
    }
    ioHookTasks++;

    ioHook.registerShortcut(keybinding.code, () => {
        ev.sender.send('keybinding-pressed', keybinding.name);
    }, () => {
        ev.sender.send('keybinding-released', keybinding.name);
    });
});

// Fires when a global keybinding is being unregistered
ipcMain.on('unregister-keybinding', function(ev, keybindingCode) {
    // Stop listening for global keyboard shortcuts if we're
    // unregistering the last one
    if (ioHookTasks <= 1) {
        ioHook.stop();
    }
    ioHookTasks--;

    ioHook.unregisterShortcutByKeys(keybindingCode);
});

// Tell renderer process what key was pressed
// iohook has its own encoding for keys, so we can't just use a
// listener in the renderer process to register iohook shortcuts
let renderProcessID = null;
const reportKeyEvent = function(keyEvent) {
    // "this" is the renderer process because we call this method with .bind()
    renderProcessID.sender.send('keypress', {
        keydown: keyEvent.type == 'keydown',
        keycode: keyEvent.keycode,
    });
};

// Fires when listening on all keys
// !!Security note: Ensure iohook is only allowed to listen to keybindings
// when the browser window is in focus, else an XSS could lead to keylogging
// Currently, this is achieved by leveraging browserWindow to act on focus loss
ipcMain.on('start-listening-keys', function(ev, keybindingCode) {
    // Start recording keypresses
    if (ioHookTasks <= 0) {
        ioHookTasks = 0;
        ioHook.start();
    }
    ioHookTasks++;

    renderProcessID = ev;
    ioHook.on('keydown', reportKeyEvent);
    ioHook.on('keyup', reportKeyEvent);
});

const stopListeningKeys = () => {
    // Stop recording keypresses
    ioHook.off('keydown', reportKeyEvent);
    ioHook.off('keyup', reportKeyEvent);
};

ipcMain.on('stop-listening-keys', () => {
    if (ioHookTasks <= 1) {
        ioHookTasks = 1;
        ioHook.stop();
    }
    ioHookTasks--;

    stopListeningKeys();
});

// Set the App User Model ID to match what the squirrel
// installer uses for the shortcut icon.
// This makes notifications work on windows 8.1 (and is
// a noop on other platforms).
app.setAppUserModelId('com.squirrel.riot-web.Riot');
