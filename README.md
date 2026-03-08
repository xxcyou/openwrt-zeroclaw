# openwrt-zeroclaw

This repository is intended to be placed under the OpenWrt `package/` directory.

Expected layout inside an OpenWrt tree:

```text
openwrt/
└── package/
    └── openwrt-zeroclaw/
        ├── zeroclaw/
        ├── luci-app-zeroclaw/
        └── README.md
```

## Why the package paths look this way

- `zeroclaw/Makefile` includes `$(TOPDIR)/feeds/packages/lang/rust/rust-package.mk`
- this matches OpenWrt trees where Rust packaging support is provided by the `packages` feed
- `luci-app-zeroclaw/Makefile` includes `$(TOPDIR)/feeds/luci/luci.mk`, which assumes the LuCI feed is already installed in the OpenWrt build tree

## Current scope

The current repository contains an initial OpenWrt package skeleton:

- `zeroclaw/`: runtime package, UCI defaults, procd init script, TOML renderer
- `luci-app-zeroclaw/`: LuCI menu, ACL, and a first settings/status page

This is an integration scaffold, not yet a fully validated OpenWrt release package.

## Where the LuCI package should appear in menuconfig

If package discovery is working, the LuCI frontend package should appear under:

- `LuCI -> Applications -> luci-app-zeroclaw`

If the symbol is visible but cannot be selected, the most likely cause is that
its LuCI/runtime dependencies are still disabled in your OpenWrt configuration.

Current package dependencies:

- `luci-base`
- `rpcd-mod-file`
- `zeroclaw`

Typical fix path in `menuconfig`:

1. enable `LuCI -> Collections -> luci`, or at minimum `luci-base`
2. enable `rpcd-mod-file`
3. return to `LuCI -> Applications -> luci-app-zeroclaw`

If `PACKAGE_luci-app-zeroclaw` is shown but greyed out while:

- `PACKAGE_luci-base = n`
- `PACKAGE_rpcd-mod-file = n`

then package discovery is already working; only dependency enablement is blocking selection.

The runtime package should appear under:

- `Utilities -> zeroclaw`

## Upstream Cargo layout confirmed

The upstream ZeroClaw repository currently has:

- root `Cargo.toml` as both workspace root and package manifest
- package name: `zeroclaw`
- package version: `0.1.9`
- binary entrypoint: `src/main.rs`
- workspace members:
  - `.`
  - `crates/robot-kit`
  - `crates/zeroclaw-types`
  - `crates/zeroclaw-core`

This means the OpenWrt package should build the repository root directly rather than pointing at a nested crate.

## musl / OpenWrt risks already visible from upstream

Several upstream dependencies are promising for musl, but a few stand out as likely build or size risks:

- good sign: `reqwest` is configured with `rustls-tls`, not OpenSSL
- good sign: upstream already includes musl target settings in `.cargo/config.toml`
- risk: `rust-version = "1.87"` may be newer than the Rust toolchain in some OpenWrt trees
- risk: `rusqlite` uses `bundled`, which increases build cost and may need extra toolchain validation
- risk: `ring` and `rustls` must be verified on each OpenWrt target architecture
- risk: `wasmtime` is currently a non-optional dependency, which may significantly increase build time and binary size
- risk: the upstream dependency tree is large enough that low-RAM targets may be impractical even if compilation succeeds

## Practical implication for the next step

The next technical checkpoint is no longer package path cleanup. It is:

1. validate that the OpenWrt Rust toolchain is new enough for `rust-version = 1.87`
2. attempt a real package compile against `musl`
3. identify whether `wasmtime`, `rusqlite`, `ring`, or other crates are the first blockers
4. decide whether a downstream embedded patch set is required to slim the runtime

## Next implementation focus

The next required work is to validate actual OpenWrt Rust build behavior for ZeroClaw under `musl`, then refine the package Makefile around the real upstream Cargo layout and dependencies.
