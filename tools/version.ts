import { format, increment, parse, type ReleaseType } from "@std/semver";

const args = Deno.args;
if (args.length === 0) {
  console.error(
    "Usage: deno task version <major|minor|patch|point|custom-version>",
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

// 1. Read current version from deno.jsonc
const denoJsonPath = "deno.jsonc";
const denoJsonContent = await Deno.readTextFile(denoJsonPath);

const versionMatch = denoJsonContent.match(/"version":\s*"([^"]+)"/);
if (!versionMatch) {
  console.error("Could not find version in deno.jsonc");
  Deno.exit(1);
}

const currentVersionStr = versionMatch[1];
const currentVersion = parse(currentVersionStr);

let newVersionStr: string;

if (["major", "minor", "patch", "point"].includes(specifier)) {
  const releaseType =
    (specifier === "point" ? "patch" : specifier) as ReleaseType;
  newVersionStr = format(increment(currentVersion, releaseType));
} else {
  // Custom version
  // Validate it parses
  try {
    const v = parse(specifier.startsWith("v") ? specifier.slice(1) : specifier);
    newVersionStr = format(v);
  } catch {
    console.log(
      `Specifier '${specifier}' is not a valid semver, treating as custom tag suffix? No, user said 'custom-string'. Assuming raw string.`,
    );
    newVersionStr = specifier;
  }
}

console.log(`Bumping version: ${currentVersionStr} -> ${newVersionStr}`);

// 2. Update deno.jsonc
const newDenoJsonContent = denoJsonContent.replace(
  `"version": "${currentVersionStr}"`,
  `"version": "${newVersionStr}"`,
);
await Deno.writeTextFile(denoJsonPath, newDenoJsonContent);

// 3. Update CHANGELOG.md
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
  // Insert after the main description or at top
  // Look for the first existing version header to insert before, or if none, append?
  // User wants "make sure we have a changelog section"
  // Let's look for the first "## v" and insert before it.

  const firstVersionHeaderIndex = changelogContent.indexOf("\n## v");

  const newSection = `\n${header}\n\n- \n`;

  if (firstVersionHeaderIndex !== -1) {
    changelogContent = changelogContent.slice(0, firstVersionHeaderIndex) +
      newSection +
      changelogContent.slice(firstVersionHeaderIndex);
  } else {
    // Append if no version history
    changelogContent += newSection;
  }

  await Deno.writeTextFile(changelogPath, changelogContent);
  console.log("Added new section to CHANGELOG.md");
  console.log(
    "Please update CHANGELOG.md with your changes and commit/tag manually, or run this command again if you've already updated it (wait, running again would bump version again).",
  );
  console.log("Actually, just commit and tag manually:");
  console.log(
    `git add deno.jsonc CHANGELOG.md && git commit -m "chore: release v${newVersionStr}" && git tag v${newVersionStr}`,
  );
  Deno.exit(0);
} else {
  console.log("CHANGELOG.md already has section for this version.");
}

// 4. Git operations
const commands = [
  ["git", "add", "deno.jsonc", "CHANGELOG.md"],
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

console.log(`Successfully bumped version to v${newVersionStr}`);
