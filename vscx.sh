#!/bin/bash

# ==============================================================================
# vscx — Visual Studio Code Extension Management
# Spencer James, https://swsj.me
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
script_ver="1.1"
script_title="Visual Studio Code Extension Management"
script_options="d:"
script_switches="hoxy"

function usage() {
    end "$script_title (v$script_ver)

Use: $script_name [-oxy] [-d:] pub-install|pi
     $script_name [-oy] [-d:] publish|p
     $script_name [-xy] install|i $(text_underline package)
     $script_name [-y] uninstall|u

Actions:
 install|i       Install $(text_underline package) (ignores package.json and project files)
 pub-install|pi  Publish and install package
 publish|p       Publish package
 uninstall|u     Uninstall package (if installed; uses package.json to get package ID)

Options:
 -d $(text_underline directory)  Output package to directory (default: $pkg_directory)

Switches:
 -h  View this help
 -o  Overwrite package (if exists)
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

    if [[ "$end_message" != "" ]]; then
        if [ $end_code -ne 0 ]; then
            text_red "$script_name" >&2
            echo -n ": " >&2
        fi
        echo "$end_message" >&2
    fi

    exit $end_code
}
trap end EXIT SIGHUP SIGINT SIGQUIT SIGTERM

function text_ansi() {
    local code=$1
    shift
    echo -en "\033[${code}m$@\033[0m"
}
function text_red() { text_ansi 31 "$@"; }
function text_underline() { text_ansi 4 "$@"; }

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

function install_package() { # 1: package file
    set -eo pipefail

    local pkg_file="$1"

    [[ ! -f "$pkg_file" ]] && end "File not found: $pkg_file" 1

    echo "Installing package..."
    code --install-extension "$pkg_file" || end "Failed to install package" 1
    echo "Installed package"
}

script_action="pub-install" # pub-install, publish, install, uninstall
pkg_file=""
pkg_directory="./releases"
pkg_id=""
pkg_json_file="package.json"
pkg_json_content=""
pkg_name=""
pkg_version=""
pkg_publisher=""
overwrite_pkg_file=0
uninstall_extension=0
yes=0

while getopts "${script_options}${script_switches}" OPTION; do
    case "$OPTION" in
    d) pkg_directory="$OPTARG" ;;
    h) usage ;;
    o) overwrite_pkg_file=1 ;;
    x) uninstall_extension=1 ;;
    y) yes=1 ;;
    *) usage ;;
    esac
done
shift $(($OPTIND - 1))

[[ "$1" == "" ]] && usage

script_action=$1
[[ "$script_action" =~ ^(pub-install|pi|publish|p|install|i|uninstall|u)$ ]] || end "Invalid action: $script_action" 1
[[ "$script_action" == "pi" ]] && script_action="pub-install" || true
[[ "$script_action" == "p" ]] && script_action="publish" || true
[[ "$script_action" == "i" ]] && script_action="install" || true
[[ "$script_action" == "u" ]] && script_action="uninstall" || true

if [[ "$script_action" == "install" ]]; then
    [[ "$2" == "" ]] && end "Package not specified" 1
    pkg_file="$2"

    [[ -f "$pkg_file" ]] || end "File not found: $pkg_file" 1
else
    # all other actions (other than "install")

    [[ -f "$pkg_json_file" ]] || end "File not found: $pkg_json_file" 1

    pkg_json_content=$(cat "$pkg_json_file")
    [[ -z "$pkg_json_content" ]] && end "Failed to read file: $pkg_json_file" 1

    pkg_name=$(get_pkg_value "name")
    [[ -z "$pkg_name" ]] && end "Failed to get name from $pkg_json_file" 1

    pkg_version=$(get_pkg_value "version")
    [[ -z "$pkg_version" ]] && end "Failed to get version from $pkg_json_file" 1

    pkg_publisher=$(get_pkg_value "publisher")
    [[ -z "$pkg_publisher" ]] && end "Failed to get publisher from $pkg_json_file" 1

    pkg_id="$pkg_publisher.$pkg_name"
    pkg_file="$pkg_id-$pkg_version.vsix"
fi

[[ "$pkg_directory" == "" ]] || pkg_file="${pkg_directory}/${pkg_file}"

if [[ "$script_action" == "pub-install" ]]; then
    echo "Publish and install package:"
elif [[ "$script_action" == "publish" ]]; then
    echo "Publish package:"
elif [[ "$script_action" == "install" ]]; then
    echo "Install package:"
elif [[ "$script_action" == "uninstall" ]]; then
    echo "Uninstall package:"
fi

[[ "$pkg_name" == "" ]] || echo "• Name: $pkg_name"
[[ "$pkg_version" == "" ]] || echo "• Version: $pkg_version"
[[ "$pkg_publisher" == "" ]] || echo "• Publisher: $pkg_publisher"
[[ "$pkg_id" == "" ]] || echo "• ID: $pkg_id"
[[ "$pkg_file" == "" || "$script_action" == "uninstall" ]] || echo "• Package: $pkg_file"
[[ $overwrite_pkg_file -ne 1 ]] || echo "• Overwrite package (if exists)"
[[ $uninstall_extension -ne 1 ]] || echo "• Uninstall extension (if installed)"

confirm_run

# actions: install, pub-install, uninstall

if [[ "$script_action" =~ install$ ]]; then
    if code --list-extensions | grep -q "^${pkg_id}$"; then
        [[ "$script_action" == "uninstall" || $uninstall_extension -eq 1 ]] || end "Extension already installed: $pkg_id (use -x option to uninstall)" 1

        echo "Uninstalling extension..."
        code --uninstall-extension "$pkg_id" || end "Failed to uninstall extension" 1
        echo "Uninstalled extension"
    else
        [[ "$script_action" == "uninstall" ]] && end "Extension not installed: $pkg_id"
    fi
fi

# action: install (nothing after applies to this action)

if [[ "$script_action" == "install" ]]; then
    install_package "$pkg_file"
    end
fi

# actions: pub-install, publish

if [[ "$script_action" =~ ^pub ]]; then
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

    echo "Publishing package (which runs NPM 'vscode:prepublish' script)..."
    vsce package -o "$pkg_file" || end "Failed to publish package" 1
    echo "Published package"

    echo "Installing all dependencies (since NPM 'vscode:prepublish' script omits dev dependencies)..."
    npm install || true # replace omitted dev dependencies
    echo "Installed all dependencies"
fi

# actions: pub-install

if [[ "$script_action" == "pub-install" ]]; then
    install_package "$pkg_file"
fi
