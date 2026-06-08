# Design: <Feature Name>

> The HOW. Must satisfy every acceptance criterion in requirements.md and obey
> constitution.md. Spend the strong model here.

## Data model (Prisma)
<model definitions; note which constraints enforce which AC>

## API contract
<METHOD /path  body { ... } -> status codes>

## Domain decisions
- <decision> -> <which AC / constraint it satisfies and why>
- Repositories: <abstract class> in domain/, <Prisma impl> in infrastructure/.

## Frontend (Atomic Design)
- atoms: <...>
- molecules: <...>
- organisms: <...>
- feature slice: <queries (TanStack), routes>

## Traceability
<AC1 -> component> · <AC2 -> component> · <AC3 -> component>
