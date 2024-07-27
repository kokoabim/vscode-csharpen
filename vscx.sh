#!/bin/bash

# ==============================================================================
# vscx — Visual Studio Code Extension Management
# Spencer James (kokoabim), dev@kokoabim.com, https://swsj.me
# ==============================================================================
# The MIT License (MIT)
# All rights reserved.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
# ==============================================================================

set -eo pipefail

script_name="${0##*/}"
script_ver="1.0"
script_title="Visual Studio Code Extension Management"
script_options="bhi:oruxy"

function usage() {
    end "$script_title (v$script_ver)

Use: $script_name [-orxy]
     $script_name [-ory] -b
     $script_name [-xy] -i <package>
     $script_name [-y] -u

Options:
 -b  Build package only
 -h  View this help
 -i  Install <package> (ignore package.json)
 -o  Overwrite package (if exists)
 -r  Output package to ./releases directory
 -u  Uninstall extension only (if installed)
 -x  Uninstall extension (if installed)
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

function get_pkg_value() {
    local key="$1"
    local value=$(echo "$pkg_json_content" | egrep -m 1 -o "\"$1\":\s*\"[^\"]*" | egrep -o '[^"]*$')
    echo -n "$value"
}

action="build-install" # build-install, build, install, uninstall
pkg_file=""
pkg_directory=""
pkg_id=""
pkg_json_file="package.json"
pkg_json_content=""
pkg_name=""
pkg_version=""
pkg_publisher=""
overwrite_pkg_file=0
uninstall_extension=0
yes=0

while getopts "$script_options" OPTION; do
    case "$OPTION" in
    b) action="build" ;;
    h) usage ;;
    i)
        pkg_file="$OPTARG"
        action="install"
        ;;
    o) overwrite_pkg_file=1 ;;
    r) pkg_directory="./releases" ;;
    u) action="uninstall" ;;
    x) uninstall_extension=1 ;;
    y) yes=1 ;;
    *) usage ;;
    esac
done
shift $(($OPTIND - 1))

[[ "$1" != "" ]] && usage

[[ -f "$pkg_json_file" ]] || end "File not found: $pkg_json_file" 1

pkg_json_content=$(cat "$pkg_json_file")
[[ -z "$pkg_json_content" ]] && end "Failed to read file: $pkg_json_file" 1

pkg_name=$(get_pkg_value "name")
[[ -z "$pkg_name" ]] && end "Failed to get name from $pkg_json_file" 1

pkg_version=$(get_pkg_value "version")
[[ -z "$pkg_version" ]] && end "Failed to get version from $pkg_json_file" 1

pkg_publisher=$(get_pkg_value "publisher")
[[ -z "$pkg_publisher" ]] && end "Failed to get publisher from $pkg_json_file" 1

[[ "$pkg_file" == "" ]] && pkg_file="$pkg_name-$pkg_version.vsix"
pkg_id="$pkg_publisher.$pkg_name"

if [[ "$action" == "build-install" ]]; then
    echo "Build and install package:"
elif [[ "$action" == "build" ]]; then
    echo "Build package:"
elif [[ "$action" == "install" ]]; then
    echo "Install package:"
elif [[ "$action" == "uninstall" ]]; then
    echo "Uninstall package:"
fi
[[ "$pkg_name" != "" ]] && echo "• Name: $pkg_name"
[[ "$pkg_version" != "" ]] && echo "• Version: $pkg_version"
[[ "$pkg_publisher" != "" ]] && echo "• Publisher: $pkg_publisher"
[[ "$pkg_id" != "" ]] && echo "• ID: $pkg_id"
[[ "$action" != "uninstall" ]] && echo "• File: $pkg_file"
[[ "$pkg_directory" != "" ]] && echo "• Move to $pkg_directory directory"
[[ $overwrite_pkg_file -eq 1 ]] && echo "• Overwrite package (if exists)"
[[ $uninstall_extension -eq 1 ]] && echo "• Uninstall extension (if installed)"
confirm_run

# uninstall

if [[ "$action" =~ -?install$ ]]; then
    if code --list-extensions | grep -q "^${pkg_id}$"; then
        [[ "$action" == "uninstall" || $uninstall_extension -eq 1 ]] || end "Extension already installed: $pkg_id (use -x option to uninstall)" 1
        code --uninstall-extension "$pkg_id" || end "Failed to uninstall extension" 1
        echo "Extension uninstalled: $pkg_id"
    else
        [[ "$action" == "uninstall" ]] && end "Extension not installed: $pkg_id"
    fi
fi

# prepare for file

[[ "$pkg_directory" != "" ]] && pkg_file="${pkg_directory}/${pkg_file}"

if [[ "$action" == "install" ]]; then
    [[ ! -f "$pkg_file" ]] && end "File not found: $pkg_file" 1
elif [[ "$action" =~ ^build.*$ ]]; then
    if [[ -f "$pkg_file" ]]; then
        if [[ $overwrite_pkg_file -eq 1 ]]; then
            rm -f "$pkg_file" || end "Failed to remove file: $pkg_file" 1
            echo "File removed: $pkg_file"
        else
            end "File already exists: $pkg_file (use -o option to overwrite)" 1
        fi
    fi

    if [[ "$pkg_directory" != "" ]] && [[ ! -d "$pkg_directory" ]]; then
        mkdir -p "$pkg_directory" || end "Failed to create directory: $pkg_directory" 1
        echo "Directory created: $pkg_directory"
    fi
fi

# build

if [[ "$action" =~ ^build.*$ ]]; then
    npm prune --omit=dev || end "Failed to build package" 1

    vsce package -o "$pkg_file" || end "Failed to build package" 1
    [[ -f "$pkg_file" ]] || end "File not found: $pkg_file" 1
    echo "Package built: $pkg_file"

    npm install || true # replace omitted dev dependencies
fi

# install

if [[ "$action" =~ ^(build-)?install$ ]]; then
    code --install-extension "$pkg_file" || end "Failed to install package" 1
    echo "Package installed: $pkg_file"
fi
