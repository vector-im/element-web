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

import React from 'react';
import AppTile from "matrix-react-sdk/src/components/views/elements/AppTile";
import { IWidget } from "matrix-widget-api";
import MatrixClientContext from "matrix-react-sdk/src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";

// add React and ReactPerf to the global namespace, to make them easier to access via the console
// this incidentally means we can forget our React imports in JSX files without penalty.
window.React = React;

export interface IStartOpts {
    widgetId: string;
    roomId?: string;
}

export async function loadApp(widget: IWidget) {
    return (
        <MatrixClientContext.Provider value={MatrixClientPeg.get()}>
            <div id="mx_ThinWrapper_container">
                <AppTile
                    app={widget}
                    fullWidth={true}
                    userId={MatrixClientPeg.get().getUserId()}
                    userWidget={false}
                />
            </div>
        </MatrixClientContext.Provider>
    );
}
