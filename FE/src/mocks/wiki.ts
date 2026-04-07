import type { WikiPage } from '../types';

export const mockWikiPages: WikiPage[] = [
  // --- Top-level pages ---
  {
    id: 'wiki-1',
    title: 'Engineering Handbook',
    content: `# Engineering Handbook

Welcome to the 3SC engineering handbook. This is the single source of truth for how our engineering team works.

Use the sub-pages to explore our coding standards, git workflow, and on-call runbooks.`,
    parentId: null,
    projectId: 'project-1',
    updatedAt: '2026-02-10T10:00:00.000Z',
  },
  {
    id: 'wiki-2',
    title: 'API Documentation',
    content: `# API Documentation

Base URL: \`https://api.clientportal.3sc.internal/v2\`

All endpoints require a Bearer token in the \`Authorization\` header. Responses follow the JSON:API specification.

## Authentication
- \`POST /auth/login\` — Exchange credentials for an access token.
- \`POST /auth/refresh\` — Refresh an expired access token.
- \`DELETE /auth/logout\` — Invalidate the current session.`,
    parentId: null,
    projectId: 'project-1',
    updatedAt: '2026-03-15T14:30:00.000Z',
  },

  // --- Sub-pages under Engineering Handbook (wiki-1) ---
  {
    id: 'wiki-3',
    title: 'Git Workflow',
    content: `# Git Workflow

We follow a trunk-based development model with short-lived feature branches.

## Branch Naming
- Feature: \`feat/<ticket-id>-short-description\`
- Bug fix: \`fix/<ticket-id>-short-description\`
- Chore: \`chore/description\`

## Pull Requests
- All PRs require at least **1 approval** before merging.
- Link the related issue in the PR description.
- Squash and merge into \`main\`.`,
    parentId: 'wiki-1',
    projectId: 'project-1',
    updatedAt: '2026-02-12T09:00:00.000Z',
  },
  {
    id: 'wiki-4',
    title: 'Code Review Standards',
    content: `# Code Review Standards

Code reviews are a collaboration, not a gate. Keep feedback constructive and specific.

## Reviewer Checklist
- [ ] Does the code solve the stated problem?
- [ ] Are edge cases handled?
- [ ] Is there adequate test coverage?
- [ ] Are there any obvious performance or security concerns?

## Response SLA
Reviewers should respond within **1 business day** of being requested.`,
    parentId: 'wiki-1',
    projectId: 'project-1',
    updatedAt: '2026-02-18T11:00:00.000Z',
  },
  {
    id: 'wiki-5',
    title: 'On-Call Runbook',
    content: `# On-Call Runbook

## Escalation Path
1. Check the **#alerts** Slack channel for context.
2. Inspect logs in Datadog under the \`client-portal-prod\` service.
3. If unresolved in 15 minutes, page the engineering lead via PagerDuty.

## Common Incidents

### API returning 5xx
1. Check recent deployments on the CI/CD dashboard.
2. Roll back the last deployment if the timing correlates.
3. Open an incident channel: \`#inc-YYYY-MM-DD\`.`,
    parentId: 'wiki-1',
    projectId: 'project-1',
    updatedAt: '2026-03-20T16:00:00.000Z',
  },
];
