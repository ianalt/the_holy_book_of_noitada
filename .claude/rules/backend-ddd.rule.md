# Backend — Domain-Driven Design
- One module per bounded context: apps/api/src/modules/<context>/.
- Layers: domain / application / infrastructure / presentation.
- Dependency rule: domain depends on nothing; application depends on domain;
  infrastructure and presentation depend inward. NEVER the reverse.
- Repositories: abstract class in domain/, Prisma implementation in infrastructure/.
- Enforced by: tests/architecture/ddd-boundaries.arch.test.ts
