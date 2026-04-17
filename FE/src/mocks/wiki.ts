import type { WikiPage } from '../types';

export const mockWikiPages: WikiPage[] = [
  // ── Engineering ────────────────────────────────────────────────────
  {
    id: 'wiki-eng-1',
    title: 'Architecture Overview',
    emoji: '📐',
    icon: '📐',
    section: 'Engineering',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    viewCount: 34,
    commentCount: 5,
    tags: ['🏗️ architecture', '⚙️ backend', 'v2.4'],
    contributors: [
      { initials: 'LT', name: 'Leo T.', role: 'Author', colorClass: 'ds-av-lt' },
      { initials: 'PK', name: 'Priya K.', role: 'Reviewed', colorClass: 'ds-av-pk' },
    ],
    versions: [
      { label: 'v5', ago: '3 days ago', isLatest: true },
      { label: 'v4', ago: '2 weeks ago' },
      { label: 'v3', ago: 'Feb 20, 2026' },
    ],
    relatedPageIds: ['wiki-eng-2', 'wiki-eng-4'],
    content: `<h2>System Architecture</h2>
<p>BrainBoard is a full-stack TypeScript application built on a <strong>React + FastAPI</strong> stack. The frontend communicates with the backend exclusively via a REST API versioned at <code>/api/v1</code>.</p>
<h3>Frontend</h3>
<p>The React 19 SPA uses <strong>Vite</strong> as the build tool, <strong>Zustand</strong> for global state, and <strong>TanStack Query</strong> for server state and caching. Routing is handled by <strong>React Router v7</strong>.</p>
<h3>Backend</h3>
<p>The Python FastAPI backend connects to a <strong>PostgreSQL 16</strong> database via SQLAlchemy 2.0 (async). Authentication is handled by a dedicated auth service using JWT + refresh token rotation.</p>
<h2>Data Flow</h2>
<p>All API calls are authenticated via Bearer tokens. The frontend automatically refreshes expired tokens using the refresh token stored in an HttpOnly cookie.</p>
<ul>
  <li>Browser → React SPA → Vite Dev Server (dev) / CDN (prod)</li>
  <li>React SPA → FastAPI → PostgreSQL</li>
  <li>FastAPI → Redis (session cache, rate limiting)</li>
</ul>
<h2>Deployment</h2>
<p>Services are containerised with <strong>Docker</strong> and orchestrated via <strong>Docker Compose</strong> locally and <strong>Kubernetes</strong> in production. CI/CD is managed by GitHub Actions.</p>
<pre><code># Start all services locally
docker compose up --build</code></pre>`,
  },
  {
    id: 'wiki-eng-2',
    title: 'Auth & Security Guide',
    emoji: '🔐',
    icon: '🔐',
    section: 'Engineering',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-04-15T14:30:00.000Z',
    viewCount: 12,
    commentCount: 3,
    tags: ['🔒 security', '🔑 auth', '⚙️ backend', 'v2.4'],
    contributors: [
      { initials: 'PK', name: 'Priya K.', role: 'Last edited', colorClass: 'ds-av-pk' },
      { initials: 'LT', name: 'Leo T.', role: 'Co-author', colorClass: 'ds-av-lt' },
      { initials: 'AM', name: 'Aiko M.', role: 'Reviewed', colorClass: 'ds-av-am' },
    ],
    versions: [
      { label: 'v7', ago: '2 days ago', isLatest: true },
      { label: 'v6', ago: '1 week ago' },
      { label: 'v5', ago: 'Mar 20, 2026' },
      { label: 'v4', ago: 'Feb 14, 2026' },
    ],
    linkedIssues: [
      { id: 'BB-247', title: 'Safari 2FA bug', type: 'bug' },
      { id: 'BB-254', title: 'JWT rotation', type: 'bug' },
      { id: 'BB-259', title: 'PKCE enforcement', type: 'story' },
    ],
    relatedPageIds: ['wiki-eng-1', 'wiki-eng-4', 'wiki-eng-5'],
    content: `<p><strong>⚠️ Active incident:</strong> BB-247 — Login failures on Safari with 2FA are under investigation. See the linked issue for live status.</p>

<h2>Overview</h2>
<p>This document covers BrainBoard's authentication architecture, security policies, and implementation patterns. All engineers working on auth-related features must read this before opening a PR.</p>
<p>Our auth stack is built on <strong>JWT + refresh token rotation</strong> with optional TOTP-based 2FA. OAuth integrations use the PKCE flow exclusively — the implicit grant was deprecated in v2.2.</p>
<blockquote><strong>Related issue:</strong> PKCE enforcement for all providers is tracked in BB-259 and scheduled for Sprint 13.</blockquote>

<h2>Token Architecture</h2>
<h3>Access tokens</h3>
<p>Access tokens are short-lived JWTs (<strong>15 minutes</strong>) signed with RS256. They carry the user's <code>sub</code>, <code>role</code>, <code>workspace_id</code>, and a <code>jti</code> for revocation. Never store these in <code>localStorage</code> — use an in-memory store only.</p>
<h3>Refresh tokens</h3>
<p>Refresh tokens are opaque 256-bit random strings stored in an <strong>HttpOnly, Secure, SameSite=Strict</strong> cookie. Each use rotates the token. Detect reuse attacks via the family chain — revoke the entire family on reuse detection.</p>
<pre><code>// Token rotation in middleware
async function rotateRefreshToken(oldToken: string) {
  const family = await db.tokenFamilies.findByToken(oldToken);
  if (family.used) {
    await db.tokenFamilies.revokeAll(family.id); // reuse detected
    throw new SecurityError('Token reuse detected');
  }
  const newToken = crypto.randomBytes(32).toString('hex');
  await db.tokenFamilies.rotate(family.id, newToken);
  return newToken;
}</code></pre>

<h2>Two-Factor Authentication (2FA)</h2>
<p>2FA is implemented with TOTP using <code>otplib</code>. Users enroll via a QR code backed by a base32 secret stored encrypted at rest (AES-256-GCM). Backup codes are hashed with bcrypt before storage.</p>
<blockquote><strong>Known issue:</strong> Safari fails the 2FA handshake when the session cookie is dropped mid-flow. This affects ~12% of users. Tracked in BB-247 — do not merge changes to the 2FA flow until this is resolved.</blockquote>
<h3>TOTP validation flow</h3>
<ol>
  <li>User submits username + password → server returns a <code>pending_mfa</code> session token (60s TTL).</li>
  <li>Client submits the 6-digit TOTP code with the pending token.</li>
  <li>Server validates TOTP with a ±1 step window to handle clock skew.</li>
  <li>On success, issue access + refresh token pair and clear pending session.</li>
</ol>

<h2>OAuth Integrations</h2>
<p>All third-party OAuth flows must use <strong>PKCE (Proof Key for Code Exchange)</strong>. The table below summarises supported providers and their current status:</p>
<table>
  <thead><tr><th>Provider</th><th>PKCE</th><th>Scopes</th><th>Status</th></tr></thead>
  <tbody>
    <tr><td>GitHub</td><td>✅ Yes</td><td><code>read:user</code>, <code>repo</code></td><td><strong>Live</strong></td></tr>
    <tr><td>Google</td><td>✅ Yes</td><td><code>openid</code>, <code>email</code></td><td><strong>Live</strong></td></tr>
    <tr><td>Slack</td><td>⚠️ Partial</td><td><code>users:read</code></td><td>In progress</td></tr>
    <tr><td>GitLab</td><td>❌ No</td><td>—</td><td>Backlog</td></tr>
  </tbody>
</table>

<h2>Security Checklist</h2>
<ul>
  <li>Never log JWTs, refresh tokens, or TOTP secrets — mask all auth headers in logs.</li>
  <li>Rate-limit login endpoints: <strong>5 attempts / 10 min / IP</strong> with exponential backoff.</li>
  <li>All password comparison must use <code>bcrypt.compare()</code> — never plain equality.</li>
  <li>Rotate the JWT signing secret immediately if it leaks — see BB-254 for the current rotation task.</li>
  <li>Run <code>npm audit</code> before every release and fix any critical CVEs.</li>
</ul>
<blockquote><strong>Last security audit:</strong> March 2026 — no critical findings. Next scheduled audit: June 2026. Full report in Google Drive.</blockquote>`,
  },

  // Sub-pages of Auth & Security Guide
  {
    id: 'wiki-eng-2a',
    title: '2FA Implementation',
    icon: '🔑',
    section: 'Engineering',
    parentId: 'wiki-eng-2',
    projectId: 'project-1',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-04-10T10:00:00.000Z',
    tags: ['🔐 2fa', '⚙️ backend'],
    contributors: [{ initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' }],
    versions: [{ label: 'v3', ago: '1 week ago', isLatest: true }],
    content: `<h2>TOTP Setup Flow</h2>
<p>When a user enables 2FA, the server generates a base32-encoded secret and returns a QR code URL for the authenticator app to scan.</p>
<pre><code>import { authenticator } from 'otplib';
const secret = authenticator.generateSecret();
const uri = authenticator.keyuri(user.email, 'BrainBoard', secret);</code></pre>
<h2>Backup Codes</h2>
<p>Ten single-use backup codes are generated at enrollment time. Each code is hashed with <code>bcrypt</code> and stored. On use, the hash is deleted.</p>`,
  },
  {
    id: 'wiki-eng-2b',
    title: 'OAuth Flows',
    icon: '🔗',
    section: 'Engineering',
    parentId: 'wiki-eng-2',
    projectId: 'project-1',
    createdAt: '2026-02-05T10:00:00.000Z',
    updatedAt: '2026-03-25T10:00:00.000Z',
    tags: ['🔑 oauth', 'pkce'],
    contributors: [{ initials: 'LT', name: 'Leo T.', role: 'Author', colorClass: 'ds-av-lt' }],
    versions: [{ label: 'v2', ago: '3 weeks ago', isLatest: true }],
    content: `<h2>PKCE Flow Overview</h2>
<p>All OAuth integrations use <strong>PKCE (Proof Key for Code Exchange)</strong> to prevent authorization code interception attacks.</p>
<ol>
  <li>Client generates a random <code>code_verifier</code> (43–128 chars).</li>
  <li>Client derives <code>code_challenge = BASE64URL(SHA256(code_verifier))</code>.</li>
  <li>Client sends <code>code_challenge</code> with the authorization request.</li>
  <li>Client sends <code>code_verifier</code> with the token exchange request.</li>
</ol>`,
  },
  {
    id: 'wiki-eng-2c',
    title: 'JWT Reference',
    icon: '📋',
    section: 'Engineering',
    parentId: 'wiki-eng-2',
    projectId: 'project-1',
    createdAt: '2026-02-08T10:00:00.000Z',
    updatedAt: '2026-03-18T10:00:00.000Z',
    tags: ['🔑 jwt', '⚙️ backend'],
    contributors: [{ initials: 'AM', name: 'Aiko M.', role: 'Author', colorClass: 'ds-av-am' }],
    versions: [{ label: 'v2', ago: '4 weeks ago', isLatest: true }],
    content: `<h2>Token Structure</h2>
<p>Access tokens are RS256-signed JWTs with the following payload claims:</p>
<table>
  <thead><tr><th>Claim</th><th>Type</th><th>Description</th></tr></thead>
  <tbody>
    <tr><td><code>sub</code></td><td>string</td><td>User UUID</td></tr>
    <tr><td><code>role</code></td><td>string</td><td>admin | pm | developer | viewer</td></tr>
    <tr><td><code>workspace_id</code></td><td>string</td><td>Active workspace UUID</td></tr>
    <tr><td><code>jti</code></td><td>string</td><td>Unique token ID for revocation</td></tr>
    <tr><td><code>exp</code></td><td>number</td><td>Expiry (15 min from iat)</td></tr>
  </tbody>
</table>`,
  },
  {
    id: 'wiki-eng-4',
    title: 'Database Schema',
    emoji: '🗄️',
    icon: '🗄️',
    section: 'Engineering',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-04-05T10:00:00.000Z',
    viewCount: 22,
    commentCount: 2,
    tags: ['🗄️ database', 'postgresql', 'v2.4'],
    contributors: [
      { initials: 'AM', name: 'Aiko M.', role: 'Author', colorClass: 'ds-av-am' },
      { initials: 'LT', name: 'Leo T.', role: 'Reviewed', colorClass: 'ds-av-lt' },
    ],
    versions: [
      { label: 'v4', ago: '12 days ago', isLatest: true },
      { label: 'v3', ago: 'Mar 5, 2026' },
    ],
    relatedPageIds: ['wiki-eng-1'],
    content: `<h2>Core Tables</h2>
<p>All tables use UUID primary keys and include <code>created_at</code> / <code>updated_at</code> timestamps.</p>
<h3>users</h3>
<table>
  <thead><tr><th>Column</th><th>Type</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td><code>id</code></td><td>uuid</td><td>PK, gen_random_uuid()</td></tr>
    <tr><td><code>email</code></td><td>text</td><td>UNIQUE, NOT NULL</td></tr>
    <tr><td><code>password_hash</code></td><td>text</td><td>bcrypt, 12 rounds</td></tr>
    <tr><td><code>role</code></td><td>text</td><td>admin | pm | developer | viewer</td></tr>
    <tr><td><code>totp_secret</code></td><td>text</td><td>AES-256-GCM encrypted, nullable</td></tr>
  </tbody>
</table>
<h3>projects</h3>
<p>Each project has a unique slug used in API routes. Projects are scoped to a workspace.</p>
<h2>Migrations</h2>
<p>Migrations use <strong>Alembic</strong>. Always run <code>alembic upgrade head</code> after pulling changes.</p>`,
  },
  {
    id: 'wiki-eng-5',
    title: 'Deployment Runbook',
    emoji: '🚀',
    icon: '🚀',
    section: 'Engineering',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-20T10:00:00.000Z',
    updatedAt: '2026-04-12T10:00:00.000Z',
    viewCount: 18,
    commentCount: 1,
    tags: ['🚀 devops', 'kubernetes', 'ci/cd'],
    contributors: [{ initials: 'LT', name: 'Leo T.', role: 'Author', colorClass: 'ds-av-lt' }],
    versions: [{ label: 'v3', ago: '5 days ago', isLatest: true }],
    relatedPageIds: ['wiki-eng-1'],
    content: `<h2>Release Process</h2>
<p>Releases follow a <strong>tag-based deployment</strong> model. All merges to <code>main</code> trigger the staging pipeline automatically. Production deployments require a manual tag.</p>
<ol>
  <li>Merge feature branch to <code>main</code> — staging auto-deploys.</li>
  <li>Smoke test staging at <code>staging.brainboard.io</code>.</li>
  <li>Tag release: <code>git tag v2.4.1 &amp;&amp; git push --tags</code></li>
  <li>GitHub Actions builds, pushes image, and rolls out to prod.</li>
</ol>
<h2>Rollback</h2>
<pre><code>kubectl rollout undo deployment/api -n production
kubectl rollout status deployment/api -n production</code></pre>
<blockquote><strong>Important:</strong> Always check the #deployments Slack channel before rolling back — another engineer may be mid-release.</blockquote>`,
  },
  {
    id: 'wiki-eng-6',
    title: 'Performance Playbook',
    emoji: '⚡',
    icon: '⚡',
    section: 'Engineering',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-03-28T10:00:00.000Z',
    viewCount: 9,
    commentCount: 0,
    tags: ['⚡ performance', 'caching', 'indexing'],
    contributors: [{ initials: 'AM', name: 'Aiko M.', role: 'Author', colorClass: 'ds-av-am' }],
    versions: [{ label: 'v2', ago: '3 weeks ago', isLatest: true }],
    content: `<h2>Database Indexing</h2>
<p>Always add indexes for columns used in <code>WHERE</code>, <code>ORDER BY</code>, and foreign key constraints. Use <code>EXPLAIN ANALYZE</code> to validate query plans.</p>
<h2>API Response Caching</h2>
<p>Cache expensive queries in <strong>Redis</strong> with a TTL appropriate to data freshness requirements:</p>
<ul>
  <li>User profile data: <strong>5 minutes</strong></li>
  <li>Project list: <strong>1 minute</strong></li>
  <li>Dashboard stats: <strong>30 seconds</strong></li>
</ul>
<h2>Frontend Bundle</h2>
<p>Target a <strong>&lt; 200 kB</strong> initial JS bundle. Use dynamic imports for heavy features (charts, PDF export). Run <code>vite build --report</code> to audit bundle size.</p>`,
  },

  // ── Design ────────────────────────────────────────────────────────
  {
    id: 'wiki-des-1',
    title: 'Design System',
    emoji: '🎨',
    icon: '🎨',
    section: 'Design',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-12T10:00:00.000Z',
    updatedAt: '2026-04-08T10:00:00.000Z',
    viewCount: 41,
    commentCount: 7,
    tags: ['🎨 design', 'tokens', 'figma'],
    contributors: [{ initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' }],
    versions: [{ label: 'v6', ago: '9 days ago', isLatest: true }],
    content: `<h2>Design Tokens</h2>
<p>All visual decisions are encoded as <strong>CSS custom properties</strong> (design tokens). Tokens are defined in <code>src/index.css</code> and automatically adapt to light/dark mode.</p>
<h3>Colour palette</h3>
<table>
  <thead><tr><th>Token</th><th>Light</th><th>Dark</th><th>Use</th></tr></thead>
  <tbody>
    <tr><td><code>--bb-nav-active-color</code></td><td>#E75026</td><td>#E75026</td><td>Primary brand orange</td></tr>
    <tr><td><code>--bb-text-primary</code></td><td>#172B4D</td><td>#E6EDF3</td><td>Body text</td></tr>
    <tr><td><code>--bb-bg-card</code></td><td>#FFFFFF</td><td>#161B22</td><td>Card / panel background</td></tr>
  </tbody>
</table>
<h2>Typography</h2>
<p>BrainBoard uses two typefaces: <strong>DM Serif Display</strong> for large headings and <strong>DM Sans</strong> for all body text, labels, and UI elements.</p>`,
  },
  {
    id: 'wiki-des-2',
    title: 'Component Library',
    emoji: '🧩',
    icon: '🧩',
    section: 'Design',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-04-02T10:00:00.000Z',
    viewCount: 27,
    commentCount: 4,
    tags: ['🧩 components', 'react', 'storybook'],
    contributors: [{ initials: 'LT', name: 'Leo T.', role: 'Author', colorClass: 'ds-av-lt' }],
    versions: [{ label: 'v4', ago: '2 weeks ago', isLatest: true }],
    content: `<h2>Component Catalogue</h2>
<p>All reusable components live in <code>src/components/</code> and <code>src/features/*/components/</code>. Shared primitives are in <code>src/components/common/</code>.</p>
<h3>Common components</h3>
<ul>
  <li><strong>LoadingSkeleton</strong> — animated placeholder for async data</li>
  <li><strong>EmptyState</strong> — zero-data message with optional CTA</li>
  <li><strong>PriorityBadge</strong> — coloured badge for issue priority</li>
  <li><strong>RoleBadge</strong> — coloured badge for user roles</li>
</ul>
<h2>Usage Guidelines</h2>
<p>Prefer composition over customisation. If a new variant is needed more than twice, add it to the component rather than using one-off inline styles.</p>`,
  },
  {
    id: 'wiki-des-3',
    title: 'Copywriting Guide',
    emoji: '✍️',
    icon: '✍️',
    section: 'Design',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-02-10T10:00:00.000Z',
    updatedAt: '2026-03-20T10:00:00.000Z',
    viewCount: 14,
    commentCount: 2,
    tags: ['✍️ writing', 'ux copy'],
    contributors: [{ initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' }],
    versions: [{ label: 'v2', ago: '4 weeks ago', isLatest: true }],
    content: `<h2>Voice &amp; Tone</h2>
<p>BrainBoard's copy is <strong>clear, concise, and direct</strong>. We use plain language and avoid jargon. Write for the user who is in the middle of a task — not for a marketing brochure.</p>
<h3>Principles</h3>
<ul>
  <li><strong>Be specific.</strong> "Saved" beats "Your changes have been successfully saved to the system."</li>
  <li><strong>Use active voice.</strong> "Create a project" not "A project can be created."</li>
  <li><strong>Lead with the action.</strong> Button labels should be verbs.</li>
</ul>
<h2>Error Messages</h2>
<p>Error messages must explain what went wrong AND what the user can do to fix it. Never just say "An error occurred."</p>`,
  },

  // ── Product ───────────────────────────────────────────────────────
  {
    id: 'wiki-pro-1',
    title: 'Product Roadmap',
    emoji: '🗺️',
    icon: '🗺️',
    section: 'Product',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-04-14T10:00:00.000Z',
    viewCount: 58,
    commentCount: 11,
    tags: ['🗺️ roadmap', 'q2-2026', 'strategy'],
    contributors: [
      { initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' },
      { initials: 'AM', name: 'Aiko M.', role: 'Co-author', colorClass: 'ds-av-am' },
    ],
    versions: [{ label: 'v8', ago: '3 days ago', isLatest: true }],
    content: `<h2>Q2 2026 Themes</h2>
<p>Our focus for Q2 is <strong>collaboration</strong> — making it easier for teams to work together across projects, surfaces, and timezones.</p>
<h3>In progress</h3>
<ul>
  <li>Real-time collaborative editing in Wiki (Sprint 12–13)</li>
  <li>@mention notifications across issues and wiki pages (Sprint 12)</li>
  <li>Cross-project dependency linking (Sprint 13)</li>
</ul>
<h3>Planned</h3>
<ul>
  <li>GitHub PR integration — link PRs to issues automatically (Sprint 14)</li>
  <li>Slack notifications for issue status changes (Sprint 14–15)</li>
</ul>
<h2>Q3 2026 Preview</h2>
<p>Mobile app (iOS + Android) with offline-first support. Analytics dashboard v2 with custom chart builder.</p>`,
  },
  {
    id: 'wiki-pro-2',
    title: 'User Research Notes',
    emoji: '🔬',
    icon: '🔬',
    section: 'Product',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-02-20T10:00:00.000Z',
    updatedAt: '2026-04-06T10:00:00.000Z',
    viewCount: 19,
    commentCount: 3,
    tags: ['🔬 research', 'ux', 'interviews'],
    contributors: [{ initials: 'AM', name: 'Aiko M.', role: 'Author', colorClass: 'ds-av-am' }],
    versions: [{ label: 'v3', ago: '11 days ago', isLatest: true }],
    content: `<h2>Sprint 12 Usability Study</h2>
<p>We ran 6 moderated usability sessions on the new Kanban board redesign. Participants were existing users (PM and developer roles) from 3 different customer organisations.</p>
<h3>Key findings</h3>
<ul>
  <li>5/6 participants missed the "move to sprint" affordance — consider making it a primary action.</li>
  <li>The priority badge colours passed accessibility contrast checks but were "hard to distinguish" at small sizes for 2 participants.</li>
  <li>All participants successfully created and linked issues without guidance.</li>
</ul>
<h2>Recommendations</h2>
<p>Prioritise: (1) improved discoverability of sprint assignment, (2) larger priority badge targets on mobile.</p>`,
  },
  {
    id: 'wiki-pro-3',
    title: 'Release Notes v2.4',
    emoji: '📊',
    icon: '📊',
    section: 'Product',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    viewCount: 35,
    commentCount: 6,
    tags: ['📊 release', 'changelog', 'v2.4'],
    contributors: [{ initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' }],
    versions: [{ label: 'v1', ago: 'Apr 1, 2026', isLatest: true }],
    content: `<h2>What's new in v2.4</h2>
<p>Released April 1, 2026. This release focuses on performance, developer experience, and accessibility improvements.</p>
<h3>New features</h3>
<ul>
  <li><strong>Wiki editor</strong> — Replaced Markdown editor with rich Tiptap editor supporting tables, task lists, and inline code.</li>
  <li><strong>Dark mode</strong> — Full dark theme across all surfaces, persisted to localStorage.</li>
  <li><strong>RBAC v2</strong> — Granular permission system with per-project role overrides.</li>
</ul>
<h3>Bug fixes</h3>
<ul>
  <li>Fixed drag-and-drop in Kanban on Firefox (BB-231)</li>
  <li>Fixed session expiry not redirecting on 401 (BB-238)</li>
  <li>Fixed avatar initials for multi-word names (BB-242)</li>
</ul>
<h3>Breaking changes</h3>
<p>Wiki content format changed from Markdown to HTML. Run the migration script: <code>npm run migrate:wiki</code></p>`,
  },

  // ── Onboarding ────────────────────────────────────────────────────
  {
    id: 'wiki-onb-1',
    title: 'Welcome Guide',
    emoji: '👋',
    icon: '👋',
    section: 'Onboarding',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-04-03T10:00:00.000Z',
    viewCount: 67,
    commentCount: 4,
    tags: ['👋 onboarding', 'getting-started'],
    contributors: [{ initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' }],
    versions: [{ label: 'v5', ago: '2 weeks ago', isLatest: true }],
    content: `<h2>Welcome to BrainBoard! 🎉</h2>
<p>We're thrilled to have you on the team. This guide will help you get oriented in the first week. By the end of day 1 you should have your dev environment running and your first commit in.</p>
<h2>Day 1 checklist</h2>
<ul>
  <li>Get access to GitHub org, Slack, and Linear from your manager</li>
  <li>Clone the repo and run the dev environment (see Dev Environment Setup)</li>
  <li>Introduce yourself in <code>#general</code> on Slack</li>
  <li>Read the Architecture Overview and Team Conventions docs</li>
  <li>Attend the daily standup at 9:30 AM</li>
</ul>
<h2>Key contacts</h2>
<table>
  <thead><tr><th>Who</th><th>Role</th><th>For questions about…</th></tr></thead>
  <tbody>
    <tr><td>Priya K.</td><td>Engineering Lead</td><td>Architecture, security, escalations</td></tr>
    <tr><td>Leo T.</td><td>Backend Lead</td><td>API, database, infra</td></tr>
    <tr><td>Aiko M.</td><td>Frontend Lead</td><td>React, design system, UX</td></tr>
  </tbody>
</table>`,
  },
  {
    id: 'wiki-onb-2',
    title: 'Dev Environment Setup',
    emoji: '🛠️',
    icon: '🛠️',
    section: 'Onboarding',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-03-30T10:00:00.000Z',
    viewCount: 51,
    commentCount: 2,
    tags: ['🛠️ setup', 'docker', 'local'],
    contributors: [{ initials: 'LT', name: 'Leo T.', role: 'Author', colorClass: 'ds-av-lt' }],
    versions: [{ label: 'v4', ago: '18 days ago', isLatest: true }],
    relatedPageIds: ['wiki-eng-5'],
    content: `<h2>Prerequisites</h2>
<ul>
  <li>Node.js 22+ (use <code>nvm</code> or <code>fnm</code>)</li>
  <li>Python 3.12+</li>
  <li>Docker Desktop 4.30+</li>
  <li>Git 2.40+</li>
</ul>
<h2>Quick start</h2>
<pre><code># 1. Clone the repo
git clone git@github.com:brainboard/brainboard.git
cd brainboard

# 2. Start all services
docker compose up -d

# 3. Install frontend deps &amp; start dev server
cd FE &amp;&amp; npm install &amp;&amp; npm run dev

# 4. The app is now at http://localhost:5173</code></pre>
<h2>Environment variables</h2>
<p>Copy <code>.env.example</code> to <code>.env.development</code> and fill in the required values. Ask your manager for the dev secrets — never commit secrets to Git.</p>
<blockquote><strong>Tip:</strong> If Docker ports conflict, edit <code>docker-compose.yml</code> to remap them. The default ports are 8000 (API), 5432 (Postgres), 6379 (Redis).</blockquote>`,
  },
  {
    id: 'wiki-onb-3',
    title: 'Team Conventions',
    emoji: '📋',
    icon: '📋',
    section: 'Onboarding',
    parentId: null,
    projectId: 'project-1',
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-04-07T10:00:00.000Z',
    viewCount: 44,
    commentCount: 3,
    tags: ['📋 process', 'git', 'code review'],
    contributors: [
      { initials: 'PK', name: 'Priya K.', role: 'Author', colorClass: 'ds-av-pk' },
      { initials: 'LT', name: 'Leo T.', role: 'Co-author', colorClass: 'ds-av-lt' },
    ],
    versions: [{ label: 'v3', ago: '10 days ago', isLatest: true }],
    content: `<h2>Git conventions</h2>
<p>We follow <strong>trunk-based development</strong> with short-lived feature branches (max 2 days).</p>
<h3>Branch naming</h3>
<ul>
  <li><code>feat/BB-123-short-description</code></li>
  <li><code>fix/BB-456-short-description</code></li>
  <li><code>chore/description</code></li>
</ul>
<h3>Commit messages</h3>
<p>Follow Conventional Commits: <code>type(scope): description</code>. Types: <code>feat</code>, <code>fix</code>, <code>chore</code>, <code>docs</code>, <code>refactor</code>, <code>test</code>.</p>
<h2>Pull request process</h2>
<ul>
  <li>All PRs require <strong>1 approval</strong> minimum.</li>
  <li>Link the issue in the PR description using <code>Closes #BB-123</code>.</li>
  <li>Keep PRs small — if it touches more than 400 lines, consider splitting.</li>
  <li>Respond to review comments within <strong>1 business day</strong>.</li>
</ul>
<h2>Meetings</h2>
<table>
  <thead><tr><th>Meeting</th><th>When</th><th>Who</th></tr></thead>
  <tbody>
    <tr><td>Daily standup</td><td>Mon–Fri 9:30</td><td>Full team</td></tr>
    <tr><td>Sprint planning</td><td>Every 2 weeks, Mon</td><td>Full team</td></tr>
    <tr><td>Retro</td><td>Every 2 weeks, Fri</td><td>Full team</td></tr>
    <tr><td>1:1 with lead</td><td>Weekly</td><td>Individual</td></tr>
  </tbody>
</table>`,
  },
];
