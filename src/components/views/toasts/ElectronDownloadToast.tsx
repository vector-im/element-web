/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, {useState} from "react";
import GenericToast from "matrix-react-sdk/src/components/views/toasts/GenericToast";
import { useEventEmitter } from "matrix-react-sdk/src/hooks/useEventEmitter";
import ToastStore from "matrix-react-sdk/src/stores/ToastStore";
import {_t} from "../../../vector/init";

const electron = window.electron;

interface IProps {
    downloadPath: string;
    name: string;
    totalBytes: number;
    receivedBytes: number;
    toastKey: string;
}

const ElectronDownloadToast: React.FC<IProps> = ({
    downloadPath,
    name,
    totalBytes,
    receivedBytes: initialReceivedBytes,
    toastKey,
}) => {
    const [state, setState] = useState<"progressing" | "paused" | "cancelled" | "failed">("progressing");
    const [receivedBytes, setReceivedBytes] = useState(initialReceivedBytes);

    useEventEmitter(electron, "userDownload", (ev, {state, path, name, totalBytes, receivedBytes, terminal, begin}) => {
        if (path !== downloadPath) return;

        setReceivedBytes(receivedBytes);
        switch (state) {
            case "progressing":
                setState("progressing");
                break;
            case "interrupted":
                if (terminal) {
                    setState("failed");
                } else {
                    setState("paused");
                }
                break;
            case "cancelled":
                setState("cancelled");
                break;
        }
    });

    let acceptLabel: string;
    let acceptFn;
    // TODO decide if this should be cancel/dismiss
    let rejectLabel = _t("Dismiss");
    let rejectFn = () => {
        ToastStore.sharedInstance().dismissToast(toastKey);
    };
    switch (state) {
        case "progressing":
            acceptLabel = _t("Pause");
            acceptFn = () => {
                electron.send("userDownload", {
                    action: "pause",
                    path: downloadPath,
                });
            };
            break;
        case "paused":
            acceptLabel = _t("Resume");
            acceptFn = () => {
                electron.send("userDownload", {
                    action: "resume",
                    path: downloadPath,
                });
            };
            break;
        case "failed":
            rejectLabel = null;
            rejectFn = null;
    }

    return <GenericToast
        description={`${name}: ${receivedBytes}b / ${totalBytes}b`}
        acceptLabel={acceptLabel}
        onAccept={acceptFn}
        rejectLabel={rejectLabel}
        onReject={rejectFn}
    />;
};

export default ElectronDownloadToast;
