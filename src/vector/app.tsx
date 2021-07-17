/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2020 The Matrix.org Foundation C.I.C.

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
// add React and ReactPerf to the global namespace, to make them easier to access via the console
// this incidentally means we can forget our React imports in JSX files without penalty.
window.React = React;

import * as sdk from 'matrix-react-sdk';
import PlatformPeg from 'matrix-react-sdk/src/PlatformPeg';
import { _td, newTranslatableError } from 'matrix-react-sdk/src/languageHandler';
import AutoDiscoveryUtils from 'matrix-react-sdk/src/utils/AutoDiscoveryUtils';
import { AutoDiscovery } from "matrix-js-sdk/src/autodiscovery";
import * as Lifecycle from "matrix-react-sdk/src/Lifecycle";
import type MatrixChatType from "matrix-react-sdk/src/components/structures/MatrixChat";
import SdkConfig from "matrix-react-sdk/src/SdkConfig";

import { parseQs, parseQsFromFragment } from './url_utils';
import VectorBasePlatform from "./platform/VectorBasePlatform";
import { createClient } from "matrix-js-sdk/src/matrix";

let lastLocationHashSet: string = null;

// Parse the given window.location and return parameters that can be used when calling
// MatrixChat.showScreen(screen, params)
function getScreenFromLocation(location: Location) {
    const fragparts = parseQsFromFragment(location);
    return {
        screen: fragparts.location.substring(1),
        params: fragparts.params,
    };
}

// Here, we do some crude URL analysis to allow
// deep-linking.
function routeUrl(location: Location) {
    if (!window.matrixChat) return;

    console.log("Routing URL ", location.href);
    const s = getScreenFromLocation(location);
    (window.matrixChat as MatrixChatType).showScreen(s.screen, s.params);
}

function onHashChange(ev: HashChangeEvent) {
    if (decodeURIComponent(window.location.hash) === lastLocationHashSet) {
        // we just set this: no need to route it!
        return;
    }
    routeUrl(window.location);
}

// This will be called whenever the SDK changes screens,
// so a web page can update the URL bar appropriately.
function onNewScreen(screen: string, replaceLast = false) {
    console.log("newscreen " + screen);
    const hash = '#/' + screen;
    lastLocationHashSet = hash;

    if (replaceLast) {
        window.location.replace(hash);
    } else {
        window.location.assign(hash);
    }
}

// We use this to work out what URL the SDK should
// pass through when registering to allow the user to
// click back to the client having registered.
// It's up to us to recognise if we're loaded with
// this URL and tell MatrixClient to resume registration.
//
// If we're in electron, we should never pass through a file:// URL otherwise
// the identity server will try to 302 the browser to it, which breaks horribly.
// so in that instance, hardcode to use app.element.io for now instead.
function makeRegistrationUrl(params: object) {
    let url;
    if (window.location.protocol === "vector:") {
        url = 'https://app.element.io/#/register';
    } else {
        url = (
            window.location.protocol + '//' +
            window.location.host +
            window.location.pathname +
            '#/register'
        );
    }

    const keys = Object.keys(params);
    for (let i = 0; i < keys.length; ++i) {
        if (i === 0) {
            url += '?';
        } else {
            url += '&';
        }
        const k = keys[i];
        url += k + '=' + encodeURIComponent(params[k]);
    }
    return url;
}

function onTokenLoginCompleted() {
    // if we did a token login, we're now left with the token, hs and is
    // url as query params in the url; a little nasty but let's redirect to
    // clear them.
    const url = new URL(window.location.href);

    url.searchParams.delete("loginToken");

    console.log(`Redirecting to ${url.href} to drop loginToken from queryparams`);
    window.history.replaceState(null, "", url.href);
}

