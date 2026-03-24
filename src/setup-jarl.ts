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
  githubToken,
  src,
  version,
} from "./utils/inputs";
import {
  type Architecture,
  getArch,
  getPlatform,
  type Platform,
} from "./utils/platforms";

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
    const setupResult = await setupJarl(platform, arch, githubToken);

    addJarlToPath(setupResult.jarlDir);
    setOutputFormat();
    core.setOutput("jarl-version", setupResult.version);
    core.info(`Successfully installed jarl version ${setupResult.version}`);

    const parsedArgs = args.split(" ");
    validateNoPathInArgs(parsedArgs);

    await runJarl(
      path.join(setupResult.jarlDir, "jarl"),
      parsedArgs,
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
  githubToken: string,
): Promise<{ jarlDir: string; version: string }> {
  const resolvedVersion = await determineVersion();
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
    githubToken,
  );

  return {
    jarlDir: downloadVersionResult.cachedToolDir,
    version: downloadVersionResult.version,
  };
}

async function determineVersion(): Promise<string> {
  if (version !== "") {
    return await resolveVersion(version, githubToken);
  }
  return await resolveVersion("latest", githubToken);
}

function addJarlToPath(cachedPath: string): void {
  core.addPath(cachedPath);
  core.info(`Added ${cachedPath} to the path`);
}

function setOutputFormat() {
  core.exportVariable("JARL_OUTPUT_FORMAT", "github");
  core.info("Set JARL_OUTPUT_FORMAT to github");
}

function validateNoPathInArgs(args: string[]): void {
  // Skip the first arg (index 0) since this should be "check". Any non-flag
  // argument that doesn't immediately follow a "--" flag is a positional
  // argument (i.e., a path).
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      continue;
    }
    // If the previous argument is a "--" flag, this is its value — skip it.
    if (args[i - 1].startsWith("--")) {
      continue;
    }
    throw new Error(
      `It looks like a path ("${arg}") was passed in 'args'. Use the 'src' input to specify paths instead.`,
    );
  }
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
