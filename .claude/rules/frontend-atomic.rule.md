# Frontend — Atomic Design
- Layers: atom -> molecule -> organism -> feature.
- A lower layer never imports a higher one (atoms never import molecules, etc.).
- Data fetching via TanStack Query in the feature slice, not inside atoms/molecules.
- Routing via TanStack Router in the feature slice.
- Enforced by: tests/architecture/atomic-layers.arch.test.ts
