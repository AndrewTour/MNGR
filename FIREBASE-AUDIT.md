# Firebase compatibility audit

Audited against the confirmed-working `AGNT-v1.37.5-Micro-Stability` Firestore rules and data contract.

## Result

Existing AGNT create, update and delete permissions remain structurally unchanged. MNGR adds new access-control paths and conditional read permissions only.

MNGR writes are restricted to its own manager profile, request and grant documents. It cannot write any AGNT activity, appointment, leaderboard, team membership, user profile, Prospector or MarketPulse record.

## Permission matrix

| Data path | AGNT user | Approved team manager | Approved solo-agent manager |
| --- | --- | --- | --- |
| `users/{uid}` | Existing own access | Denied | Denied |
| `users/{uid}/days/{date}` | Existing own access | Current team members, read only, for the verified team owner or approved manager | Approved solo agent only, read only |
| `users/{uid}/prospecting/*` | Existing own access | Denied | Denied |
| `users/{uid}/marketPulseInbox/*` | Existing own access | Denied | Denied |
| `leaderboard/{uid}` | Existing own access | No additional legacy access | Approved solo agent only, read only |
| `teams/{teamId}` | Existing access | Approved team, read only | Denied |
| `teams/{teamId}/members/*` | Existing access | Approved team, read only | Denied |
| `teams/{teamId}/appointments/*` | Existing access | Approved team, read only | Denied |
| `teams/{teamId}/leaderboard/*` | Existing access | Approved team, read only | Denied |
| MNGR access metadata | None required by AGNT | Own requests/grants only | Approval/revocation only |

## Security invariants

- A manager profile does not grant reporting access.
- Team approval requires the current team owner.
- Direct-agent approval requires the same signed-in solo agent.
- Team reads require either the current verified team owner or an active deterministic grant issued by that owner.
- Direct-agent reads require an active deterministic grant issued by that agent and automatically fail if the agent joins a team.
- Grant creation and request approval occur atomically in one batch.
- Either the grantor or manager can revoke an active grant.
- Request collection listing is restricted to the manager who created the requests.

## AGNT operations preserved

- Personal profile and dated activity read/write
- Prospector and MarketPulse read/write
- Solo leaderboard publishing
- Team creation, joining, leaving and deletion
- Team membership management
- Team leaderboard publishing
- Team appointment creation, acknowledgement and deletion
- Join-code lookup and rotation

The rules have not been deployed to the live Firebase project. Back up and compare the currently deployed rules before publishing, particularly if production has advanced beyond v1.37.5.
