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

import randomString from "random-string";

// Dev note: This is largely inspired by Dimension. Used with permission.
// https://github.com/turt2live/matrix-dimension/blob/4f92d560266635e5a3c824606215b84e8c0b19f5/web/app/shared/services/scalar/scalar-widget.api.ts#L1
export default class WidgetApi {

    _origin;
    _widgetId;
    _capabilities;
    _inFlightRequests = {}; // { reqId => replyFn(payload) }

    constructor(origin, widgetId, capabilities) {
        this._origin = new URL(origin).origin;
        this._widgetId = widgetId;
        this._capabilities = capabilities;

        const toWidgetActions = {
            "capabilities": this._onCapabilitiesRequest.bind(this),
        };

        window.addEventListener("message", event => {
            if (event.origin !== this._origin) return; // ignore due to invalid origin
            if (!event.data) return;
            if (event.data.widgetId !== this._widgetId) return;

            const payload = event.data;
            if (payload.api === "toWidget" && payload.action) {
                console.log("[Inline Widget] Got toWidget: " + JSON.stringify(payload));
                const handler = toWidgetActions[payload.action];
                if (handler) handler(payload);
            }
            if (payload.api === "fromWidget" && this._inFlightRequests[payload.requestId]) {
                console.log("[Inline Widget] Got fromWidget reply: " + JSON.stringify(payload));
                const handler = this._inFlightRequests[payload.requestId];
                delete this._inFlightRequests[payload.requestId];
                handler(payload);
            }
        });
    }

    sendText(text) {
        this.sendEvent("m.room.message", {msgtype: "m.text", body: text});
    }

    sendNotice(text) {
        this.sendEvent("m.room.message", {msgtype: "m.notice", body: text});
    }

    sendEvent(eventType, content) {
        this._callAction("send_event", {
            type: eventType,
            content: content,
        });
    }

    _callAction(action, payload) {
        if (!window.parent) {
            return;
        }

        const request = {
            api: "fromWidget",
            widgetId: this._widgetId,
            action: action,
            requestId: randomString({length: 16}),
            data: payload,
        };

        this._inFlightRequests[request.requestId] = () => {};

        console.log("[Inline Widget] Sending fromWidget: ", request);
        window.parent.postMessage(request, this._origin);
    }

    _replyPayload(incPayload, payload) {
        if (!window.parent) {
            return;
        }

        let request = JSON.parse(JSON.stringify(incPayload));
        request["response"] = payload;

        window.parent.postMessage(request, this._origin);
    }

    _onCapabilitiesRequest(payload) {
        this._replyPayload(payload, {capabilities: this._capabilities});
    }
}