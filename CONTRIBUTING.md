# Contributing to Kythia Workspace

First off, thank you for considering contributing to Kythia Workspace! It's people like you that make Kythia such a great tool for the development community.

Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project. In return, they should reciprocate that respect in addressing your issue, assessing changes, and helping you finalize your pull requests.

---

## Tech Stack Overview

If you want to contribute code, it helps to understand our stack:

- **Frontend**: React + Vite + TypeScript.
- **Backend**: Rust + Tauri v2.
- **Package Manager**: Bun (`bun`).

All service orchestration logic lives in the Rust backend (`src-tauri/src/`), while the Presentation Layer and IPC invocations live in the frontend (`src/`).

## Local Development Setup

To get your local environment set up:

1. **Prerequisites**:
   - [Bun](https://bun.sh/)
   - [Rust Toolchain](https://rustup.rs/) (including `cargo`)
   - Visual Studio Code (Recommended) with `rust-analyzer` and `Tauri` extensions.

2. **Clone the Repository**:
   ```bash
   git clone https://github.com/kenndeclouv/kythia-workspace.git
   cd kythia-workspace
   ```

3. **Install Dependencies**:
   ```bash
   bun install
   ```

4. **Run the App in Dev Mode**:
   ```bash
   bun tauri dev
   ```
   *This command will compile the Rust backend, start the Vite dev server, and open the Tauri application window.*

## Reporting Bugs

Bugs are tracked as GitHub issues. When creating an issue, please explain the problem and include additional details to help maintainers reproduce the problem:

- **Use a clear and descriptive title** for the issue.
- **Describe the exact steps** which reproduce the problem.
- **Provide specific examples** to demonstrate the steps (e.g. your `settings.json` or screenshots).
- **Describe the behavior you observed** after following the steps and point out what exactly is the problem with that behavior.
- **Explain which behavior you expected to see instead and why.**
- **Include your OS version** (e.g., Windows 11 23H2).

## Suggesting Enhancements

Enhancement suggestions are also tracked as GitHub issues. 
- **Use a clear and descriptive title** for the issue.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Explain why this enhancement would be useful** to most Kythia users.

## Pull Requests

1. **Fork the repo** and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs or features, update the documentation in the `docs/` folder.
4. Ensure the test suite passes (if applicable).
5. Ensure your Rust code is formatted via `cargo fmt` and passes `cargo clippy`.
6. Issue that pull request!

### Code Review Process

The core team looks at Pull Requests on a regular basis. After feedback has been given we expect responses within two weeks. After two weeks we may close the pull request if it isn't showing any activity.

---
*By contributing to Kythia Workspace, you agree that your contributions will be licensed under its MIT License.*
