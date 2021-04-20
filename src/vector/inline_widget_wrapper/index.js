/*
Copyright 2019 New Vector Ltd.

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
import queryString from "querystring";
import WidgetApi from "./WidgetApi";

let widgetApi;
try {
    const qs = queryString.parse(window.location.search.substring(1));
    if (!qs["widgetId"]) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error("Missing widgetId in query string");
    }
    if (!qs["parentUrl"]) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error("Missing parentUrl in query string");
    }

    const widgetOpts = JSON.parse(atob(window.location.hash
        .substring(1)
        .replace(/-/g, '+')
        .replace(/_/g, '/')));

    // This widget wrapper is always on the same origin as the client itself
    widgetApi = new WidgetApi(qs["parentUrl"], qs["widgetId"], widgetOpts["capabilities"]);

    document.getElementById("widgetHtml").innerHTML = widgetOpts['html'];
    bindButtons();
} catch (e) {
    console.error("[Inline Widget Wrapper] Error loading widget from URL: ", e);
    document.getElementById("widgetHtml").innerText = "Failed to load widget";
}

function bindButtons() {
    const buttons = document.getElementsByTagName("button");
    if (!buttons) return;
    for (const button of buttons) {
        button.addEventListener("click", onClick);
    }
}

function onClick(event) {
    if (!event.target) return;

    const action = event.target.getAttribute("data-mx-action");
    if (!action) return; // TODO: Submit form or something?

    const value = event.target.getAttribute("data-mx-value");
    if (!value) return; // ignore - no value

    if (action === "m.send_text") {
        widgetApi.sendText(value);
    } else if (action === "m.send_notice") {
        widgetApi.sendNotice(value);
    } else if (action === "m.send_hidden") {
        widgetApi.sendEvent("m.room.hidden", {body: value});
    } // else ignore
}
// TODO: Binding of forms, etc