import esbuild from "esbuild";
import fs from "fs";

// Bundle the ESM application into a single CommonJS file so `pkg` can compile it into a binary.
esbuild.build({
  entryPoints: ["./bin/rgcli.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: "./dist/bundle.cjs",
  external: ["fsevents", "esbuild", "pkg"], // Ignore native dependencies
  minify: true,
}).then(() => {
  console.log("Successfully bundled rgcli into dist/bundle.cjs");
  
  // Create a wrapper for pkg
  const pkgConfig = {
    scripts: ["dist/bundle.cjs"],
    targets: ["node18-linux-x64", "node18-macos-x64", "node18-win-x64"],
    outputPath: "binaries"
  };
  fs.writeFileSync("pkg-config.json", JSON.stringify(pkgConfig, null, 2));
}).catch(() => process.exit(1));
