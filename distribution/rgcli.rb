require "language/node"

class Rgcli < Formula
  desc "RafayGen - The Ultimate Agentic Coding CLI"
  homepage "https://github.com/RafayGen/rgcli"
  # Once published to NPM, this URL will fetch the public tarball
  url "https://registry.npmjs.org/rafaygen-cli/-/rafaygen-cli-1.0.0.tgz"
  # You will need to replace this SHA256 when you publish to NPM:
  # shasum -a 256 rgcli-1.0.0.tgz
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "ISC"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/rgcli", "--version"
  end
end
