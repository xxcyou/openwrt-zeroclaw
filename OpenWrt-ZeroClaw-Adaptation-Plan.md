# ZeroClaw OpenWrt/musl Adaptation Plan

## 1. Goal and Scope

This project is split into two OpenWrt-facing packages:

- `zeroclaw/`: package, cross-compilation, runtime wrapper, init/procd integration, and deployment of the ZeroClaw binary.
- `luci-app-zeroclaw/`: LuCI UI for configuration, service lifecycle, health inspection, and basic runtime operations.

The first milestone is not full upstream feature parity. The first milestone is a stable OpenWrt package that:

- runs on `musl`
- starts under `procd`
- stores configuration in OpenWrt-friendly locations
- exposes a minimal LuCI control plane
- avoids unnecessary memory and storage overhead

## 2. What Upstream ZeroClaw Already Provides

Based on the upstream docs and README, ZeroClaw already has the right architecture for packaging, but it is designed primarily for general Linux/macOS environments.

Relevant upstream behaviors:

- Rust single-binary runtime
- main runtime commands: `agent`, `gateway`, `daemon`, `status`, `doctor`, `config`, `providers`, `models`, `channel`
- gateway defaults: `127.0.0.1:42617`
- public bind blocked unless explicitly allowed
- config resolution is workspace/home oriented:
  1. `ZEROCLAW_WORKSPACE`
  2. `~/.zeroclaw/active_workspace.toml`
  3. `~/.zeroclaw/config.toml`
- service-oriented operation already exists upstream, which maps well to OpenWrt init management

This means OpenWrt adaptation should focus on packaging, path relocation, resource reduction, and UI integration instead of redesigning the runtime.

## 3. OpenWrt Constraints

OpenWrt changes the assumptions of the upstream project:

- libc is `musl`, not `glibc`
- target CPU is often `mips`, `arm`, `aarch64`, `x86_64`, or older embedded variants
- RAM and flash are limited
- home-directory-centric config is a poor fit for services
- init system is `procd`, not systemd/OpenRC
- UCI is the preferred configuration interface
- LuCI should manage the service without exposing the full upstream complexity

Because of that, the packaging goal is a controlled embedded deployment profile, not a direct copy of desktop defaults.

## 4. Architecture Decision

### 4.1 Package Split

Keep the current directory split:

- `zeroclaw/`
  - OpenWrt package Makefile
  - Rust build rules / prebuilt integration
  - config generation helpers
  - `/etc/init.d/zeroclaw`
  - `/etc/config/zeroclaw`
- `luci-app-zeroclaw/`
  - LuCI menu entry
  - ACL
  - config form
  - service status page
  - action buttons for start/stop/restart/diagnose

### 4.2 Runtime Model

The OpenWrt package should run ZeroClaw as a managed daemon, not as an interactive local user workspace.

Recommended initial runtime mode:

- primary process: `zeroclaw daemon`
- bind address: default `127.0.0.1`
- optional LAN bind only when explicitly enabled
- config file generated from UCI into a dedicated runtime path

`gateway` may still be exposed as part of daemon mode, but OpenWrt should treat it as an internal service unless the user opts in.

## 5. Filesystem Layout for OpenWrt

Upstream defaults should be overridden with service-safe paths.

Recommended layout:

- binary: `/usr/bin/zeroclaw`
- UCI config: `/etc/config/zeroclaw`
- rendered upstream config: `/etc/zeroclaw/config.toml`
- persistent state: `/var/lib/zeroclaw/`
- transient state: `/tmp/zeroclaw/`
- logs: prefer syslog / `logread`; avoid large dedicated log files by default

Environment passed by init script:

- `ZEROCLAW_WORKSPACE=/var/lib/zeroclaw`

If upstream supports an explicit config path flag, use it. If not, ensure the workspace layout resolves cleanly to `/var/lib/zeroclaw` plus the generated config.

## 6. musl Adaptation Plan

### 6.1 Build Strategy

Do not compile on the router itself. Build off-device and package for OpenWrt.

