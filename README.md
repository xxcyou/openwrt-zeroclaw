# openwrt-zeroclaw

[中文说明 / Chinese README](./README.zh-CN.md)

OpenWrt packaging and LuCI integration for [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw).

This repository is designed to live inside an OpenWrt build tree under `package/`.
It is not a standalone application repository with its own root-level build or test workflow.

## Repository layout

```text
openwrt/
└── package/
    └── openwrt-zeroclaw/
        ├── zeroclaw/
        ├── luci-app-zeroclaw/
        ├── README.md
        └── README.zh-CN.md
```

### Packages in this repo

- `zeroclaw/`
  - OpenWrt runtime package
  - installs the upstream `zeroclaw` binary
  - provides UCI defaults, a procd init script, and a UCI → TOML renderer
- `luci-app-zeroclaw/`
  - LuCI frontend package
  - provides menu entries, ACL definitions, i18n, and a multi-page ZeroClaw management UI

## What this repo currently provides

This repository already includes:

- OpenWrt package metadata for the ZeroClaw runtime
- LuCI package metadata for `luci-app-zeroclaw`
- a procd-managed init script
- UCI-backed ZeroClaw configuration
- rendering from `/etc/config/zeroclaw` to `/etc/zeroclaw/config.toml`
- a LuCI UI with pages for:
  - overview
  - onboarding
  - settings
  - diagnostics

This is best understood as an OpenWrt integration layer for ZeroClaw.

## Current default UCI config surface

The runtime package currently manages this core config set:

- `enabled`
- `host`
- `port`
- `allow_public_bind`
- `provider`
- `api_base`
- `model`
- `api_key`
- `workspace`
- `log_level`

These values are translated by `zeroclaw/files/usr/libexec/zeroclaw/render-config.sh` into a generated TOML config.

## Expected OpenWrt dependencies

The LuCI package currently depends on:

- `luci-base`
- `zeroclaw`

If your build tree or local changes add more LuCI-side runtime requirements, enable them in `menuconfig` as needed.

## Build tree assumptions

This repo assumes:

- OpenWrt buildroot is available
- LuCI feed is installed
- `packages` feed is installed with Rust packaging support

Relevant includes used here:

- `zeroclaw/Makefile` includes `$(TOPDIR)/feeds/packages/lang/rust/rust-package.mk`
- `luci-app-zeroclaw/Makefile` includes `$(TOPDIR)/feeds/luci/luci.mk`

## Package selection in menuconfig

From the OpenWrt tree root:

```sh
make menuconfig
```

Enable:

- `Utilities -> zeroclaw`
- `LuCI -> Applications -> luci-app-zeroclaw`

If `luci-app-zeroclaw` is visible but cannot be selected, the most common cause is missing LuCI dependencies in the OpenWrt configuration.

## Build commands

Run these commands from the OpenWrt tree root, not from this repository root alone.

### Build the runtime package

```sh
make package/zeroclaw/compile V=s
```

### Build the LuCI package

```sh
make package/luci-app-zeroclaw/compile V=s
```

### Rebuild after changing package files

```sh
make package/zeroclaw/{clean,compile} V=s
make package/luci-app-zeroclaw/{clean,compile} V=s
```

### Full build

```sh
make -j$(nproc) V=s
```

## Validation workflow

There is no repository-local automated test suite yet.
Practical validation is currently package-level and runtime-level:

1. compile the affected OpenWrt package
2. install on a target device or emulator
3. verify runtime and LuCI behavior manually

Useful target-device commands:

```sh
/etc/init.d/zeroclaw start
/etc/init.d/zeroclaw stop
/etc/init.d/zeroclaw restart
/etc/init.d/zeroclaw enable
/etc/init.d/zeroclaw disable
/etc/init.d/zeroclaw status

zeroclaw status
zeroclaw doctor

uci show zeroclaw
cat /etc/zeroclaw/config.toml
logread | grep zeroclaw
```

## LuCI status

The LuCI frontend is already more than a basic settings page.
It currently provides a multi-page UI with:

- **Overview** — service state, quick actions, doctor output, recent logs
- **Onboarding** — first-time setup guidance, readiness checks, configuration warnings, config rendering, common operations
- **Settings** — full UCI-backed editable settings with guidance text
- **Diagnostics** — doctor output and recent logs for troubleshooting

The UI uses classic LuCI JavaScript patterns and supports Simplified Chinese translation.

## Upstream build and packaging risks

The upstream ZeroClaw project is a Rust workspace with the root `Cargo.toml` as the main package manifest.
That means the OpenWrt package builds the upstream repository root directly.

Current visible packaging risks include:

- upstream Rust toolchain requirements may be newer than some OpenWrt trees
- musl target compatibility still needs real package compile validation
- dependency size and compile cost may be significant on constrained targets
- runtime feature surface is broader than the current OpenWrt UCI/TOML wrapper exposes

## Current limitations

- no repository-local test suite
- no single-test runner
- no repo-local lint configuration
- not all upstream ZeroClaw config domains are exposed through UCI yet
- not all upstream CLI operations are surfaced in LuCI yet
- meaningful validation still depends on a real OpenWrt build tree and preferably a target device

## Roadmap direction

The current development direction is:

1. keep the OpenWrt package conservative and operator-friendly
2. expose more safe upstream ZeroClaw configuration domains through UCI
3. extend LuCI so common configuration and day-2 operations can be done without dropping to the shell
4. validate actual musl/OpenWrt build behavior against upstream changes

## Related files

- `AGENTS.md` — repository guidance for coding agents
- `OpenWrt-ZeroClaw-Adaptation-Plan.md` — adaptation context and architecture notes
