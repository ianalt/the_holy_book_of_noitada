# Project Constitution

> Inviolable principles. Nothing in requirements.md / design.md / tasks.md or in code
> may contradict this file. Every principle below should map to an automated gate.

## Stack (fixed)
React + TanStack Router/Query · NestJS · Prisma · PostgreSQL · TypeScript · BiomeJS.
Package manager: npm (monorepo: apps/api, apps/web).

## Architecture
- Backend: Domain-Driven Design. One module per bounded context under
  ```apps/api/src/modules/<context>/```  with layers ```domain/``` , ```application/``` , ```infrastructure/``` ,
  ```presentation/```. Repository Pattern via abstract classes (abstract in ```domain/```, Prisma
  implementation in ```infrastructure/```).
- Frontend: Atomic Design. atom -> molecule -> organism -> feature. A lower layer never
  imports a higher one.

## Code conventions
- `I` prefix on ALL TypeScript types and interfaces (IRating, ICreateRatingInput).
- English everywhere: identifiers, comments, commit messages.
- Type-specific file extensions on the frontend: .atom.tsx, .molecule.tsx, .organism.tsx.

## Quality gates (a task is NOT done until ALL pass)
- `biome check` passes (lint + format).
- All architecture tests pass (```tests/architecture/```).
- Every acceptance criterion in the feature's requirements.md has a passing test.

## Security
- AI-generated code is reviewed for injection, authorization and exposed secrets
  before merge.
- Specs declare security constraints explicitly when the feature handles auth, money,
  PII or permissions.

## Workflow
- Feature work goes through: /spec -> /plan -> /tasks -> /implement -> /review.
- One atomic task at a time.
- The spec is the source of truth. When a requirement changes, edit the spec first,
  then regenerate. Never let code drift ahead of the spec.
