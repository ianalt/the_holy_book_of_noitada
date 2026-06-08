# SDD Starter Kit

A ready-to-copy skeleton for running a project with Spec-Driven Development and
Claude Code. Stack assumed: React + TanStack / NestJS + Prisma + PostgreSQL /
TypeScript / BiomeJS, with DDD (backend) and Atomic Design (frontend).

## Layout
- `specs/constitution.md` — inviolable project principles (EDIT THIS FIRST).
- `specs/_templates/`      — requirements / design / tasks templates.
- `specs/game-ratings/`    — a worked example feature (delete when you start yours).
- `.claude/CLAUDE.md`      — entry point read by Claude Code each session.
- `.claude/rules/`         — conventions referenced by CLAUDE.md and agents.
- `.claude/agents/`        — specialized roles (spec-writer, planner, implementer, reviewer).
- `.claude/commands/`      — the cycle as slash commands (/spec /plan /tasks /implement /review).
- `tests/architecture/`    — example gates that make the constitution verifiable.

## How to start
1. Copy this kit into the root of your new repo.
2. Edit `specs/constitution.md` with your real stack and conventions.
3. Make sure every constitution principle has a gate in `tests/architecture/` or `biome.json`.
4. Delete `specs/game-ratings/` once you understand the shape.
5. Run `/spec <feature>` in Claude Code and follow the cycle.

## The cycle
idea -> (chat if fuzzy) -> /spec -> /plan -> /tasks -> /implement (loop + gates) -> /review -> commit
When a requirement changes: edit the spec first, then regenerate. Never let code drift
ahead of the spec.
