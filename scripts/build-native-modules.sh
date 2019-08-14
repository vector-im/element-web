#!/bin/bash
# 
# Builds and installs native node modules. This script must be run from riot-web's
# root
#
# Dependencies
#
# iohook
#   Common:
#   - npm, yarn
# 
#   Linux:
#   - apt install build-essentials cmake
#
#   MacOS:
#   - Xcode developer tools
#   - brew
#   - brew install cmake automake libtool pkg-config
#
#   Windows:
#   - unsupported

set -e

usage() {
  echo "Usage: $0 -e <electron_version> -a <electron_abi> [-i] [-I]"
  echo
  echo "version:"
  echo "  Electron version to use"
  echo "  Ex: 4.2.6"
  echo "electron_abi:"
  echo "  ABI of the chosen electron version"
  echo "  Electron v4.2.6's ABI is 69"
  echo "i:"
  echo "  Build the iohook native node module for Push-to-Talk functionality"
  echo "  and install it"
  echo "I:"
  echo "  Same as -i, but just output the node module in the current directory"
}

while getopts "e:a:iI" opt; do
  case $opt in
    e)
      electron_version=$OPTARG
      ;;
    a)
      electron_abi=$OPTARG
      ;;
    i)
      iohook=1
      ;;
    I)
      iohook_export=1
      ;;
    \?)
      echo "Invalid option: -$OPTARG" >&2
      usage
      exit
      ;;
  esac
done

if [ -z ${electron_version+x} ]; then
  echo "No Electron version supplied"
  usage
  exit 1
fi

if [ -z ${electron_abi+x} ]; then
  echo "No Electron ABI supplied"
  usage
  exit 1
fi

if [ -z ${iohook+x} ] && [ -z ${iohook_export+x} ]; then
  echo "Please specify a module to build"
  usage
  exit 1
fi

echo "Detecting OS..."
case "$OSTYPE" in
  darwin*)
    echo "Found MacOS"
    ostype="darwin"
    ;;
  msys*)
    if ! [ -z ${iohook+x} ] || ! [ -z ${iohook_export+x} ]; then
      echo "Building iohook on Windows is unsupported at this time"
      exit 1
    fi
    ostype="win"
    ;;
  *)
    echo "Found Linux."
    ostype="linux"
    ;;
esac

echo "Detecting architecture..."
MACHINE_TYPE=`uname -m`
if [ ${MACHINE_TYPE} == "x86_64" ]; then
  echo "Found 64 bit..."
  osarch="64"
else
  echo "Found 32 bit..."
  osarch="32"
fi

# Clean
echo "Cleaning build files..."
yarn clean

if ! [ -z ${iohook+x} ] || ! [ -z ${iohook_export+x} ]; then
  # Get dependencies
  echo "Getting dependencies..."
  yarn

  # Riot currently does not install the correct electron version, so collect it
  # manually
  yarn add electron@v$electron_version

  # Build iohook
  echo "Building iohook..."
  cd electron_app

  # iohook attempts to download a pre-built package for node ABI v72, which does
  # not exist
  yarn || echo "Ignoring broken pre-build packages"
  cd node_modules
  rm -rf iohook
  git clone https://github.com/matrix-org/iohook
  cd iohook
  npm i || echo "Ignoring broken pre-build packages"
  rm -rf builds/*
  npm run build # This builds libuiohook
  node build.js --runtime electron --version $electron_version --abi $electron_abi --no-upload # Builds the module for the current OS/node version

  if [ -z ${iohook_export} ]; then
    # Install
    echo "Installing built package"
    folder="electron-v$electron_abi-$ostype-x$osarch"
    mkdir -p builds/$folder/build/Release
    cp build/Release/iohook.node builds/$folder/build/Release/
  else
    # Just export
    cp build/Release/iohook.node ../../../iohook.node
  fi
fi

echo "Done!"
