---
description: Implement a single task from a feature
argument-hint: <feature-name> <task-id>
---
Act as the implementer agent (.claude/agents/implementer.agent.md).
1. Read specs/$ARGUMENTS (constitution, design.md, tasks.md).
2. Implement ONLY the given task id. Touch only the files it declares.
3. Run gates: biome check, tests/architecture/, and the acceptance tests for the
   AC(s) this task covers.
4. If any gate fails, fix and re-run. Mark the task checkbox done in tasks.md only
   when all gates pass. Then stop.
