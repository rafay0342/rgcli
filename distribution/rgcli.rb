require "language/node"

class Rgcli < Formula
  desc "RafayGen - The Ultimate Agentic Coding CLI"
  homepage "https://github.com/RafayGen/rgcli"
  url "https://github.com/rafay0342/rgcli/archive/refs/tags/v1.3.3.tar.gz"
  sha256 "4a15375ba514975bfec597f6401689909eafe29ba4bb6a25e8145d1c547d2847"
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