Recommended approaches:

- preferred: integrate as an OpenWrt package using Rust package infrastructure and cross toolchain
- fallback: produce target-specific prebuilt binaries and package them into OpenWrt

Expected Rust targets will include some subset of:

- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`
- `armv7-unknown-linux-musleabihf`
- OpenWrt-specific targets driven by the OpenWrt toolchain

### 6.2 Dependency Audit

Before packaging, audit upstream Cargo dependencies for `musl` and embedded compatibility.

Priority checks:

- `openssl-sys`
- `native-tls`
- `ring`
- `tokio` feature size
- dynamic linker assumptions
- shell/bootstrap steps that require desktop tools

Preferred outcomes:

- use `rustls` instead of OpenSSL where possible
- disable unnecessary default features
- avoid runtime dependency on external shared libraries

### 6.3 Binary Slimming

For OpenWrt, the package should build a reduced feature profile if upstream supports it.

Target principles:

- disable heavy optional integrations by default
- keep provider support minimal in the first package release
- exclude browser/hardware/desktop-first features unless required
- strip symbols in release packaging

Potential feature split direction if upstream can support it:

- `minimal-runtime`
- `gateway`
- `providers-core`
- `channels-basic`
- `hardware` optional
- `browser` disabled by default

If upstream feature flags are not clean yet, the first implementation should document a downstream patch set for embedded builds.

## 7. Runtime Adaptation Tasks

### 7.1 Config Translation Layer

Do not expose the entire upstream `config.toml` model directly in LuCI.

Instead:

1. user edits UCI in `/etc/config/zeroclaw`
2. init script or helper script renders `/etc/zeroclaw/config.toml`
3. ZeroClaw consumes generated TOML

Benefits:

- stable OpenWrt UX
- reduced coupling to upstream config schema churn
- easier validation and defaults
- simpler secret handling in OpenWrt style

### 7.2 Service Supervision

Use `procd` with these behaviors:

- respawn enabled with sane limits
- pid managed by procd, not ad hoc wrapper logic
- explicit stdout/stderr redirection to syslog if needed
- optional health probe command using `zeroclaw status`

The init script should:

- create required directories
- render config if missing or outdated
- export runtime environment
- start `zeroclaw daemon`

### 7.3 Network Exposure Policy

OpenWrt defaults should stay conservative:

- default host: `127.0.0.1`
- default port: `42617`
- public or LAN bind disabled by default
- any `0.0.0.0` bind must require explicit UCI option

This aligns with upstream security behavior and is safer for router deployment.

## 8. LuCI Implementation Plan

### 8.1 First-Phase UI Scope

The first LuCI release should focus on basic operations only.

Pages/functions:

- Overview
  - running/stopped state
  - version
  - bind address and port
  - active provider/model
- Basic Settings
  - enable service
  - listen host
  - listen port
  - workspace or state path if exposed
  - log level if supported cleanly
- Provider Settings
  - provider ID
  - API base URL
  - model
  - API key
- Control Actions
  - start
  - stop
  - restart
  - enable on boot
- Diagnostics
  - show `status`
  - run `doctor`
  - show recent logs

### 8.2 Features to Defer

Do not include these in the first LuCI milestone:

- full upstream `config.toml` editor
- advanced agent orchestration controls
- browser tool configuration
- WASM runtime controls
- skills marketplace management
- full dashboard embedding
- advanced multi-channel setup
- detailed security policy editor

Those are valid later features, but they would slow down the first deliverable significantly.

### 8.3 Dashboard Handling

If upstream dashboard/gateway UI is usable on OpenWrt, expose it as one of:

- a link out to local service URL
- a reverse-proxy entry if really needed

Do not tightly couple LuCI to upstream web UI internals in the first version.

## 9. Proposed UCI Model

Initial UCI schema should be intentionally small.

Example:

```uci
config zeroclaw 'main'
    option enabled '0'
    option host '127.0.0.1'
    option port '42617'
    option allow_public_bind '0'
    option provider 'openrouter'
    option api_base ''
    option model ''
    option api_key ''
    option workspace '/var/lib/zeroclaw'
    option log_level 'info'
