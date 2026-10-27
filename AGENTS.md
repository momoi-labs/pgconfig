# Agent Guide for pgconfig

Essential commands, structure, and patterns for AI agents.

## Essential Commands

```bash
just web          # Build the web app, which the server embeds
just test         # Web tests, then cargo test (goldens included)
just lint         # cargo fmt --check and cargo clippy -D warnings
just run          # Serve the API, the web app, and MCP on :3000
just check-conf   # Load a generated config in PostgreSQL (needs Docker)
just release-build  # Rehearse the release build for Linux and macOS
```

`mise.toml` lists every tool the repository uses: Rust, Node, just, and the
release tooling. `mise install` sets them up. Do not
add another tool manager, such as Nix. Run commands through `mise exec --`
when the tools are not on the `PATH`.

## Project Structure

```
.
├── crates/pgconfig/         # Tuning engine, no I/O. `tune` is the entry point
├── crates/pgconfig-server/  # axum: REST v1, OpenAPI at /docs, MCP at /mcp, web app
├── crates/pgconfigctl/      # clap CLI
├── crates/golden/           # Records and replays tests/golden
├── crates/parameter-docs/   # Extracts parameters/ from the PostgreSQL source
├── web/                     # React 19, Vite, Kiso: comparison, export, guide
├── tests/golden/            # Recorded REST v1 and CLI outputs
├── skills/                  # Agent skills of this repository
├── parameters/              # The manual's entry for each parameter, per version
├── rules.yml                # Rule metadata (abstracts, recommendations)
└── pg-docs.yml              # REST v1 `show_doc` text, frozen (ADR 0003)
```

## Code Patterns

- **Rust**, edition 2024, one Cargo workspace. `rustfmt.toml` sets
  `max_width = 100`.
- **axum** for HTTP, **clap** for the CLI, **utoipa** for OpenAPI, **rmcp** for
  MCP.
- **English Language**: All code comments, documentation, and variable names must be in English.
- `crates/pgconfig/src/rules.rs` is the one place values are computed. `tune`
  and the `v1` module both start from it.
- `tune` takes a Tuning Request and returns recommendations with reasons,
  assumptions, and warnings. Use the domain terms: Tuning Request, Tuning
  Recommendation, Tuning Assumption, PostgreSQL Version, PostgreSQL Major
  Version.
- The `v1` module reproduces REST v1 and `pgconfigctl`, known defects included.
  Read `docs/adr/0001-rust-engine-with-v1-frozen-by-goldens.md` before
  changing it.
- `rules.yml`, `pg-docs.yml`, and `parameters/` are compiled into the crate by
  its `build.rs`. No YAML is parsed at run time.
- Three v1 output formats besides JSON: `conf`, `alter_system`, `stackgres`.
- The guide imports its pages with `?guide`. `web/guideMarkdown.ts` renders
  their fenced blocks at build time with Expressive Code, in Kiso's colors.

## Testing

- `cargo test` runs the unit tests and replays every golden against the Rust
  server and CLI. `tests/golden/README.md` explains the goldens.
- A change to a rule must come with re-recorded goldens. Never edit a golden
  by hand, and never weaken one to make a test pass.
- The server tests need the web bundle: run `just web` first. `cargo test`
  fails with `the web bundle is missing` when you have not.
- `crates/pgconfig/tests/snapshots` holds `insta` snapshots of full results.
- CI: `cover.yml` (Verify), `integration.yml` (the generated config loads in
  PostgreSQL 9.5 to 18), `mcp-conformance.yml`.

## Adding a New Rule

1. Add the calculation to `compute` in `crates/pgconfig/src/rules.rs`, and the
   setting to `Computed` and `Computed::groups`. A setting the release lacks
   is `None`, never zero.
2. Add its reason in `crates/pgconfig/src/reasons.rs`.
3. Write the test first, in `crates/pgconfig/tests/tuning.rs`.
4. Update `rules.yml` if the rule needs metadata. `pg-docs.yml` is frozen, so
   a parameter it lacks gets an empty `show_doc` entry in REST v1: raise that
   with the user before adding one.
