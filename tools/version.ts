import { format, increment, parse, type ReleaseType } from "@std/semver";

const args = Deno.args;
if (args.length === 0) {
  console.error(
    "Usage: deno task version <major|minor|patch|custom-version>",
  );
  Deno.exit(1);
}

const specifier = args[0];

// 0. Check for clean working directory (allow CHANGELOG.md)
const statusCmd = new Deno.Command("git", { args: ["status", "--porcelain"] });
const { stdout: statusStdout } = await statusCmd.output();
const statusOutput = new TextDecoder().decode(statusStdout);

if (statusOutput.trim()) {
  const lines = statusOutput.trim().split("\n");
  const nonChangelogChanges = lines.filter((line) =>
    !line.includes("CHANGELOG.md")
  );

  if (nonChangelogChanges.length > 0) {
    console.error("Error: Git working directory not clean.");
    console.error("Uncommitted changes found in:");
    nonChangelogChanges.forEach((l) => console.error(l));
    console.error(
      "Please commit or stash changes before running version task (CHANGELOG.md is allowed).",
    );
    Deno.exit(1);
  }
}

// 1. Read current version from deno.json
const denoJsonPath = "deno.json";
const denoJsonContent = await Deno.readTextFile(denoJsonPath);

const versionMatch = denoJsonContent.match(/"version":\s*"([^"]+)"/);
if (!versionMatch) {
  console.error("Could not find version in deno.json");
  Deno.exit(1);
}

const currentVersionStr = versionMatch[1];
const currentVersion = parse(currentVersionStr);

let newVersionStr: string;

if (["major", "minor", "patch"].includes(specifier)) {
  const releaseType = specifier as ReleaseType;
  newVersionStr = format(increment(currentVersion, releaseType));
} else {
  // Custom version logic
  try {
    // 1. Try to parse as an absolute version
    const v = parse(specifier.startsWith("v") ? specifier.slice(1) : specifier);
    newVersionStr = format(v);
  } catch {
    // 2. Try to append as a suffix to the current version
    let suffix = specifier;
    // If it doesn't start with + (build) or - (pre-release), assume pre-release and prepend -
    if (!suffix.startsWith("+") && !suffix.startsWith("-")) {
      suffix = "-" + suffix;
    }

    const potentialVersion = `${currentVersionStr}${suffix}`;
    try {
      const v = parse(potentialVersion);
      newVersionStr = format(v);
    } catch {
      console.error(
        `Error: Specifier '${specifier}' is not a valid version or suffix.`,
      );
      Deno.exit(1);
    }
  }
}

console.log(`Target version: ${newVersionStr}`);

// 2. Check/Update CHANGELOG.md (Before updating deno.jsonc)
const changelogPath = "CHANGELOG.md";
let changelogContent = "";
try {
  changelogContent = await Deno.readTextFile(changelogPath);
} catch {
  console.log("CHANGELOG.md not found, creating one.");
  changelogContent =
    "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";
}

const header = `## v${newVersionStr}`;
if (!changelogContent.includes(header)) {
  const firstVersionHeaderIndex = changelogContent.indexOf("\n## v");
  const newSection = `\n${header}\n\n- \n`;

  if (firstVersionHeaderIndex !== -1) {
    changelogContent = changelogContent.slice(0, firstVersionHeaderIndex) +
      newSection +
      changelogContent.slice(firstVersionHeaderIndex);
  } else {
    changelogContent += newSection;
  }

  await Deno.writeTextFile(changelogPath, changelogContent);
  console.log(`Added new section for v${newVersionStr} to CHANGELOG.md.`);
  console.log(
    "Please update CHANGELOG.md with your changes and then run this command again to complete the release.",
  );
  Deno.exit(0);
} else {
  console.log("CHANGELOG.md already has section for this version. Proceeding.");
}

// 3. Update deno.json
console.log(`Bumping version: ${currentVersionStr} -> ${newVersionStr}`);
const newDenoJsonContent = denoJsonContent.replace(
  `"version": "${currentVersionStr}"`,
  `"version": "${newVersionStr}"`,
);
await Deno.writeTextFile(denoJsonPath, newDenoJsonContent);

// 4. Git operations
const commands = [
  ["git", "add", "deno.json", "CHANGELOG.md"],
  ["git", "commit", "-m", `chore: release v${newVersionStr}`],
  ["git", "tag", `v${newVersionStr}`],
];

for (const cmd of commands) {
  console.log(`Running: ${cmd.join(" ")}`);
  const p = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
  });
  const output = await p.output();
  if (!output.success) {
    console.error(`Command failed: ${cmd.join(" ")}`);
    console.error(new TextDecoder().decode(output.stderr));
    Deno.exit(1);
  }
}

console.log(`Successfully released v${newVersionStr}`);
