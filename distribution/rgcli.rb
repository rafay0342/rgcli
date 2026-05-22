require "language/node"

class Rgcli < Formula
  desc "RafayGen - The Ultimate Agentic Coding CLI"
  homepage "https://github.com/RafayGen/rgcli"
  url "https://registry.npmjs.org/rafaygen-cli/-/rafaygen-cli-1.3.3.tgz"
  sha256 "6a7f2ff1bd2ae21ef82422427b39b3bc0d40a95b8274aa716f5e56adead221f6"
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
