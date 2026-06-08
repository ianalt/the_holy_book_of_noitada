---
description: Review a finished feature against its spec
argument-hint: <feature-name>
---
Act as the reviewer agent (.claude/agents/reviewer.agent.md).
Read specs/$ARGUMENTS and the implemented code. Verify every AC has a passing test,
the API contract and data model match design.md, and constitution rules hold. Report
gaps explicitly; do not silently fix scope.
