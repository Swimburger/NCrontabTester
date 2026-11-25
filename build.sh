#!/bin/sh
set -eu

sdk_channel="11.0"

if command -v dotnet >/dev/null 2>&1 && dotnet --version >/dev/null 2>&1; then
  dotnet_command="dotnet"
else
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o .dotnet-install.sh
  chmod +x .dotnet-install.sh
  ./.dotnet-install.sh --channel "$sdk_channel" --quality GA --install-dir ./.dotnet
  dotnet_command="./.dotnet/dotnet"
fi

if ! "$dotnet_command" workload list | grep -q '^wasm-tools[[:space:]]'; then
  "$dotnet_command" workload install wasm-tools
fi

rm -rf ./dist
"$dotnet_command" publish NCrontabTester.csproj --configuration Release --output dist --disable-build-servers -p:UseSharedCompilation=false
