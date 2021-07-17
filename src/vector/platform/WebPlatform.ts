/*
Copyright 2016 Aviral Dasgupta
Copyright 2016 OpenMarket Ltd
Copyright 2017-2020 New Vector Ltd

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

import VectorBasePlatform from './VectorBasePlatform';
import { UpdateCheckStatus } from "matrix-react-sdk/src/BasePlatform";
import request from 'browser-request';
import dis from 'matrix-react-sdk/src/dispatcher/dispatcher';
import { _t } from 'matrix-react-sdk/src/languageHandler';
import { Room } from "matrix-js-sdk/src/models/room";
import { hideToast as hideUpdateToast, showToast as showUpdateToast } from "matrix-react-sdk/src/toasts/UpdateToast";
import { Action } from "matrix-react-sdk/src/dispatcher/actions";
import { CheckUpdatesPayload } from 'matrix-react-sdk/src/dispatcher/payloads/CheckUpdatesPayload';

import UAParser from 'ua-parser-js';

const POKE_RATE_MS = 10 * 60 * 1000; // 10 min

export default class WebPlatform extends VectorBasePlatform {
    private runningVersion: string = null;

    constructor() {
        super();
        // Register service worker if available on this platform
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }
    }

    getHumanReadableName(): string {
        return 'Web Platform'; // no translation required: only used for analytics
    }

    /**
     * Returns true if the platform supports displaying
     * notifications, otherwise false.
     */
    supportsNotifications(): boolean {
        return Boolean(window.Notification && window.self === window.top);
    }

    /**
     * Returns true if the application currently has permission
     * to display notifications. Otherwise false.
     */
    maySendNotifications(): boolean {
        return window.Notification.permission === 'granted';
    }

    /**
     * Requests permission to send notifications. Returns
     * a promise that is resolved when the user has responded
     * to the request. The promise has a single string argument
     * that is 'granted' if the user allowed the request or
     * 'denied' otherwise.
     */
    requestNotificationPermission(): Promise<string> {
        // annoyingly, the latest spec says this returns a
        // promise, but this is only supported in Chrome 46
        // and Firefox 47, so adapt the callback API.
        return new Promise(function(resolve, reject) {
            window.Notification.requestPermission((result) => {
                resolve(result);
            });
        });
    }

    displayNotification(title: string, msg: string, avatarUrl: string, room: Room) {
        const notifBody = {
            body: msg,
            tag: "vector",
            silent: true, // we play our own sounds
        };
        if (avatarUrl) notifBody['icon'] = avatarUrl;
        const notification = new window.Notification(title, notifBody);

        notification.onclick = function() {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId,
            });
            window.focus();
            notification.close();
        };

        return notification;
    }

    _getVersion(): Promise<string> {
        // We add a cachebuster to the request to make sure that we know about
        // the most recent version on the origin server. That might not
        // actually be the version we'd get on a reload (particularly in the
        // presence of intermediate caching proxies), but still: we're trying
        // to tell the user that there is a new version.

        return new Promise(function(resolve, reject) {
            request(
                {
                    method: "GET",
                    url: "version",
                    qs: { cachebuster: Date.now() },
                },
                (err, response, body) => {
                    if (err || response.status < 200 || response.status >= 300) {
                        if (err === null) err = { status: response.status };
                        reject(err);
                        return;
                    }

                    const ver = body.trim();
                    resolve(ver);
                },
            );
        });
    }

    getAppVersion(): Promise<string> {
        if (this.runningVersion !== null) {
            return Promise.resolve(this.runningVersion);
        }
        return this._getVersion();
    }

    startUpdater() {
        this.pollForUpdate();
        setInterval(this.pollForUpdate, POKE_RATE_MS);
    }

    async canSelfUpdate(): Promise<boolean> {
        return true;
    }

    pollForUpdate = () => {
        return this._getVersion().then((ver) => {
            if (this.runningVersion === null) {
                this.runningVersion = ver;
            } else if (this.runningVersion !== ver) {
                if (this.shouldShowUpdate(ver)) {
                    showUpdateToast(this.runningVersion, ver);
                }
                return { status: UpdateCheckStatus.Ready };
            } else {
                hideUpdateToast();
            }

            return { status: UpdateCheckStatus.NotAvailable };
        }, (err) => {
            console.error("Failed to poll for update", err);
            return {
                status: UpdateCheckStatus.Error,
                detail: err.message || err.status ? err.status.toString() : 'Unknown Error',
            };
        });
    };

    startUpdateCheck() {
        super.startUpdateCheck();
        this.pollForUpdate().then((updateState) => {
            dis.dispatch<CheckUpdatesPayload>({
                action: Action.CheckUpdates,
                ...updateState,
            });
        });
    }

    installUpdate() {
        window.location.reload(true);
    }

    getDefaultDeviceDisplayName(): string {
        // strip query-string and fragment from uri
        const url = new URL(window.location.href);

        // `appName` in the format `develop.element.io/abc/xyz`
        const appName = [
            url.host,
            url.pathname.replace(/\/$/, ""), // Remove trailing slash if present
        ].join("");

        const ua = new UAParser();
        const browserName = ua.getBrowser().name || "unknown browser";
        let osName = ua.getOS().name || "unknown OS";
        // Stylise the value from the parser to match Apple's current branding.
        if (osName === "Mac OS") osName = "macOS";
        return _t('%(appName)s (%(browserName)s, %(osName)s)', {
            appName,
            browserName,
            osName,
        });
    }

    screenCaptureErrorString(): string | null {
        // it won't work at all if you're not on HTTPS so whine whine whine
        if (window.location.protocol !== "https:") {
            return _t("You need to be using HTTPS to place a screen-sharing call.");
        }
        return null;
    }

    reload() {
        // forceReload=false since we don't really need new HTML/JS files
        // we just need to restart the JS runtime.
        window.location.reload(false);
    }
}
