/*
Copyright 2021 New Vector Ltd.

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
import { settled } from "../promise_utils";
import ReactDOM from 'react-dom';
import { StopGapWidgetDriver, WidgetRenderMode } from "matrix-react-sdk/src/stores/widgets/StopGapWidgetDriver";
import WidgetUtils from "matrix-react-sdk/src/utils/WidgetUtils";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";

// The widget's options are encoded into the fragment to avoid leaking info to the server. The widget
// spec on the other hand requires the widgetId and parentUrl to show up in the regular query string.
const widgetQuery = qs.parse(window.location.hash.substring(2));
const qsParam = (name: string, optional = false): string => {
    if (!optional && (!widgetQuery[name] || typeof (widgetQuery[name]) !== 'string')) {
        throw new Error(`Expected singular ${name} in query string`);
    }
    return widgetQuery[name] as string;
};

const accessToken = qsParam("accessToken");
const homeserverUrl = qsParam("hsUrl");
const roomId = qsParam("roomId", true);
const widgetId = qsParam("widgetId"); // state_key or account data key

// TODO: clear href so people don't accidentally copy/paste it
//window.location.hash = '';

(async function() {
    const {
        rageshakePromise,
        preparePlatform,
        loadSkin,
        loadOlm, // to handle timelines
        loadLanguage,
        loadTheme,
        showError,
        _t,
    } = await import(
        /* webpackChunkName: "thin-wrapper-init" */
        /* webpackPreload: true */
        "../init");

    try {
        // give rageshake a chance to load/fail, we don't actually assert rageshake loads, we allow it to fail if no IDB
        console.log("Waiting for rageshake...");
        await settled(rageshakePromise);

        console.log("Running startup...");
        StopGapWidgetDriver.RENDER_MODE = WidgetRenderMode.ThinWrapper;
        await loadSkin();
        await loadOlm();
        preparePlatform();
        await MatrixClientPeg.shim(homeserverUrl, accessToken);
        await loadTheme();
        await loadLanguage();

        console.log("Locating widget...");
        const stateEvent = await MatrixClientPeg.get()._http.authedRequest(
            undefined, "GET",
            `/rooms/${encodeURIComponent(roomId)}/state/im.vector.modular.widgets/${encodeURIComponent(widgetId)}`,
            undefined, undefined, {},
        );
        if (!stateEvent?.url) {
            throw new Error("Invalid widget");
        }
        const app = WidgetUtils.makeAppConfig(
            widgetId,
            stateEvent,
            MatrixClientPeg.get().getUserId(), // assume we are the sender
            roomId,
            widgetId);

        // Now we can start our custom code
        console.log("Loading app...");
        const module = await import(
            /* webpackChunkName: "thin-wrapper-app" */
            /* webpackPreload: true */
            "./app");
        window.matrixChat = ReactDOM.render(await module.loadApp(app),
            document.getElementById('matrixchat'));
    } catch (err) {
        console.error(err);
        // Like the compatibility page, AWOOOOOGA at the user
        // This uses the default brand since the app config is unavailable.
        await showError(_t("Your Element is misconfigured"), [
            err.translatedMessage || _t("Unexpected error preparing the app. See console for details."),
        ]);
    }
})();
