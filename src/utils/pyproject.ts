import * as fs from "node:fs";
import * as core from "@actions/core";
import * as toml from "smol-toml";

function getJarlVersionFromAllDependencies(
  allDependencies: string[],
): string | undefined {
  const jarlVersionDefinition = allDependencies.find((dep: string) =>
    dep.startsWith("jarl"),
  );

  if (jarlVersionDefinition) {
    const jarlVersion = jarlVersionDefinition
      .match(/^jarl([^A-Z0-9._-]+.*)$/)?.[1]
      .trim();
    if (jarlVersion?.startsWith("==")) {
      return jarlVersion.slice(2);
    }
    core.info(`Found jarl version in pyproject.toml: ${jarlVersion}`);
    return jarlVersion;
  }

  return undefined;
}

interface Pyproject {
  project?: {
    dependencies?: string[];
    "optional-dependencies"?: Record<string, string[]>;
  };
  "dependency-groups"?: Record<string, Array<string | object>>;
  tool?: {
    poetry?: {
      dependencies?: Record<string, string | object>;
      group?: Record<string, { dependencies: Record<string, string | object> }>;
    };
  };
}

function parsePyproject(pyprojectContent: string): string | undefined {
  const pyproject: Pyproject = toml.parse(pyprojectContent);
  const dependencies: string[] = pyproject?.project?.dependencies || [];
  const optionalDependencies: string[] = Object.values(
    pyproject?.project?.["optional-dependencies"] || {},
  ).flat();
  const devDependencies: string[] = Object.values(
    pyproject?.["dependency-groups"] || {},
  )
    .flat()
    .filter((item: string | object) => typeof item === "string");
  return (
    getJarlVersionFromAllDependencies(
      dependencies.concat(optionalDependencies, devDependencies),
    ) || getJarlVersionFromPoetryGroups(pyproject)
  );
}

function getJarlVersionFromPoetryGroups(
  pyproject: Pyproject,
): string | undefined {
  // Special handling for Poetry until it supports PEP 735
  // See: <https://github.com/python-poetry/poetry/issues/9751>
  const poetry = pyproject?.tool?.poetry || {};
  const poetryGroups = Object.values(poetry.group || {});
  if (poetry.dependencies) {
    poetryGroups.unshift({ dependencies: poetry.dependencies });
  }
  return poetryGroups
    .flatMap((group) => Object.entries(group.dependencies))
    .map(([name, spec]) => {
      if (name === "jarl" && typeof spec === "string") return spec;
      return undefined;
    })
    .find((version) => version !== undefined);
}

export function getJarlVersionFromRequirementsFile(
  filePath: string,
): string | undefined {
  if (!fs.existsSync(filePath)) {
    core.warning(`Could not find file: ${filePath}`);
    return undefined;
  }
  const pyprojectContent = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".txt")) {
    return getJarlVersionFromAllDependencies(pyprojectContent.split("\n"));
  }
  try {
    return parsePyproject(pyprojectContent);
  } catch (err) {
    const message = (err as Error).message;
    core.warning(`Error while parsing ${filePath}: ${message}`);
    return undefined;
  }
}
