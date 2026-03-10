# AGENTS.md

## Purpose

This repo contains OpenWrt package scaffolding for ZeroClaw.
Treat it as an OpenWrt integration repo, not a standalone application.
Optimize for package correctness, conservative changes, and consistency with the existing package layout.

## Repository shape

- `zeroclaw/` — runtime package: package `Makefile`, init script, UCI defaults, TOML renderer.
- `luci-app-zeroclaw/` — LuCI frontend package: LuCI `Makefile`, JS view, ACL JSON, menu JSON.
- `README.md` — explains the expected OpenWrt tree location.
- `OpenWrt-ZeroClaw-Adaptation-Plan.md` — product and architecture context, not proof that all planned code exists.

## Existing instruction files

- No pre-existing `AGENTS.md` was present.
- No `.cursorrules` file was present.
- No `.cursor/rules/` directory was present.
- No `.github/copilot-instructions.md` file was present.

If new guidance is added later, keep it aligned with this file.

## Core assumption

This repository is meant to live under `openwrt/package/openwrt-zeroclaw/` inside an OpenWrt build tree.
Do not invent local `npm`, `pnpm`, `cargo test`, `pytest`, or similar root-level workflows unless the repo later gains those files.

## Build commands

Run these from the OpenWrt tree root, not from this repository root by itself.

### Select packages

```sh
make menuconfig
```

Enable:

- `Utilities -> zeroclaw`
- `LuCI -> Applications -> luci-app-zeroclaw`

Likely prerequisites from `README.md`:

- `luci-base`
- `rpcd-mod-file`

### Compile runtime package

```sh
make package/zeroclaw/compile V=s
```

### Compile LuCI package

```sh
make package/luci-app-zeroclaw/compile V=s
```

### Full OpenWrt build

```sh
make -j$(nproc) V=s
```

### Rebuild after package-content changes

```sh
make package/zeroclaw/{clean,compile} V=s
make package/luci-app-zeroclaw/{clean,compile} V=s
```

Use clean+compile when package metadata, installed files, or LuCI assets changed.

## Lint commands

There is no repo-local lint configuration today.
No ESLint, Prettier, Biome, ShellCheck config, or local formatting script was found.

Validation should rely on:

- careful manual review
- OpenWrt package compile as the primary build check
- LuCI JS syntax sanity based on existing patterns
- shell correctness review against BusyBox/POSIX constraints

Do not claim lint coverage that does not exist.

## Test commands

There is no automated test suite in this repository.
No unit tests, integration tests, single-test runner, or CI workflows were found.

### Single test

There is no single-test command because there are no tests.
If asked to run a single test, explain that validation is currently package-level or manual runtime verification.

### Practical verification instead of tests

1. Compile the affected OpenWrt package.
2. Install on a target or emulator if available.
3. Exercise the changed runtime or LuCI behavior manually.

## Useful target-device commands

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

## Files to mimic

Use these as the primary style references:

- `zeroclaw/Makefile`
- `zeroclaw/files/etc/init.d/zeroclaw`
- `zeroclaw/files/usr/libexec/zeroclaw/render-config.sh`
- `zeroclaw/files/etc/config/zeroclaw`
- `luci-app-zeroclaw/htdocs/luci-static/resources/view/zeroclaw/settings.js`
- `luci-app-zeroclaw/root/usr/share/rpcd/acl.d/luci-app-zeroclaw.json`
- `luci-app-zeroclaw/root/usr/share/luci/menu.d/luci-app-zeroclaw.json`

## Code style guidelines

### General

- Keep changes small and package-focused.
- Prefer minimal bug fixes over opportunistic refactors.
- Preserve the current two-package layout.
- Match existing OpenWrt and LuCI conventions.
- Keep defaults conservative for router deployments.

### OpenWrt package Makefiles

- Follow the current include order: `rules.mk`, then `package.mk` or LuCI equivalent, then feed-specific include such as `rust-package.mk` or `luci.mk`.
- Use standard OpenWrt names like `PKG_NAME`, `PKG_VERSION`, `PKG_RELEASE`, `DEPENDS`, `LUCI_TITLE`, `LUCI_DEPENDS`.
- Keep metadata declarative and compact.
- Add comments only when they clarify OpenWrt-specific behavior or a non-obvious dependency.

### Shell scripts and init scripts

- Target BusyBox/POSIX `sh`, not Bash.
- Use `#!/bin/sh` or the existing OpenWrt init shebang.
- Use `set -eu` in helper scripts unless there is a clear reason not to.
- Prefer small helpers like `get_opt`, `bool_opt`, and `append_string`.
- Quote variables consistently.
- Use `local` inside shell functions where the file already follows that style.
- For init scripts, use `procd_*` APIs and `service_triggers()` rather than ad hoc process management.

### Error handling

- Fail early in shell helpers rather than silently continuing.
- In LuCI JS, graceful fallback is acceptable for status, logs, and doctor output.
- Existing LuCI pattern: promise chains may end with `.catch()` that updates UI text or notifications.
- Do not swallow important failures in packaging or config-rendering paths.

### LuCI JavaScript

- Follow the current LuCI header style using string requires such as `'require form';`, `'require rpc';`, and `'require view';`.
- Keep code in classic LuCI style; do not rewrite to modern bundler-oriented JS.
- Use `var`, matching the existing file.
- Use `return view.extend({ ... })` with `load()` and `render()` methods.
- Build forms with `form.Map`, `form.NamedSection`, and `s.option(...)`.
- Wrap user-facing strings in `_()` for translation.
- Use `E()` for DOM construction and `ui.createHandlerFn(...)` for button handlers.
- Prefer `L.resolveDefault(...)` and promise-based flows over custom wrappers.

### Naming, formatting, and types

- Keep package and service names lowercase: `zeroclaw`, `luci-app-zeroclaw`.
- Keep UCI keys lowercase with underscores, e.g. `allow_public_bind`, `api_base`, `log_level`.
- Use descriptive function names such as `refreshStatus`, `refreshLogs`, and `runDoctor`.
- Preserve existing file-local formatting.
- Use tabs where Makefiles, shell recipe contexts, LuCI JS, and JSON files already use tabs in this repo.
- There is no TypeScript here.
- Use LuCI form datatypes where appropriate, e.g. `port` and `ipaddr("nomask")`.

### Config and security expectations

- Keep the default bind conservative at `127.0.0.1` unless the user explicitly changes policy.
- Keep `allow_public_bind` opt-in.
- Avoid exposing secrets in logs or unnecessary UI output.
- Respect the existing UCI-to-TOML translation boundary instead of exposing raw upstream config wholesale.

## What not to do

- Do not add unrelated tooling just because it is common elsewhere.
- Do not assume this repo can be validated from its own root with a normal app workflow.
- Do not replace OpenWrt/LuCI idioms with generic web-app patterns.
- Do not convert shell scripts to Bashisms.
- Do not restructure package paths without explicit user direction.

## Validation checklist after edits

1. Change only the relevant package files.
2. If package metadata or installed contents changed, re-run the relevant OpenWrt package compile.
3. If LuCI changed, keep the structure aligned with `settings.js`.
4. If shell or config rendering changed, preserve quoting, defaults, cleanup, and procd behavior.
5. If service behavior changed, confirm `/etc/init.d/zeroclaw status` and `zeroclaw status` can still be exercised on target.

## Known gaps

- No automated test suite exists yet.
- No single-test runner exists yet.
- No repo-local lint config exists yet.
- Most meaningful verification depends on an OpenWrt build tree and ideally a target device or emulator.
