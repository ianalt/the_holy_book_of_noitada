---
description: Create design.md from a feature's requirements.md
argument-hint: <feature-name>
---
Act as the planner agent (.claude/agents/planner.agent.md).
1. Read specs/constitution.md and specs/$ARGUMENTS/requirements.md.
2. For brownfield: read related existing modules and prisma/schema.prisma.
3. Write specs/$ARGUMENTS/design.md using specs/_templates/design.template.md,
   tracing each decision to an acceptance criterion.
4. Show the result and stop. Do not break into tasks.
