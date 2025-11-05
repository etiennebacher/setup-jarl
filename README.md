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
  - [Install specific versions](#install-specific-versions)
    - [Install the latest version (default)](#install-the-latest-version)
    - [Install a specific version](#install-a-specific-version)
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
- uses: etiennebacher/setup-jarl@v0.1.0
```

### Specify a different source directory

```yaml
- uses: etiennebacher/setup-jarl@v0.1.0
  with:
    src: "./R"
```

### Specify multiple files

```yaml
- uses: etiennebacher/setup-jarl@v0.1.0
  with:
    src: >-
      path/to/file1.r
      path/to/file2.r
```

### Use to install jarl

This action adds jarl to the PATH, so you can use it in subsequent steps.

```yaml
- uses: etiennebacher/setup-jarl@v0.1.0
- run: jarl check --fix
```

By default, this action runs `jarl check` after installation.
If you do not want to run any `jarl` command but only install it,
you can use the `args` input to overwrite the default value (`check`):

```yaml
- name: Install jarl without running check
  uses: etiennebacher/setup-jarl@v0.1.0
  with:
    args: "--version"
```

### Install specific versions

#### Install the latest version (default)

```yaml
- name: Install the latest version of jarl
  uses: etiennebacher/setup-jarl@v0.1.0
  with:
    version: "latest"
```

#### Install a specific version

```yaml
- name: Install a specific version of jarl
  uses: etiennebacher/setup-jarl@v0.1.0
  with:
    version: "0.4.4"
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
  uses: etiennebacher/setup-jarl@v0.1.0
  with:
    github-token: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
```

## Outputs

| Output         | Description                             |
|----------------|-----------------------------------------|
| `jarl-version` | The version of Jarl that was installed. |


[Configuring Jarl]: https://jarl.etiennebacher.com/config
[github.workspace]: https://docs.github.com/en/actions/reference/context-and-expression-syntax-for-github-actions#github-context
