/*
Copyright 2020 New Vector Ltd.

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

// We have to trick webpack into loading our CSS for us.
require("./index.scss");

import * as qs from 'querystring';
import { Capability, WidgetApi } from "matrix-react-sdk/src/widgets/WidgetApi";

// Dev note: we use raw JS without many dependencies to reduce bundle size.
// We do not need all of React to render a Jitsi conference.

declare let JitsiMeetExternalAPI: any;

let inConference = false;

// Jitsi params
let jitsiDomain: string;
let conferenceId: string;
let displayName: string;
let avatarUrl: string;
let userId: string;

let widgetApi: WidgetApi;

(async function() {
    try {
        // The widget's options are encoded into the fragment to avoid leaking info to the server. The widget
        // spec on the other hand requires the widgetId and parentUrl to show up in the regular query string.
        const widgetQuery = qs.parse(window.location.hash.substring(1));
        const query = Object.assign({}, qs.parse(window.location.search.substring(1)), widgetQuery);
        const qsParam = (name: string, optional = false): string => {
            if (!optional && (!query[name] || typeof (query[name]) !== 'string')) {
                throw new Error(`Expected singular ${name} in query string`);
            }
            return <string>query[name];
        };

        // If we have these params, expect a widget API to be available (ie. to be in an iframe
        // inside a matrix client). Otherwise, assume we're on our own, eg. have been popped
        // out into a browser.
        const parentUrl = qsParam('parentUrl', true);
        const widgetId = qsParam('widgetId', true);

        // Set this up as early as possible because Element will be hitting it almost immediately.
        if (parentUrl && widgetId) {
            widgetApi = new WidgetApi(qsParam('parentUrl'), qsParam('widgetId'), [
                Capability.AlwaysOnScreen,
                Capability.ReceiveTerminate,
            ]);
            widgetApi.expectingExplicitReady = true;
        }

        // Populate the Jitsi params now
        jitsiDomain = qsParam('conferenceDomain');
        conferenceId = qsParam('conferenceId');
        displayName = qsParam('displayName', true);
        avatarUrl = qsParam('avatarUrl', true); // http not mxc
        userId = qsParam('userId');

        if (widgetApi) {
            await widgetApi.waitReady();
            await widgetApi.setAlwaysOnScreen(false); // start off as detachable from the screen
        }

        // TODO: register widgetApi listeners for PTT controls (https://github.com/vector-im/riot-web/issues/12795)

        document.getElementById("joinButton").onclick = () => joinConference();
    } catch (e) {
        console.error("Error setting up Jitsi widget", e);
        document.getElementById("jitsiContainer").innerText = "Failed to load Jitsi widget";
        switchVisibleContainers();
    }
})();

function switchVisibleContainers() {
    inConference = !inConference;
    document.getElementById("jitsiContainer").style.visibility = inConference ? 'unset' : 'hidden';
    document.getElementById("joinButtonContainer").style.visibility = inConference ? 'hidden' : 'unset';
}

function joinConference() { // event handler bound in HTML
    switchVisibleContainers();

    // noinspection JSIgnoredPromiseFromCall
    if (widgetApi) widgetApi.setAlwaysOnScreen(true); // ignored promise because we don't care if it works

    console.warn(
        "[Jitsi Widget] The next few errors about failing to parse URL parameters are fine if " +
        "they mention 'external_api' or 'jitsi' in the stack. They're just Jitsi Meet trying to parse " +
        "our fragment values and not recognizing the options.",
    );
    const meetApi = new JitsiMeetExternalAPI(jitsiDomain, {
        width: "100%",
        height: "100%",
        parentNode: document.querySelector("#jitsiContainer"),
        roomName: conferenceId,
        interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            MAIN_TOOLBAR_BUTTONS: [],
            VIDEO_LAYOUT_FIT: "height",
        },
    });
    if (displayName) meetApi.executeCommand("displayName", displayName);
    if (avatarUrl) meetApi.executeCommand("avatarUrl", avatarUrl);
    if (userId) meetApi.executeCommand("email", userId);

    const meetingClosed = new Promise(resolve => {
        meetApi.on("readyToClose", () => {
            switchVisibleContainers();

            // noinspection JSIgnoredPromiseFromCall
            if (widgetApi) widgetApi.setAlwaysOnScreen(false); // ignored promise because we don't care if it works
            meetApi.dispose();

            document.getElementById("jitsiContainer").innerHTML = "";

            resolve();
        });
    });

    widgetApi.once('terminate', (wait) => {
        // Hangup before the client terminates the widget. Don't show
        // the feedback dialog.
        console.log("[Jitsi Widget] Client asks to terminate, hanging up");
        meetApi.executeCommand("hangup", false);
        wait(meetingClosed);
    });
}
