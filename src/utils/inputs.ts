import * as core from "@actions/core";

export const version = core.getInput("version");
export const githubToken = core.getInput("github-token");
export const args = core.getInput("args");
export const src = core.getInput("src");
