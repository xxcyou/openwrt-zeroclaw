# openwrt-zeroclaw

[English README / 英文说明](./README.md)

这是 [ZeroClaw](https://github.com/zeroclaw-labs/zeroclaw) 的 OpenWrt 打包与 LuCI 集成仓库。

本仓库的设计目标，是作为 OpenWrt build tree 中 `package/` 目录下的一个软件包集合存在。
它不是一个可以在仓库根目录直接独立构建、测试或运行的普通应用项目。

## 仓库结构

```text
openwrt/
└── package/
    └── openwrt-zeroclaw/
        ├── zeroclaw/
        ├── luci-app-zeroclaw/
        ├── README.md
        └── README.zh-CN.md
```

### 本仓库包含的包

- `zeroclaw/`
  - OpenWrt 运行时软件包
  - 安装上游 `zeroclaw` 二进制
  - 提供 UCI 默认配置、procd init 脚本，以及 UCI → TOML 渲染逻辑
- `luci-app-zeroclaw/`
  - LuCI 前端软件包
  - 提供菜单、ACL、国际化，以及多页面 ZeroClaw 管理界面

## 当前仓库已经提供的能力

目前本仓库已经具备：

- ZeroClaw 运行时的 OpenWrt 软件包定义
- `luci-app-zeroclaw` 的 LuCI 软件包定义
- 基于 procd 的服务管理脚本
- 基于 UCI 的 ZeroClaw 配置入口
- 从 `/etc/config/zeroclaw` 渲染到 `/etc/zeroclaw/config.toml`
- LuCI 多页面界面，包括：
  - 概览
  - 引导配置
  - 设置
  - 诊断

可以把它理解为 ZeroClaw 面向 OpenWrt 的集成层。

## 当前默认 UCI 配置项

当前运行时软件包已管理的核心配置包括：

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

这些配置会由 `zeroclaw/files/usr/libexec/zeroclaw/render-config.sh` 转换成最终生成的 TOML 配置文件。

## 依赖说明

当前 LuCI 包依赖：

- `luci-base`
- `zeroclaw`

如果你的 OpenWrt tree 或后续修改引入了更多 LuCI 运行时依赖，请在 `menuconfig` 中按需启用。

## 对 OpenWrt build tree 的假设

本仓库默认以下前提成立：

- OpenWrt buildroot 已准备好
- LuCI feed 已安装
- `packages` feed 已安装，并且包含 Rust 打包支持

本仓库目前使用到的关键 include：

- `zeroclaw/Makefile` 引入 `$(TOPDIR)/feeds/packages/lang/rust/rust-package.mk`
- `luci-app-zeroclaw/Makefile` 引入 `$(TOPDIR)/feeds/luci/luci.mk`

## 在 menuconfig 中选择软件包

在 OpenWrt 根目录执行：

```sh
make menuconfig
```

启用：

- `Utilities -> zeroclaw`
- `LuCI -> Applications -> luci-app-zeroclaw`

如果 `luci-app-zeroclaw` 能看到但无法勾选，最常见原因是 OpenWrt 当前配置里 LuCI 相关依赖还没启用。

## 构建命令

以下命令都应从 OpenWrt tree 根目录执行，而不是在本仓库根目录直接运行。

### 编译运行时软件包

```sh
make package/zeroclaw/compile V=s
```

### 编译 LuCI 软件包

```sh
make package/luci-app-zeroclaw/compile V=s
```

### 修改包内容后重新构建

```sh
make package/zeroclaw/{clean,compile} V=s
make package/luci-app-zeroclaw/{clean,compile} V=s
```

### 完整构建

```sh
make -j$(nproc) V=s
```

## 当前验证方式

本仓库目前还没有仓库内自动化测试。
当前更现实的验证路径是软件包级和运行时级验证：

1. 编译受影响的 OpenWrt 软件包
2. 安装到目标设备或模拟环境
3. 手工验证运行时和 LuCI 行为

目标设备上常用命令：

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

## LuCI 当前状态

当前 LuCI 前端已经不只是一个简单设置页，而是一个多页面管理界面，包括：

- **概览**：服务状态、快捷操作、doctor 输出、最近日志
- **引导配置**：首配引导、完成度检查、配置警告、配置渲染、常用操作
- **设置**：完整 UCI 配置编辑和字段说明
- **诊断**：doctor 输出和最近日志，便于排障

界面遵循经典 LuCI JavaScript 写法，并已支持简体中文翻译。

## 上游构建与打包风险

上游 ZeroClaw 是一个 Rust workspace，根目录 `Cargo.toml` 同时也是主包 manifest。
这意味着 OpenWrt 软件包需要直接从上游仓库根目录构建。

当前可见的风险包括：

- 上游 Rust 工具链要求可能高于部分 OpenWrt tree 当前版本
- musl 目标兼容性仍需要通过真实包编译验证
- 依赖树较大，在资源受限设备上编译成本可能偏高
- 上游运行时配置面远大于当前 OpenWrt UCI/TOML 包装层已暴露的能力

## 当前限制

- 没有仓库内自动化测试
- 没有 single-test 运行方式
- 没有仓库内 lint 配置
- 还没有把上游所有 ZeroClaw 配置域都映射到 UCI
- 还没有把上游所有常用 CLI 操作都接入 LuCI
- 真正有意义的验证仍依赖 OpenWrt build tree，最好还有真实目标设备

## 后续方向

当前开发方向是：

1. 保持 OpenWrt 软件包实现保守、稳定、便于运维
2. 把更多安全且实用的上游 ZeroClaw 配置能力映射到 UCI
3. 持续增强 LuCI，让常见配置和日常运维尽量不依赖命令行
4. 持续验证上游变更在 OpenWrt musl 环境下的真实构建表现

## 相关文件

- `AGENTS.md` — 面向代码代理的仓库开发说明
- `OpenWrt-ZeroClaw-Adaptation-Plan.md` — OpenWrt 适配背景和架构上下文
