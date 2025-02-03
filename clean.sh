#!/bin/bash

set -eo pipefail

script_name="${0##*/}"
script_options="hiy"

function usage() {
    end "Clean project by removing all build files and directories

Use: $script_name [-$script_options]

Options:
 -h  View this help
 -i  Perform NPM install after cleaning
 -y  Confirm yes to run
"
}

function end() {
    local e=$? || :
    set +e
    trap - EXIT SIGHUP SIGINT SIGQUIT SIGTERM

    local end_message="$1"
    local end_code=${2:-$e}

    [[ "$end_message" != "" ]] && echo "$end_message"
    exit $end_code
}

trap end EXIT SIGHUP SIGINT SIGQUIT SIGTERM

function confirm_run() {
    [[ ${yes:-0} -eq 1 ]] && return

    read -p "${1:-Continue}? [y/N] " -n 1
    [[ $REPLY == "" ]] && echo -en "\033[1A"
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || end
}

npm_install=0
yes=0

while getopts "$script_options" OPTION; do
    case "$OPTION" in
    h) usage ;;
    i) npm_install=1 ;;
    y) yes=1 ;;
    *) usage ;;
    esac
done
shift $(($OPTIND - 1))

confirm_run "Clean project"

echo "Removing build files and directories..."
rm -rf ./.vscode-test
rm -rf ./node_modules
rm -rf ./dist
rm -f ./package-lock.json

if [[ $npm_install == 1 ]]; then
    echo "Installing NPM packages..."
    npm install
fi