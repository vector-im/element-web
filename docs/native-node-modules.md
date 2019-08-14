# Native Node Modules

Since v???, the electron version of Riot can make use of native node modules.
These allow Riot to integrate with the desktop in ways that a browser cannot.

While handy, these modules must be compiled and are thus downloaded
pre-compiled during build so that a single OS can compile Riot for all
platforms. If you would like to compile the native node modules from source,
as is done for Riot releases, instead of trusting binaries hosted on npm,
then please read on.

Do note that compiling a module for a particular operating system
(Linux/Mac/Windows) and will need to be done on that operating system.

## Compiling iohook

[iohook](https://github.com/matrix-org/iohook/) is a native node module
written in C/C++ that allows for cross-platform capturing of keystrokes. This
is used for providing Push-to-Talk functionality (pressing a key to toggle
the microphone in a call) and is ONLY enabled during a call and while setting
the keybinding in settings.

If you would like to rebuild the module yourself and replace the downloaded
binaries, then first make sure you have the following dependencies:

**Common:**
- `npm`, `yarn`

**Linux:**
- `apt install build-essentials cmake`

**MacOS:**
- Xcode developer tools
- `brew`
- Then `brew install cmake automake libtool pkg-config`

**Windows:**
- unsupported

Then simply execute `build-native-modules.sh` with the following flags:

```bash
./scripts/build-native-modules.sh -e 4.2.6 -a 69 -i
```

`-e` specifies the electron version. Note that the latest electron version can
always be found in riot-web's `package.json`. `-a` specifies the electron ABI
version, and `-i` tells the script to build iohook and then install it.

If you'd just like to build the module without installing it, use `-I` instead.

```bash
./scripts/build-native-modules.sh -e 4.2.6 -a 69 -I
```

To start Riot web, use `npx electron .`. To package, use `build -wml -ia32 --x64`.