```

Rendered TOML should only include the subset the OpenWrt package owns.

## 10. Packaging Plan for `zeroclaw/`

### Phase A: Build Validation

- clone or vendor the upstream source into the package flow
- verify `cargo build --release` against target toolchain assumptions
- verify `musl` compatibility and identify failing crates
- record required patches

Deliverable:

- reproducible build notes per target architecture

### Phase B: OpenWrt Package Skeleton

Create:

- `zeroclaw/Makefile`
- `zeroclaw/files/etc/config/zeroclaw`
- `zeroclaw/files/etc/init.d/zeroclaw`
- optional helper script to render TOML

Deliverable:

- `opkg` package that installs binary and service files

### Phase C: Runtime Smoke Test

Validate on target or emulator:

- package installs successfully
- init script starts daemon
- `zeroclaw status` returns useful output
- local bind only by default
- restart survives config change

Deliverable:

- first installable test package

## 11. Packaging Plan for `luci-app-zeroclaw/`

### Phase A: LuCI Skeleton

Create:

- `luci-app-zeroclaw/Makefile`
- menu entry
- ACL file
- JS or Lua view files depending on chosen LuCI style

Deliverable:

- app visible in LuCI navigation

### Phase B: Config Form

Implement form bindings for the minimal UCI set.

Deliverable:

- saved values persist to `/etc/config/zeroclaw`

### Phase C: Service Integration

Add RPC or shell-backed actions for:

- start
- stop
- restart
- status
- log preview
- doctor

Deliverable:

- user can manage ZeroClaw without shell access

## 12. Risks and Mitigations

### Risk 1: Rust dependency does not cross-compile cleanly on musl

Mitigation:

- audit dependency tree early
- replace OpenSSL-oriented paths with `rustls` where possible
- maintain a downstream patch series if necessary

### Risk 2: Runtime memory footprint is too high for low-end routers

Mitigation:

- keep first release feature-minimal
- disable expensive integrations
- test `daemon` and `gateway` separately if needed
- document minimum hardware class

### Risk 3: Upstream config schema changes frequently

Mitigation:

- keep LuCI mapped to a stable UCI subset
- render TOML through a controlled template
- avoid raw TOML editing in the UI initially

### Risk 4: Gateway exposure creates a security issue on router LAN

Mitigation:

- default bind to `127.0.0.1`
- require explicit opt-in for non-local bind
- reflect status clearly in LuCI

### Risk 5: Flash size becomes too large

Mitigation:

- strip binary
- package only required assets
- keep dashboard resources optional if heavy

## 13. Definition of Done for Milestone 1

Milestone 1 is complete when all of the following are true:

- `zeroclaw` builds for an OpenWrt target using `musl`
- OpenWrt package installs with `opkg`
- `/etc/init.d/zeroclaw start` launches the service successfully
- ZeroClaw listens on the configured local address/port
- LuCI page can edit minimal config and control service state
- LuCI can show status output and recent logs
- default install does not expose the service publicly

## 14. Recommended Execution Order

1. validate upstream dependency/build compatibility on `musl`
2. define the minimal embedded feature set
3. create `zeroclaw/` package skeleton
4. implement init/procd + UCI-to-TOML rendering
5. smoke test runtime on OpenWrt target
6. create `luci-app-zeroclaw/` skeleton
7. implement config and service pages
8. add diagnostics and logs
9. iterate on size, memory, and provider support

## 15. Immediate Next Work Items

The next concrete implementation tasks should be:

1. create `zeroclaw/Makefile`
2. create `/etc/config/zeroclaw` default UCI file
3. create `/etc/init.d/zeroclaw` procd script
4. create a small TOML render helper from UCI values
5. create `luci-app-zeroclaw/Makefile`
6. create LuCI menu, ACL, and basic settings page

Once these are in place, the repository will move from planning into a usable first package scaffold.
