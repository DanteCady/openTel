# OpenTel Git Flow

## Branching Model

- **main**: Production-ready. Tagged releases.
- **develop**: Integration branch. Feature branches merge here first.
- **feature/\***: New features (e.g. `feature/webrtc-signaling`)
- **fix/\***: Bug fixes (e.g. `fix/call-state-transition`)
- **chore/\***: Tooling, deps, config (e.g. `chore/update-deps`)

## Commit Convention (Conventional Commits)

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`

**Examples**:
- `feat(api): add POST /v1/tenants route`
- `fix(signaling): relay offer before answer in WebRTC flow`
- `chore: add eslint and prettier`
- `docs: add First Call walkthrough`

## Workflow

1. Branch from `develop` for features: `git checkout develop && git pull && git checkout -b feature/my-feature`
2. Commit with conventional format
3. Open PR to `develop`
4. After review, merge. Delete feature branch.
5. When ready for release: merge `develop` into `main`, tag (e.g. `v0.1.0`)

## Setting Up

```bash
git init
git checkout -b develop
```

Initial commit goes to `develop`; `main` is created on first release.
