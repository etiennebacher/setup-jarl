# setup-jarl

A GitHub Action to run [jarl](https://github.com/etiennebacher/jarl).

This action is commonly used as a pass/fail test to ensure your repository stays
clean, abiding the [rules](https://jarl.etiennebacher.com/rules/) specified in your
configuration. Though it runs `jarl check` by default, the action can do
anything `jarl` can (ex, fix).

## Contents

- [Usage](#usage)
  - [Basic](#basic)
  - [Specify a different source directory](#specify-a-different-source-directory)
  - [Specify multiple files](#specify-multiple-files)
  - [Use to install jarl](#use-to-install-jarl)
  - [Use `jarl format`](#use-jarl-format)
  - [Install specific versions](#install-specific-versions)
    - [Install the latest version](#install-the-latest-version)
    - [Install a specific version](#install-a-specific-version)
    - [Install a version by supplying a semver range or pep440 specifier](#install-a-version-by-supplying-a-semver-range-or-pep440-specifier)
    - [Install a version from a specified version file](#install-a-version-from-a-specified-version-file)
  - [Validate checksum](#validate-checksum)
  - [GitHub authentication token](#github-authentication-token)
- [Outputs](#outputs)

## Usage

| Input          | Description                                                                                                                                | Default            |
|----------------|--------------------------------------------------------------------------------------------------------------------------------------------|--------------------|
| `version`      | The version of Jarl to install. See [Install specific versions](#install-specific-versions)                                                | `latest`           |
| `args`         | The arguments to pass to the `jarl` command. See [Configuring Jarl]                                                                        | `check`            |
| `src`          | The directory or single files to run `jarl` on.                                                                                            | [github.workspace] |
| `github-token` | The GitHub token to use for authentication.                                                                                                | `GITHUB_TOKEN`     |

### Basic

```yaml
- uses: etiennebacher/setup-jarl@v1
```

### Specify a different source directory

```yaml
- uses: etiennebacher/setup-jarl@v1
  with:
    src: "./src"
```

### Specify multiple files

```yaml
- uses: etiennebacher/setup-jarl@v1
  with:
    src: >-
      path/to/file1.py
      path/to/file2.py
```

### Use to install jarl

This action adds jarl to the PATH, so you can use it in subsequent steps.

```yaml
- uses: etiennebacher/setup-jarl@v1
- run: jarl check --fix
- run: jarl format
```

By default, this action runs `jarl check` after installation.
If you do not want to run any `jarl` command but only install it,
you can use the `args` input to overwrite the default value (`check`):

```yaml
- name: Install jarl without running check or format
  uses: etiennebacher/setup-jarl@v1
  with:
    args: "--version"
```

### Use `jarl format`

```yaml
- uses: etiennebacher/setup-jarl@v1
  with:
    args: "format --check --diff"
```

### Install specific versions

By default this action looks for a pyproject.toml file in the root of the repository to determine
the jarl version to install. If no pyproject.toml file is found, or no jarl version is defined in
`project.dependencies`, `project.optional-dependencies`, or `dependency-groups`,
the latest version is installed.

> [!NOTE]
> This action does only support jarl versions v0.0.247 and above.

#### Install the latest version

```yaml
- name: Install the latest version of jarl
  uses: etiennebacher/setup-jarl@v1
  with:
    version: "latest"
```

#### Install a specific version

```yaml
- name: Install a specific version of jarl
  uses: etiennebacher/setup-jarl@v1
  with:
    version: "0.4.4"
```

#### Install a version by supplying a semver range or pep440 specifier

You can specify a [semver range](https://github.com/npm/node-semver?tab=readme-ov-file#ranges)
or [pep440 specifier](https://peps.python.org/pep-0440/#version-specifiers)
to install the latest version that satisfies the range.

```yaml
- name: Install a semver range of jarl
  uses: etiennebacher/setup-jarl@v1
  with:
    version: ">=0.4.0"
```

```yaml
- name: Pinning a minor version of jarl
  uses: etiennebacher/setup-jarl@v1
  with:
    version: "0.4.x"
```

```yaml
- name: Install a pep440-specifier-satisfying version of jarl
  uses: etiennebacher/setup-jarl@v1
  with:
    version: ">=0.11.10,<0.12.0"
```

#### Install a version from a specified version file

You can specify a file to read the version from.
Currently `pyproject.toml` and `requirements.txt` are supported.

```yaml
- name: Install a version from a specified version file
  uses: etiennebacher/setup-jarl@v1
  with:
    version-file: "my-path/to/pyproject.toml-or-requirements.txt"
```

### Validate checksum

You can specify a checksum to validate the downloaded executable. Checksums up to the default version
are automatically verified by this action. The sha256 hashes can be found on the
[releases page](https://github.com/etiennebacher/jarl/releases) of the jarl repo.

```yaml
- name: Install a specific version and validate the checksum
  uses: etiennebacher/setup-jarl@v1
  with:
    version: "0.7.4"
    checksum: "0de731c669b9ece77e799ac3f4a160c30849752714d9775c94cc4cfaf326860c"
```

### GitHub authentication token

This action uses the GitHub API to fetch the jarl release artifacts. To avoid hitting the GitHub API
rate limit too quickly, an authentication token can be provided via the `github-token` input. By
default, the `GITHUB_TOKEN` secret is used, which is automatically provided by GitHub Actions.

If the default
[permissions for the GitHub token](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)
are not sufficient, you can provide a custom GitHub token with the necessary permissions.

```yaml
- name: Install the latest version of jarl with a custom GitHub token
  uses: etiennebacher/setup-jarl@v1
  with:
    github-token: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
```

## Outputs

| Output         | Description                             |
|----------------|-----------------------------------------|
| `jarl-version` | The version of Jarl that was installed. |


[Configuring Jarl]: https://jarl.etiennebacher.com/config
[github.workspace]: https://docs.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#github-context
