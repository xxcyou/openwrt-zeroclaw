include $(TOPDIR)/rules.mk

PKG_NAME:=zeroclaw
PKG_VERSION:=0.1.9
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/zeroclaw-labs/zeroclaw.git
PKG_SOURCE_VERSION:=main
PKG_MIRROR_HASH:=skip

PKG_LICENSE:=MIT Apache-2.0
PKG_LICENSE_FILES:=LICENSE-MIT LICENSE-APACHE

PKG_BUILD_DEPENDS:=rust/host
PKG_BUILD_PARALLEL:=1
PKG_BUILD_FLAGS:=no-mips16

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/rust/rust-package.mk

define Package/zeroclaw
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=ZeroClaw runtime for OpenWrt
  URL:=https://github.com/zeroclaw-labs/zeroclaw
	# libgcc is GCC runtime support, not glibc; libc remains OpenWrt musl.
  DEPENDS:=+libgcc +ca-bundle
endef

define Package/zeroclaw/description
 ZeroClaw runtime packaged for OpenWrt with procd integration and
 UCI-driven configuration rendering.
endef

# Upstream root Cargo.toml is both the workspace root and the `zeroclaw`
# package manifest, with the main binary entrypoint at src/main.rs.
# Default upstream features are already empty, so we start with the minimal
# feature surface and only opt into extras later after musl validation.
RUST_PKG_FEATURES:=

# Upstream provides an optimized release profile already; keep OpenWrt on the
# default release profile until we validate whether `release-fast` is preferable
# under the target toolchain and build-time memory limits.

define Package/zeroclaw/conffiles
/etc/config/zeroclaw
endef

define Package/zeroclaw/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/bin/zeroclaw $(1)/usr/bin/zeroclaw

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/zeroclaw $(1)/etc/config/zeroclaw

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/zeroclaw $(1)/etc/init.d/zeroclaw

	$(INSTALL_DIR) $(1)/usr/libexec/zeroclaw
	$(INSTALL_BIN) ./files/usr/libexec/zeroclaw/render-config.sh $(1)/usr/libexec/zeroclaw/render-config.sh

	$(INSTALL_DIR) $(1)/etc/zeroclaw
	$(INSTALL_DIR) $(1)/var/lib/zeroclaw
	$(INSTALL_DIR) $(1)/tmp/zeroclaw
endef

$(eval $(call BuildPackage,zeroclaw))
