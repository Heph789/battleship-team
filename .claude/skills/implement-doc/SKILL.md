---
name: implement-doc
description: Sequentially implement issues from a local document using TDD (red-green-simplify) on a single branch, pausing for user approval between issues.
argument-hint: "path to issue document"
---

# Implement Doc

Implement the issues listed in the given document: `$ARGUMENTS`

Work through each issue sequentially in order. Do not combine work from separate issues or parallelize work across issues. All work happens on the current branch — do not create per-issue branches or PRs. A scaffold may be referenced in the document — DO NOT COPY IMPLEMENTATION CODE FROM THE SCAFFOLD. It is only a reference for structure and design. Prioritize design decisions already made in implemented code over the scaffold.

## Issue Document Format

The document should contain a list of issues, each with a title and description. Read the document first to understand the full scope, then work through issues one at a time.

## Process (per issue)

### 1. Present the Issue

Before starting work, present the issue title and a brief summary to the user. Wait for the user to confirm before proceeding. If the user says to skip, move to the next issue.

### 2. Red Phase — Tests First

Use the `go-tester` agent to create tests before any implementation. The ONLY code allowed before go-tester are interfaces and stubs required to build the tests. Do NOT write any implementation code before the tests exist and fail. Verify the tests compile and fail (red) before proceeding to Step 3.

### 3. Green Phase — Implementation

Use a subagent to implement the issue such that the tests pass. Do NOT implement inline — always delegate to a subagent. This subagent should implement test by test, committing at each step.

**Commenting standards:**
- Every exported function and method gets a Go doc comment explaining what it does, its parameters, and its return values.
- Every package gets a doc comment in `doc.go` (or at the top of the primary file) explaining the package's purpose and how it fits into the system.
- Non-obvious internal logic gets inline comments explaining *why*, not *what*.

### 4. Simplify

Use the simplifier (code-simplifier:code-simplifier) agent to clean up the code. Watch especially for dead code.

### 5. Commit

Stage and commit the work for this issue with a descriptive message referencing the issue title.

### 6. Next

Ask the user if they are ready to proceed to the next issue. Wait for confirmation before continuing. If the user wants to stop, stop.

## Subagent Discipline

Steps 2, 3, and 4 MUST be performed by subagents — never in the implementor's own context. This is non-negotiable: do NOT read source files and start writing production code or tests inline. The main agent's role is orchestration only — presenting issues, committing, and launching subagents. If a subagent call fails due to an API error or transient failure, retry the subagent call. Do NOT fall back to doing the work inline.

## Compaction

When compacting, only keep the instructions for this skill and relevant context for the issue currently being worked on.
