#!/bin/bash

# ==============================================================================
# npmx — NPM Tasks
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
script_ver="1.0.1"
script_title="NPM Tasks"
script_switches="bclhy"

function usage() {
    end "$script_title (v$script_ver)

Use: $script_name [-bcl] clean|install
     $script_name prepublish
     $script_name remove
     $script_name update

Actions:
 clean|e       Remove some build data$(text_red '†') and clean-install NPM package dependencies (npm-ci)
 compile|c     Compile only (tsc)
 install|i     Perform remove action and install NPM package dependencies (npm-install)
 prepublish|p  Perform remove action, install NPM package dependencies (npm-install; dev dependencies omitted) and compile for publish (tsc)
 remove|r      Remove build data$(text_red '*')
 update|u      Update NPM package dependencies except for '@types/((node)|(vscode))' and major versions (npm-update)

Switches:
 -b  Do not remove build data
 -c  Compile after install NPM package dependencies (tsc)
 -h  View this help
 -l  Run ESLint after install NPM package dependencies (eslint)
 -y  Confirm yes to run

$(text_red '*')Build data:
 ${build_data_paths[*]}

$(text_red '†')Some build data:
 ${some_build_data_paths[*]}
"
}

function end() {
    local e=$? || :
    set +e
    trap - EXIT SIGHUP SIGINT SIGQUIT SIGTERM

    local end_message="$1"
    local end_code=${2:-$e}

    if [[ "$end_message" != "" ]]; then
        if [ "$end_code" -ne 0 ]; then
            text_red "$script_name" >&2
            echo -n ": " >&2
        fi
        echo "$end_message" >&2
    fi

    exit "$end_code"
}

trap end EXIT SIGHUP SIGINT SIGQUIT SIGTERM

function text_ansi() {
    local code=$1
    shift
    echo -en "\033[${code}m$*\033[0m"
}
function text_red() { text_ansi 31 "$@"; }

function confirm_run() {
    [[ ${yes:-0} -eq 1 ]] && return

    read -r -p "${1:-Continue}? [y/N] " -n 1
    [[ $REPLY == "" ]] && echo -en "\033[1A"
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || end
}

function remove_data() { #1: path array
    set -eo pipefail

    local paths=("$@")

    for path in "${paths[@]}"; do
        if [[ -d "$path" ]]; then
            echo "Removing directory $path..."
            rm -rf "$path"
        elif [[ -f "$path" ]]; then
            echo "Removing file $path..."
            rm -f "$path"
        fi
    done
}

build_data_paths=(./.vscode-test
    ./dist
    ./node_modules
    ./package-lock.json
)
some_build_data_paths=(./.vscode-test
    ./dist
)

compile_after_install=0
compile_only=0
do_not_remove_build_data=0
npm_clean_install=0
npm_install=0
prepublish=0
remove_data_only=0
run_eslint=0
update_packages=0
yes=0

while getopts "${script_switches}" OPTION; do
    case "$OPTION" in
    b) do_not_remove_build_data=1 ;;
    c) compile_after_install=1 ;;
    h) usage ;;
    l) run_eslint=1 ;;
    y) yes=1 ;;
    *) usage ;;
    esac
done
shift $((OPTIND - 1))

script_action=$1
if [[ "$script_action" == "clean" || "$script_action" == "e" ]]; then
    npm_clean_install=1
    if [[ $do_not_remove_build_data == 0 ]]; then
        script_action="Remove some build data and clean-install NPM package dependencies"
    else
        script_action="Clean-install NPM package dependencies"
    fi
elif [[ "$script_action" == "compile" || "$script_action" == "c" ]]; then
    compile_only=1
    script_action="Compile"
elif [[ "$script_action" == "install" || "$script_action" == "i" ]]; then
    npm_install=1
    if [[ $do_not_remove_build_data == 0 ]]; then
        script_action="Remove build data and install NPM package dependencies"
    else
        script_action="Install NPM package dependencies"
    fi
elif [[ "$script_action" == "remove" || "$script_action" == "r" ]]; then
    do_not_remove_build_data=0
    remove_data_only=1
    script_action="Remove build data"
elif [[ "$script_action" == "prepublish" || "$script_action" == "p" ]]; then
    do_not_remove_build_data=0
    npm_install=1
    compile_after_install=1
    prepublish=1
    script_action="Prepublish"
elif [[ "$script_action" == "update" || "$script_action" == "u" ]]; then
    update_packages=1
    script_action="Update NPM package dependencies"
else
    usage
fi

if [[ $prepublish != 1 && $remove_data_only != 1 && $update_packages != 1 && $compile_only != 1 && $compile_after_install == 1 ]]; then # only for clean and install
    script_action="$script_action and compile"
fi

confirm_run "$script_action"

if [[ $update_packages == 1 ]]; then
    cwd=$(pwd)
    # shellcheck disable=SC2207
    outdated_packages=($(npm outdated --parseable --depth=0 | cut -d: -f1 | grep -Ev '@types/((node)|(vscode))' | sed "s/${cwd//\//\\/}\/node_modules\///")) || true

    if [[ "${outdated_packages[*]}" == "" ]]; then
        end "No packages to update."
    fi

    echo -e "Updating packages:\n${outdated_packages[*]}"
    npm update --save "${outdated_packages[@]}"

    major_versions=$(npm outdated --parseable --depth=0 | cut -d: -f4 | grep -Ev '@types/((node)|(vscode))' | sed "s/${cwd//\//\\/}\/node_modules\///") || true
    if [[ "$major_versions" != "" ]]; then
        echo
        text_red "Major versions not updated:\n"
        echo "${major_versions[@]}"
    fi

    end
fi

if [[ $do_not_remove_build_data == 0 ]]; then
    if [[ $remove_data_only == 1 || $npm_install == 1 ]]; then
        remove_data "${build_data_paths[@]}"

        if [[ $remove_data_only == 1 ]]; then
            end
        fi
    elif [[ $npm_clean_install == 1 ]]; then
        remove_data "${some_build_data_paths[@]}"
    fi
fi

if [[ $npm_clean_install == 1 ]]; then
    echo "Clean-Installing NPM package dependencies..."
    npm ci
elif [[ $npm_install == 1 ]]; then
    if [[ $prepublish == 1 ]]; then
        echo "Installing NPM package dependencies (with dev dependencies omitted)..."
        npm install # TODO: figure out why now using this switch there are errors: --omit=dev
    else
        echo "Installing NPM package dependencies..."
        npm install
    fi
fi

if [[ $run_eslint == 1 ]]; then
    echo "Running ESLint..."
    npx eslint -c ./eslint.config.mjs ./src || true
fi

if [[ $compile_only == 1 || $compile_after_install == 1 ]]; then
    if [[ $prepublish == 1 ]]; then
        echo "Compiling (for publish)..."
        tsc -p ./tsconfig.publish.json
    else
        echo "Compiling..."
        tsc -p ./tsconfig.json
    fi
fi
