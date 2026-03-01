# Contributing to Heury

Thanks for your interest in contributing to heury! This guide covers everything you need to get started.

## Code of Conduct

All participants are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## CLA Requirement

Before your first pull request can be merged, you must sign the [Contributor License Agreement](CLA.md). This is managed automatically via the CLA Assistant GitHub App — you'll be prompted to sign when you open your first PR.

The CLA grants the project maintainer a perpetual license to use contributions in any context, including commercial products. You retain copyright to your contributions.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

```sh
git clone https://github.com/djgrant/heury.git
cd heury
npm install
npm run build
```

### Running Tests

```sh
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### Type Checking

```sh
npm run lint          # TypeScript strict mode check
```

## Development Workflow

### Branch Naming

- `feat/description` — new features
- `fix/description` — bug fixes
- `refactor/description` — refactoring
- `docs/description` — documentation

### Test-Driven Development

We follow TDD. For every change:

1. Write failing tests first
2. Write the minimum code to make them pass
3. Refactor while keeping tests green

### Pull Request Process

1. Fork the repo and create your branch from `main`
2. Write tests for your changes
3. Ensure all tests pass: `npm test`
4. Ensure the build succeeds: `npm run build`
5. Ensure types check: `npm run lint`
6. Open a PR with a clear description of the change

## Code Standards

- **TypeScript strict mode** — no `any` types, strict null checks
- **Vitest** for testing
- **Hexagonal architecture** — separate domain logic from infrastructure
- **SOLID principles** — single responsibility, dependency inversion, etc.

For deeper context, see:
- [Architecture Decisions](docs/architecture-decisions.md) — ADRs explaining key design choices
- [Project Vision](docs/project-vision.md) — overall goals, scope, and design philosophy

## What to Contribute

Check the [issue tracker](https://github.com/djgrant/heury/issues) for open issues. Issues labeled `good first issue` are a great starting point.

## Questions?

Open a [discussion](https://github.com/djgrant/heury/discussions) or an issue if you're unsure about anything.
