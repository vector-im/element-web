Riot
====

Riot (formerly known as Vector) is a Matrix web client built using the [Matrix
React SDK](https://github.com/matrix-org/matrix-react-sdk).

Supported Environments
======================

Riot has several tiers of support for different environments:

* Supported
  * Definition: Issues **actively triaged**, regressions **block** the release
  * Last 2 major versions of Chrome, Firefox, and Safari on desktop OSes
  * Latest release of official Riot Desktop app on desktop OSes
  * Desktop OSes means macOS, Windows, and Linux versions for desktop devices
    that are actively supported by the OS vendor and receive security updates
* Experimental
  * Definition: Issues **accepted**, regressions **do not block** the release
  * Riot as an installed PWA via current stable version of Chrome, Firefox, and Safari
  * Mobile web for current stable version of Chrome, Firefox, and Safari on Android, iOS, and iPadOS
* Not supported
  * Definition: Issues only affecting unsupported environments are **closed**
  * Everything else

For accessing Riot on an Android or iOS device, we currently recommend the
native apps [riot-android](https://github.com/vector-im/riot-android)
and [riot-ios](https://github.com/vector-im/riot-ios).

Getting Started
===============

The easiest way to test Riot is to just use the hosted copy at https://riot.im/app.
The `develop` branch is continuously deployed by Jenkins at https://riot.im/develop
for those who like living dangerously.

To host your own copy of Riot, the quickest bet is to use a pre-built
released version of Riot:

1. Download the latest version from https://github.com/vector-im/riot-web/releases
1. Untar the tarball on your web server
1. Move (or symlink) the `riot-x.x.x` directory to an appropriate name
1. Configure the correct caching headers in your webserver (see below)
1. If desired, copy `config.sample.json` to `config.json` and edit it
   as desired. See the [configuration docs](docs/config.md) for details.
1. Enter the URL into your browser and log into Riot!

Releases are signed using gpg and the OpenPGP standard, and can be checked against the public key located
at https://packages.riot.im/riot-release-key.asc.

Note that for the security of your chats will need to serve Riot
over HTTPS. Major browsers also do not allow you to use VoIP/video
chats over HTTP, as WebRTC is only usable over HTTPS.
There are some exceptions like when using localhost, which is
considered a [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts)
and thus allowed.

To install Riot as a desktop application, see [Running as a desktop
app](#running-as-a-desktop-app) below.

Important Security Note
=======================

We do not recommend running Riot from the same domain name as your Matrix
homeserver.  The reason is the risk of XSS (cross-site-scripting)
vulnerabilities that could occur if someone caused Riot to load and render
malicious user generated content from a Matrix API which then had trusted
access to Riot (or other apps) due to sharing the same domain.

We have put some coarse mitigations into place to try to protect against this
situation, but it's still not good practice to do it in the first place.  See
https://github.com/vector-im/riot-web/issues/1977 for more details.

Building From Source
====================

Riot is a modular webapp built with modern ES6 and uses a Node.js build system.
Ensure you have the latest LTS version of Node.js installed.

Using `yarn` instead of `npm` is recommended. Please see the Yarn [install
guide](https://yarnpkg.com/docs/install/) if you do not have it already.

1. Install or update `node.js` so that your `node` is at least v10.x.
1. Install `yarn` if not present already.
1. Clone the repo: `git clone https://github.com/vector-im/riot-web.git`.
1. Switch to the riot-web directory: `cd riot-web`.
1. Install the prerequisites: `yarn install`.
   *  If you're using the `develop` branch, then it is recommended to set up a
      proper development environment (see [Setting up a dev
      environment](#setting-up-a-dev-environment) below). Alternatively, you
      can use https://riot.im/develop - the continuous integration release of
      the develop branch.
1. Configure the app by copying `config.sample.json` to `config.json` and
   modifying it. See the [configuration docs](docs/config.md) for details.
1. `yarn dist` to build a tarball to deploy. Untaring this file will give
   a version-specific directory containing all the files that need to go on your
   web server.

Note that `yarn dist` is not supported on Windows, so Windows users can run `yarn build`,
which will build all the necessary files into the `webapp` directory. The version of Riot
will not appear in Settings without using the dist script. You can then mount the
`webapp` directory on your webserver to actually serve up the app, which is entirely static content.

Running as a Desktop app
========================

Riot can also be run as a desktop app, wrapped in Electron. You can download a
pre-built version from https://riot.im/download/desktop/ or, if you prefer,
build it yourself.

To build it yourself, follow the instructions below.

1. Follow the instructions in 'Building From Source' above, but run
   `yarn build` instead of `yarn dist` (since we don't need the tarball).
2. Install Electron and run it:

   ```bash
   yarn electron
   ```

To build packages, use `electron-builder`. This is configured to output:
 * `dmg` + `zip` for macOS
 * `exe` + `nupkg` for Windows
 * `deb` for Linux
But this can be customised by editing the `build` section of package.json
as per https://github.com/electron-userland/electron-builder/wiki/Options

See https://github.com/electron-userland/electron-builder/wiki/Multi-Platform-Build
for dependencies required for building packages for various platforms.

The only platform that can build packages for all three platforms is macOS:
```bash
brew install mono
yarn install
yarn build:electron
```

For other packages, use `electron-builder` manually. For example, to build a
package for 64 bit Linux:

 1. Follow the instructions in 'Building From Source' above
 2. `node_modules/.bin/build -l --x64`

All Electron packages go into `electron_app/dist/`

Many thanks to @aviraldg for the initial work on the Electron integration.

Other options for running as a desktop app:
 * @asdf:matrix.org points out that you can use nativefier and it just works(tm)

```bash
yarn global add nativefier
nativefier https://riot.im/app/
```

The [configuration docs](docs/config.md#desktop-app-configuration) show how to
override the desktop app's default settings if desired.

Running from Docker
===================

The Docker image can be used to serve riot-web as a web server. The easiest way to use
it is to use the prebuilt image:
```bash
docker run -p 80:80 vectorim/riot-web
```

To supply your own custom `config.json`, map a volume to `/app/config.json`. For example,
if your custom config was located at `/etc/riot-web/config.json` then your Docker command
would be:
```bash
docker run -p 80:80 -v /etc/riot-web/config.json:/app/config.json vectorim/riot-web
```

To build the image yourself:
```bash
git clone https://github.com/vector-im/riot-web.git riot-web
cd riot-web
git checkout master
docker build -t vectorim/riot-web .
```

If you're building a custom branch, or want to use the develop branch, check out the appropriate
riot-web branch and then run:
```bash
docker build -t vectorim/riot-web:develop \
    --build-arg USE_CUSTOM_SDKS=true \
    --build-arg REACT_SDK_REPO="https://github.com/matrix-org/matrix-react-sdk.git" \
    --build-arg REACT_SDK_BRANCH="develop" \
    --build-arg JS_SDK_REPO="https://github.com/matrix-org/matrix-js-sdk.git" \
    --build-arg JS_SDK_BRANCH="develop" \
    .
```

config.json
===========

Riot supports a variety of settings to configure default servers, behaviour, themes, etc.
See the [configuration docs](docs/config.md) for more details.

Labs Features
=============

Some features of Riot may be enabled by flags in the `Labs` section of the settings.
Some of these features are described in [labs.md](https://github.com/vector-im/riot-web/blob/develop/docs/labs.md).

Caching requirements
====================

Riot requires the following URLs not to be cached, when/if you are serving Riot from your own webserver:
```
/config.*.json
/i18n
/home
/sites
/index.html
```

Development
===========

Before attempting to develop on Riot you **must** read the [developer guide
for `matrix-react-sdk`](https://github.com/matrix-org/matrix-react-sdk), which
also defines the design, architecture and style for Riot too.

You should also familiarise yourself with the ["Here be Dragons" guide
](https://docs.google.com/document/d/12jYzvkidrp1h7liEuLIe6BMdU0NUjndUYI971O06ooM)
to the tame & not-so-tame dragons (gotchas) which exist in the codebase.

The idea of Riot is to be a relatively lightweight "skin" of customisations on
top of the underlying `matrix-react-sdk`. `matrix-react-sdk` provides both the
higher and lower level React components useful for building Matrix communication
apps using React.

After creating a new component you must run `yarn reskindex` to regenerate
the `component-index.js` for the app (used in future for skinning).

Please note that Riot is intended to run correctly without access to the public
internet.  So please don't depend on resources (JS libs, CSS, images, fonts)
hosted by external CDNs or servers but instead please package all dependencies
into Riot itself.

Setting up a dev environment
============================

Much of the functionality in Riot is actually in the `matrix-react-sdk` and
`matrix-js-sdk` modules. It is possible to set these up in a way that makes it
easy to track the `develop` branches in git and to make local changes without
having to manually rebuild each time.

First clone and build `matrix-js-sdk`:

``` bash
git clone https://github.com/matrix-org/matrix-js-sdk.git
pushd matrix-js-sdk
git checkout develop
yarn link
yarn install
popd
```

Then similarly with `matrix-react-sdk`:

```bash
git clone https://github.com/matrix-org/matrix-react-sdk.git
pushd matrix-react-sdk
git checkout develop
yarn link
yarn link matrix-js-sdk
yarn install
popd
```

Finally, build and start Riot itself:

```bash
git clone https://github.com/vector-im/riot-web.git
cd riot-web
git checkout develop
yarn link matrix-js-sdk
yarn link matrix-react-sdk
yarn install
yarn start
```

Wait a few seconds for the initial build to finish; you should see something like:
```
Hash: b0af76309dd56d7275c8
Version: webpack 1.12.14
Time: 14533ms
         Asset     Size  Chunks             Chunk Names
     bundle.js   4.2 MB       0  [emitted]  main
    bundle.css  91.5 kB       0  [emitted]  main
 bundle.js.map  5.29 MB       0  [emitted]  main
bundle.css.map   116 kB       0  [emitted]  main
    + 1013 hidden modules
```
   Remember, the command will not terminate since it runs the web server
   and rebuilds source files when they change. This development server also
   disables caching, so do NOT use it in production.

Configure the app by copying `config.sample.json` to `config.json` and
modifying it. See the [configuration docs](docs/config.md) for details.

Open http://127.0.0.1:8080/ in your browser to see your newly built Riot.

___

When you make changes to `matrix-react-sdk` or `matrix-js-sdk` they should be
automatically picked up by webpack and built.

If you add or remove any components from the Riot skin, you will need to rebuild
the skin's index by running, `yarn reskindex`.

If any of these steps error with, `file table overflow`, you are probably on a mac
which has a very low limit on max open files. Run `ulimit -Sn 1024` and try again.
You'll need to do this in each new terminal you open before building Riot.

Using Docker image for development
----------------------------------

Avoids installation of Node, NPM and the rest of the environment by providing
the same environment that's used in serving Riot via Dockerfile officially
and at the same time allows to plug in the folder with source files so that
you can edit outside of Docker container and let it compile inside where
it is safely separated from your machine or any custom configuration.

Note that hot-reloading via an open websocket might not work out of the box
on Windows, check [WebPack ``watchOptions.poll``](https://webpack.js.org/configuration/watch/)
as a workaround.

Using this approach provides a reproducible environment between you and
the maintainers if you share your changes in a pull request.

Run it with:

```bash
# build image
docker build --tag vectorim/riot-web:develop --file Dockerfile.develop .

# remove old container or do nothing
docker rm -f riot || true

# run a new container with src folder mounted from git repository
# located on the host machine. You can mount additional folders
# such as res with additional --volume $PWD/res:/src/res
docker run --interactive --tty \
    --publish <port-on-host>:8080 \
    --volume $PWD/src:/riot/src \
    --name riot \
    vectorim/riot-web:develop
```

And access ``yarn`` and other commands from inside of the container:

```bash
# run shell process from container
docker exec -it riot sh

# run yarn process from container
docker exec -it riot yarn
```

In case you want to use own clones of
[matrix-react-sdk](https://github.com/matrix-org/matrix-react-sdk)
or
[matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
set additional environment variable ``USE_CUSTOM_SDKS`` in ``docker build``
if it's a one-time operation. In case you want to use own clone and edit
it at the same time as you edit ``riot-web``, set the environement
variable in ``docker run`` command.

```bash
docker run --interactive --tty \
    --publish <port-on-host>:8080 \
    --volume $PWD/src:/riot/src \
    --volume <path-to-matrix-js-sdk>:/riot/js-sdk \
    --volume <path-to-matrix-react-sdk>:/riot/react-sdk \
    --env USE_CUSTOM_SDKS=true \
    --env NO_CLONE=true \
    --name riot \
    vectorim/riot-web:develop
```

Running the tests
-----------------

There are a number of application-level tests in the `tests` directory; these
are designed to run in a browser instance under the control of
[karma](https://karma-runner.github.io). To run them:

* Make sure you have Chrome installed (a recent version, like 59)
* Make sure you have `matrix-js-sdk` and `matrix-react-sdk` installed and
  built, as above
* `yarn test`

The above will run the tests under Chrome in a `headless` mode.

You can also tell karma to run the tests in a loop (every time the source
changes), in an instance of Chrome on your desktop, with `yarn
test-multi`. This also gives you the option of running the tests in 'debug'
mode, which is useful for stepping through the tests in the developer tools.

### End-to-End tests

See [matrix-react-sdk](https://github.com/matrix-org/matrix-react-sdk/#end-to-end-tests) how to run the end-to-end tests.

Translations
============

To add a new translation, head to the [translating doc](docs/translating.md).

For a developer guide, see the [translating dev doc](docs/translating-dev.md).

[<img src="https://translate.riot.im/widgets/riot-web/-/multi-auto.svg" alt="translationsstatus" width="340">](https://translate.riot.im/engage/riot-web/?utm_source=widget)

Triaging issues
===============

Issues will be triaged by the core team using the below set of tags.

Tags are meant to be used in combination - e.g.:
 * P1 critical bug == really urgent stuff that should be next in the bugfixing todo list
 * "release blocker" == stuff which is blocking us from cutting the next release.
 * P1 feature type:voip == what VoIP features should we be working on next?

priority: **compulsory**

* P1: top priority - i.e. pool of stuff which we should be working on next
* P2: still need to fix, but lower than P1
* P3: non-urgent
* P4: interesting idea - bluesky some day
* P5: recorded for posterity/to avoid duplicates. No intention to resolves right now.

bug or feature: **compulsory**

* bug
* feature

bug severity: **compulsory, if bug**

* critical - whole app doesn't work
* major - entire feature doesn't work
* minor - partially broken feature (but still usable)
* cosmetic - feature works functionally but UI/UX is broken

types
* type:* - refers to a particular part of the app; used to filter bugs
  on a given topic - e.g. VOIP, signup, timeline, etc.

additional categories (self-explanatory):

* release blocker
* ui/ux (think of this as cosmetic)
* network (specific to network conditions)
* platform specific
* accessibility
* maintenance
* performance
* i18n
* blocked - whether this issue currently can't be progressed due to outside factors

community engagement
* easy
* hacktoberfest
* bounty? - proposal to be included in a bounty programme
* bounty - included in Status Open Bounty
