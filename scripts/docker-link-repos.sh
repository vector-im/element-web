#!/bin/bash

set -ex

# Automatically link to develop if we're building develop, but only if the caller
# hasn't asked us to build something else
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ $USE_CUSTOM_SDKS == false ] && [ $BRANCH == 'develop' ]
then
    echo "using develop dependencies for react-sdk and js-sdk"
    USE_CUSTOM_SDKS=true
    JS_SDK_BRANCH='develop'
    REACT_SDK_BRANCH='develop'
fi

if [ $USE_CUSTOM_SDKS == false ]
then
    echo "skipping react-sdk and js-sdk installs: USE_CUSTOM_SDKS is false"
    exit 0
fi

echo "Linking js-sdk"
if [ -z ${NO_CLONE+x} ]
then
    git clone $JS_SDK_REPO js-sdk
    cd js-sdk
    git checkout $JS_SDK_BRANCH
    cd ..
fi
cd js-sdk
yarn link
yarn --network-timeout=100000 install
cd ../

echo "Linking react-sdk"
if [ -z ${NO_CLONE+x} ]
then
    git clone $REACT_SDK_REPO react-sdk
    cd react-sdk
    git checkout $REACT_SDK_BRANCH
    cd ..
fi
cd react-sdk
yarn link
yarn link matrix-js-sdk
yarn --network-timeout=100000 install
cd ../

echo "Setting up riot-web with react-sdk and js-sdk packages"
yarn link matrix-js-sdk
yarn link matrix-react-sdk
