# CLAUDE.md

This project follows Spec-Driven Development. The spec is the source of truth.

## Before doing anything
1. Read `specs/constitution.md` — inviolable project principles.
2. Read the relevant `specs/<feature>/` folder for the feature you're working on.
3. Never write code that contradicts a spec. If reality conflicts with the spec, STOP
   and ask — the spec is edited first, then the code follows.

## Conventions (enforced by gates)
- See `.claude/rules/` for naming, DDD, Atomic Design and testing rules.
- All code, identifiers and comments in English.

## Workflow
- Feature work goes through: /spec -> /plan -> /tasks -> /implement -> /review.
- One atomic task at a time. A task is done only when biome, architecture tests and the
  feature's acceptance tests all pass.