export async function loadApp(fragParams: {}) {
    window.addEventListener('hashchange', onHashChange);

    const platform = PlatformPeg.get();

    const params = parseQs(window.location);

    const urlWithoutQuery = window.location.protocol + '//' + window.location.host + window.location.pathname;
    console.log("Vector starting at " + urlWithoutQuery);

    (platform as VectorBasePlatform).startUpdater();

    // Don't bother loading the app until the config is verified
    const config = await verifyServerConfig(fragParams);

    // Before we continue, let's see if we're supposed to do an SSO redirect
    const [userId] = await Lifecycle.getStoredSessionOwner();
    const hasPossibleToken = !!userId;
    const isReturningFromSso = !!params.loginToken;
    const autoRedirect = config['sso_immediate_redirect'] === true;
    if (!hasPossibleToken && !isReturningFromSso && autoRedirect) {
        console.log("Bypassing app load to redirect to SSO");
        const tempCli = createClient({
            baseUrl: config['validated_server_config'].hsUrl,
            idBaseUrl: config['validated_server_config'].isUrl,
        });
        PlatformPeg.get().startSingleSignOn(tempCli, "sso", `/${getScreenFromLocation(window.location).screen}`);

        // We return here because startSingleSignOn() will asynchronously redirect us. We don't
        // care to wait for it, and don't want to show any UI while we wait (not even half a welcome
        // page). As such, just don't even bother loading the MatrixChat component.
        return;
    }

    const MatrixChat = sdk.getComponent('structures.MatrixChat');
    return <MatrixChat
        onNewScreen={onNewScreen}
        makeRegistrationUrl={makeRegistrationUrl}
        config={config}
        realQueryParams={params}
        startingFragmentQueryParams={fragParams}
        enableGuest={!config.disable_guests}
        onTokenLoginCompleted={onTokenLoginCompleted}
        initialScreenAfterLogin={getScreenFromLocation(window.location)}
        defaultDeviceDisplayName={platform.getDefaultDeviceDisplayName()}
    />;
}

async function verifyServerConfig(fragParams) {
    let validatedConfig;
    try {
        console.log("Verifying homeserver configuration");

        // Note: the query string may include is_url and hs_url - we only respect these in the
        // context of email validation. Because we don't respect them otherwise, we do not need
        // to parse or consider them here.

        // Note: Although we throw all 3 possible configuration options through a .well-known-style
        // verification, we do not care if the servers are online at this point. We do moderately
        // care if they are syntactically correct though, so we shove them through the .well-known
        // validators for that purpose.

        let discoveryResult = null;

        const config = SdkConfig.get();
        let wkConfig = config['default_server_config']; // overwritten later under some conditions

        let serverName = null;
        if (fragParams.serverName) {
            serverName = fragParams.serverName;
        } else {
            serverName = config['default_server_name'];
            const hsUrl = config['default_hs_url'];
            const isUrl = config['default_is_url'];

            const incompatibleOptions = [wkConfig, serverName, hsUrl].filter(i => !!i);
            if (incompatibleOptions.length > 1) {
                // noinspection ExceptionCaughtLocallyJS
                throw newTranslatableError(_td(
                    "Invalid configuration: can only specify one of default_server_config, default_server_name, " +
                    "or default_hs_url.",
                ));
            }
            if (incompatibleOptions.length < 1) {
                // noinspection ExceptionCaughtLocallyJS
                throw newTranslatableError(_td("Invalid configuration: no default server specified."));
            }

            if (hsUrl) {
                console.log("Config uses a default_hs_url - constructing a default_server_config using this " +
                            "information");
                console.warn(
                    "DEPRECATED CONFIG OPTION: In the future, default_hs_url will not be accepted. Please use " +
                    "default_server_config instead.",
                );

                wkConfig = {
                   "m.homeserver": {
                       "base_url": hsUrl,
                   },
                };
                if (isUrl) {
                    wkConfig["m.identity_server"] = {
                       "base_url": isUrl,
                    };
                }
            }

            if (wkConfig) {
                console.log("Config uses a default_server_config - validating object");
                discoveryResult = await AutoDiscovery.fromDiscoveryConfig(wkConfig);
            }
        }

        if (serverName) {
            console.log("Config uses a default_server_name - doing .well-known lookup");
            console.warn(
                "DEPRECATED CONFIG OPTION: In the future, default_server_name will not be accepted. Please " +
                "use default_server_config instead.",
            );
            discoveryResult = await AutoDiscovery.findClientConfig(serverName);
        }

        validatedConfig = AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(serverName, discoveryResult, true);
    } catch (e) {
        const { hsUrl, isUrl, userId } = await Lifecycle.getStoredSessionVars();
        if (hsUrl && userId) {
            console.error(e);
            console.warn("A session was found - suppressing config error and using the session's homeserver");

            console.log("Using pre-existing hsUrl and isUrl: ", { hsUrl, isUrl });
            validatedConfig = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, isUrl, true);
        } else {
            // the user is not logged in, so scream
            throw e;
        }
    }

    validatedConfig.isDefault = true;

    // Just in case we ever have to debug this
    console.log("Using homeserver config:", validatedConfig);

    // Add the newly built config to the actual config for use by the app
    console.log("Updating SdkConfig with validated discovery information");
    SdkConfig.add({ "validated_server_config": validatedConfig });

    return SdkConfig.get();
}
