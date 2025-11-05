import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import * as pep440 from "@renovatebot/pep440";
import * as semver from "semver";
import { OWNER, REPO, TOOL_CACHE_NAME } from "../utils/constants";
import type { Architecture, Platform } from "../utils/platforms";

const PaginatingOctokit = Octokit.plugin(paginateRest, restEndpointMethods);

export function tryGetFromToolCache(
  arch: Architecture,
  version: string,
): { version: string; installedPath: string | undefined } {
  core.debug(`Trying to get jarl from tool cache for ${version}...`);
  const cachedVersions = tc.findAllVersions(TOOL_CACHE_NAME, arch);
  core.debug(`Cached versions: ${cachedVersions}`);
  let resolvedVersion = tc.evaluateVersions(cachedVersions, version);
  if (resolvedVersion === "") {
    resolvedVersion = version;
  }
  const installedPath = tc.find(TOOL_CACHE_NAME, resolvedVersion, arch);
  return { installedPath, version: resolvedVersion };
}

export async function downloadVersion(
  platform: Platform,
  arch: Architecture,
  version: string,
  githubToken: string,
): Promise<{ version: string; cachedToolDir: string }> {
  const artifact = `jarl-${arch}-${platform}`;
  let extension = ".tar.gz";
  if (platform === "pc-windows-msvc") {
    extension = ".zip";
  }
  const downloadUrl = constructDownloadUrl(version, platform, arch);
  core.debug(`Downloading jarl from "${downloadUrl}" ...`);

  const downloadPath = await tc.downloadTool(downloadUrl, undefined, githubToken);
  core.debug(`Downloaded jarl to "${downloadPath}"`);

  const extractedDir = await extractDownloadedArtifact(
    version,
    downloadPath,
    extension,
    platform,
    artifact,
  );

  const cachedToolDir = await tc.cacheDir(extractedDir, TOOL_CACHE_NAME, version, arch);
  return { cachedToolDir, version: version };
}

function constructDownloadUrl(
  version: string,
  platform: Platform,
  arch: Architecture,
): string {
  // Current jarl releases use format: jarl-{arch}-{platform}.tar.gz
  // with no version suffix in the artifact name
  const artifact = `jarl-${arch}-${platform}`;
  let extension = ".tar.gz";
  if (platform === "pc-windows-msvc") {
    extension = ".zip";
  }
  // Current jarl releases don't use a 'v' prefix in tags (e.g., 0.0.19 not v0.0.19)
  return `https://github.com/${OWNER}/${REPO}/releases/download/${version}/${artifact}${extension}`;
}

async function extractDownloadedArtifact(
  version: string,
  downloadPath: string,
  extension: string,
  platform: Platform,
  artifact: string,
): Promise<string> {
  let jarlDir: string;
  if (platform === "pc-windows-msvc") {
    const fullPathWithExtension = `${downloadPath}${extension}`;
    await fs.copyFile(downloadPath, fullPathWithExtension);
    jarlDir = await tc.extractZip(fullPathWithExtension);
    // On windows extracting the zip does not create an intermediate directory
  } else {
    jarlDir = await tc.extractTar(downloadPath);
    // Current jarl releases create an intermediate directory
    jarlDir = path.join(jarlDir, artifact);
  }
  const files = await fs.readdir(jarlDir);
  core.debug(`Contents of ${jarlDir}: ${files.join(", ")}`);
  return jarlDir;
}

export async function resolveVersion(
  versionInput: string,
  githubToken: string,
): Promise<string> {
  core.debug(`Resolving ${versionInput}...`);
  const version =
    versionInput === "latest" ? await getLatestVersion(githubToken) : versionInput;
  if (tc.isExplicitVersion(version)) {
    core.debug(`Version ${version} is an explicit version.`);
    return version;
  }
  const availableVersions = await getAvailableVersions(githubToken);
  const resolvedVersion = maxSatisfying(availableVersions, version);
  if (resolvedVersion === undefined) {
    throw new Error(`No version found for ${version}`);
  }
  core.debug(`Resolved version: ${resolvedVersion}`);
  return resolvedVersion;
}

async function getAvailableVersions(githubToken: string): Promise<string[]> {
  try {
    const octokit = new PaginatingOctokit({
      auth: githubToken,
    });
    return await getReleaseTagNames(octokit);
  } catch (err) {
    if ((err as Error).message.includes("Bad credentials")) {
      core.info(
        "No (valid) GitHub token provided. Falling back to anonymous. Requests might be rate limited.",
      );
      const octokit = new PaginatingOctokit();
      return await getReleaseTagNames(octokit);
    }
    throw err;
  }
}

async function getReleaseTagNames(
  octokit: InstanceType<typeof PaginatingOctokit>,
): Promise<string[]> {
  const response = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner: OWNER,
    repo: REPO,
  });
  const releaseTagNames = response.map((release) => release.tag_name);
  if (releaseTagNames.length === 0) {
    throw Error(
      "Github API request failed while getting releases. Check the GitHub status page for outages. Try again later.",
    );
  }
  return response.map((release) => release.tag_name);
}

async function getLatestVersion(githubToken: string) {
  const octokit = new PaginatingOctokit({
    auth: githubToken,
  });

  let latestRelease: { tag_name: string } | undefined;
  try {
    latestRelease = await getLatestRelease(octokit);
  } catch (err) {
    if ((err as Error).message.includes("Bad credentials")) {
      core.info(
        "No (valid) GitHub token provided. Falling back to anonymous. Requests might be rate limited.",
      );
      const octokit = new PaginatingOctokit();
      latestRelease = await getLatestRelease(octokit);
    } else {
      core.error(
        "Github API request failed while getting latest release. Check the GitHub status page for outages. Try again later.",
      );
      throw err;
    }
  }

  if (!latestRelease) {
    throw new Error("Could not determine latest release.");
  }
  return latestRelease.tag_name;
}

async function getLatestRelease(octokit: InstanceType<typeof PaginatingOctokit>) {
  const { data: latestRelease } = await octokit.rest.repos.getLatestRelease({
    owner: OWNER,
    repo: REPO,
  });
  return latestRelease;
}

function maxSatisfying(versions: string[], version: string): string | undefined {
  const maxSemver = tc.evaluateVersions(versions, version);
  if (maxSemver !== "") {
    core.debug(`Found a version that satisfies the semver range: ${maxSemver}`);
    return maxSemver;
  }
  const maxPep440 = pep440.maxSatisfying(versions, version);
  if (maxPep440 !== null) {
    core.debug(`Found a version that satisfies the pep440 specifier: ${maxPep440}`);
    return maxPep440;
  }
  return undefined;
}
