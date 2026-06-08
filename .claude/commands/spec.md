---
description: Create requirements.md for a feature through interactive Q&A
argument-hint: <feature-name>
---
Act as the spec-writer agent (.claude/agents/spec-writer.agent.md).
1. Read specs/constitution.md.
2. For feature "$ARGUMENTS": ask me clarifying questions about scope, edge cases and
   acceptance criteria. Do NOT write the file until I answer.
3. Then write specs/$ARGUMENTS/requirements.md using
   specs/_templates/requirements.template.md.
4. Show the result and stop. Do not plan or implement.
