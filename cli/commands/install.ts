import { Command } from "@cliffy/command";
import { join } from "@std/path";
import { ensureDir, exists } from "@std/fs";

const REPO_OWNER = "innovatedev";
const REPO_NAME = "innokv";

/**
 * Command to install or update the innokv binary from GitHub Releases.
 */
// deno-lint-ignore no-explicit-any
export const install: Command<any> = new Command()
  .description("Install or update the innokv binary from GitHub Releases")
  .option(
    "-t, --tag <tag:string>",
    "Install a specific version tag (defaults to latest)",
  )
  .option("-d, --dir <dir:string>", "Installation directory", {
    default: Deno.build.os === "windows"
      ? "."
      : join(Deno.env.get("HOME") || ".", ".innokv", "bin"),
  })
  .option("-f, --force", "Overwrite existing binary", { default: false })
  // deno-lint-ignore no-explicit-any
  .action(async (options: any) => {
    const tag = options.tag || "latest";
    const installDir = options.dir
      ? join(options.dir)
      : join(Deno.env.get("HOME") || ".", ".innokv", "bin");
    const force = options.force || false;

    console.log(`Installing InnoKV CLI (${tag}) to ${installDir}...`);

    try {
      await ensureDir(installDir);

      const targetPath = join(
        installDir,
        Deno.build.os === "windows" ? "innokv.exe" : "innokv",
      );

      try {
        await Deno.lstat(targetPath);
        if (!force) {
          console.error(
            `Error: innokv binary already exists at ${targetPath}. Use --force to overwrite.`,
          );
          Deno.exit(1);
        }
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
      }

      const os = Deno.build.os;
      let artifactName: string;

      if (os === "linux") {
        artifactName = "innokv-linux";
      } else if (os === "darwin") {
        artifactName = "innokv-mac";
      } else if (os === "windows") {
        artifactName = "innokv-win.exe";
      } else {
        console.error(`Unsupported OS: ${os}`);
        Deno.exit(1);
      }

      const downloadUrl = tag === "latest"
        ? `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${artifactName}`
        : `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${tag}/${artifactName}`;

      console.log(`Downloading binary from ${downloadUrl}...`);

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download binary: ${response.status} ${response.statusText}`,
        );
      }

      if (!response.body) {
        throw new Error("Response body is empty");
      }

      // Save to file
      const file = await Deno.open(targetPath, {
        write: true,
        create: true,
        truncate: true,
        mode: 0o755, // Executable
      });
      await response.body.pipeTo(file.writable);

      console.log("Download complete.");

      // Add to PATH instruction
      console.log("\nInstallation successful!");
      console.log(
        `Please add ${installDir} to your PATH if it's not already there.`,
      );
      console.log(`\n  export PATH="${installDir}:$PATH"\n`);
    } catch (e) {
      console.error(
        "Installation failed:",
        e instanceof Error ? e.message : String(e),
      );
      Deno.exit(1);
    }
  });
