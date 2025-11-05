import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as semver from "semver";
import {
  downloadVersion,
  resolveVersion,
  tryGetFromToolCache,
} from "./download/download-version";
import {
  args,
  checkSum,
  githubToken,
  src,
  version,
  versionFile as versionFileInput,
} from "./utils/inputs";
import {
  type Architecture,
  getArch,
  getPlatform,
  type Platform,
} from "./utils/platforms";
import { getJarlVersionFromRequirementsFile } from "./utils/pyproject";

async function run(): Promise<void> {
  const platform = getPlatform();
  const arch = getArch();

  try {
    if (platform === undefined) {
      throw new Error(`Unsupported platform: ${process.platform}`);
    }
    if (arch === undefined) {
      throw new Error(`Unsupported architecture: ${process.arch}`);
    }
    const setupResult = await setupJarl(platform, arch, checkSum, githubToken);

    addJarlToPath(setupResult.jarlDir);
    setOutputFormat();
    addMatchers();
    core.setOutput("jarl-version", setupResult.version);
    core.info(`Successfully installed jarl version ${setupResult.version}`);

    await runJarl(
      path.join(setupResult.jarlDir, "jarl"),
      args.split(" "),
      src.split(" "),
    );

    process.exit(0);
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

async function setupJarl(
  platform: Platform,
  arch: Architecture,
  checkSum: string | undefined,
  githubToken: string,
): Promise<{ jarlDir: string; version: string }> {
  const resolvedVersion = await determineVersion();
  if (semver.lt(resolvedVersion, "v0.0.247")) {
    throw Error(
      "This action does not support jarl versions older than 0.0.247",
    );
  }
  const toolCacheResult = tryGetFromToolCache(arch, resolvedVersion);
  if (toolCacheResult.installedPath) {
    core.info(`Found jarlDir in tool-cache for ${toolCacheResult.version}`);
    return {
      jarlDir: toolCacheResult.installedPath,
      version: toolCacheResult.version,
    };
  }

  const downloadVersionResult = await downloadVersion(
    platform,
    arch,
    resolvedVersion,
    checkSum,
    githubToken,
  );

  return {
    jarlDir: downloadVersionResult.cachedToolDir,
    version: downloadVersionResult.version,
  };
}

async function determineVersion(): Promise<string> {
  if (versionFileInput !== "" && version !== "") {
    throw Error("It is not allowed to specify both version and version-file");
  }
  if (version !== "") {
    return await resolveVersion(version, githubToken);
  }
  if (versionFileInput !== "") {
    const versionFromPyproject =
      getJarlVersionFromRequirementsFile(versionFileInput);
    if (versionFromPyproject === undefined) {
      core.warning(
        `Could not parse version from ${versionFileInput}. Using latest version.`,
      );
    }
    return await resolveVersion(versionFromPyproject || "latest", githubToken);
  }
  const pyProjectPath = path.join(src, "pyproject.toml");
  if (!fs.existsSync(pyProjectPath)) {
    core.info(`Could not find ${pyProjectPath}. Using latest version.`);
    return await resolveVersion("latest", githubToken);
  }
  const versionFromPyproject =
    getJarlVersionFromRequirementsFile(pyProjectPath);
  if (versionFromPyproject === undefined) {
    core.info(
      `Could not parse version from ${pyProjectPath}. Using latest version.`,
    );
  }
  return await resolveVersion(versionFromPyproject || "latest", githubToken);
}

function addJarlToPath(cachedPath: string): void {
  core.addPath(cachedPath);
  core.info(`Added ${cachedPath} to the path`);
}

function setOutputFormat() {
  core.exportVariable("JARL_OUTPUT_FORMAT", "github");
  core.info("Set JARL_OUTPUT_FORMAT to github");
}

function addMatchers(): void {
  const matchersPath = path.join(
    __dirname,
    `..${path.sep}..`,
    ".github",
    "matchers",
  );
  core.info(`##[add-matcher]${path.join(matchersPath, "check.json")}`);
  core.info(`##[add-matcher]${path.join(matchersPath, "format.json")}`);
}

async function runJarl(
  jarlExecutablePath: string,
  args: string[],
  src: string[],
): Promise<void> {
  const execArgs = [...args, ...src];
  await exec.exec(jarlExecutablePath, execArgs);
}

run();
