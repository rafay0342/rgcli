TERMUX_PKG_HOMEPAGE=https://github.com/RafayGen/rgcli
TERMUX_PKG_DESCRIPTION="RafayGen - The Ultimate Agentic Coding CLI"
TERMUX_PKG_LICENSE="ISC"
TERMUX_PKG_MAINTAINER="RafayGen"
TERMUX_PKG_VERSION=1.0.0
# Once published to NPM, this URL will fetch the public tarball
TERMUX_PKG_SRCURL=https://registry.npmjs.org/rafaygen-cli/-/rafaygen-cli-${TERMUX_PKG_VERSION}.tgz
# You will need to replace this SHA256 when you publish to NPM
TERMUX_PKG_SHA256=0000000000000000000000000000000000000000000000000000000000000000
TERMUX_PKG_DEPENDS="nodejs"
TERMUX_PKG_BUILD_IN_SRC=true

termux_step_make_install() {
	# Installs rgcli globally in the Termux environment
	npm install -g --prefix "${TERMUX_PREFIX}" rgcli
}
