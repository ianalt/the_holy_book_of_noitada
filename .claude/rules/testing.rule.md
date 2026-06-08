# Testing rules
- Every acceptance criterion (AC) in requirements.md maps to at least one test.
- A task is not complete until: biome check passes, architecture tests pass, and the
  ACs it claims to cover have passing tests.
- Prefer testing behaviour (use cases, contracts) over implementation details.