5. Record the goldens again and review the diff. A rule change alters REST v1
   output, so it needs a changeset.

## MCP

`docs/mcp.md` is the public contract of `/mcp`. Change it with the code, and
keep the server stateless and read-only.

## CI/CD

- **cover.yml**: release config checks, the web and Rust test suite, and a
  build on macOS and Windows
- **integration.yml**: loads the generated config in PostgreSQL 9.5 to 18
- **mcp-conformance.yml**: the official MCP conformance suite, pinned
- **changesets.yml**: on `main`, opens or updates the Changesets version PR;
  merging it tags `v<version>` and calls `release.yml`
- **release.yml**: builds every target, then publishes with GoReleaser:
  binaries, deb and rpm packages, and Docker images, using the tag's
  `CHANGELOG.md` entry as release notes
- **pr-title.yml**: validates pull request titles as Conventional Commits

## Commit Conventions

Follow commit conventions from `~/.claude/pgconfig.md`:

```
<type>: <subject line (max 50 chars)>

<body wrapped at 80 cols, focus on WHY not WHAT>
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `ci`,
`build`, `perf`, `revert`

Rules:
- Title ≤50 chars, imperative mood ("fix" not "fixed").
- Body wrapped at 80 cols, focus on WHY.
- Use `feat` only for user-facing product capabilities. Release automation,
  workflows, and other CI/CD infrastructure must use `ci`.
- Add a changeset (`npm run changeset`) for each user-visible change and commit
  it with the change. CI and docs-only changes need none. See
  `docs/releases.md`.
- Sign‑off required (`-s`).
- **STRICTLY FORBIDDEN**: AI attribution footers (e.g., "Generated with Crush", "Assisted by...").
- **STRICTLY FORBIDDEN**: Adding "Co-authored-by" unless explicitly requested by the user.
- **English Only**: Commit messages must be in English.
- **Breaking changes require explicit approval**: Agents must never choose a
  `major` changeset, add `!` to a commit/PR type, or add a `BREAKING CHANGE:`
  footer unless the user explicitly requests a breaking change or major release.
  A large change is not necessarily a breaking change; when in doubt, use a
  non-breaking type and ask the user.

## Gotchas

1. **Web before cargo**: the server embeds `web/dist`, which is not committed.
2. **REST v1 is frozen**: its defaults, error texts, and HTTP 500 for invalid
   input are pinned by the goldens. Fix v1 behavior in a new API version.
3. **Byte parsing**: v1 is permissive (`2GB`, `2gb`, a bare number means
   bytes). `tune` is strict and requires a unit.
4. **PostgreSQL version defaults**: default is 18, supported 9.1–18.
5. **AIO parameters (PostgreSQL 18+)**: `io_method` and `io_workers` only
   available in ≥18. `io_workers` scaled by profile: Desktop 10%, WEB 20%,
   Mixed 25%, OLTP 30%, DW 40%, +10% for HDD, capped at 32.
6. **Float arithmetic**: the memory formulas run in `f32` in the order Go ran
   them. Reordering an operation changes outputs.
7. **Parameter docs are generated**: `parameters/` changes only through the
   extractor. See the `update-parameter-docs` skill below.

## Agent skills

### Issue tracker

Issues and specs for this repository live in GitHub Issues. See
`docs/agents/issue-tracker.md`.

### Triage labels

This repository uses the default triage labels. See
`docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.

### Parameter docs

To regenerate `parameters/` after a PostgreSQL release, for a new major
version, or when the extractor stops, use
[update-parameter-docs](skills/update-parameter-docs/SKILL.md).

### Commit convention

Create commits with `my-commit` (conventional commits). PR titles and commit
messages are validated by the `conventional-commits` workflow; merges use
rebase-and-merge.
