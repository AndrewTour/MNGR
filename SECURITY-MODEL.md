# MNGR security and authority model

## Roles

- **Team manager:** creates a MNGR account and may view only resources with an active approved grant.
- **Team leader:** owns an AGNT team, retains access to that team and can approve or revoke a manager.
- **Team member:** uses AGNT inside a team and cannot approve team-wide access.
- **Solo agent:** may approve access to their own reporting while they remain outside a team.

## Approval lifecycle

1. A manager creates a seven-day approval link for either a team or solo agent.
2. The recipient opens the link and signs in using their existing AGNT account.
3. A team request can be bound only to a team currently owned by the approver.
4. An individual request can be bound only to the signed-in approver while they are a solo agent.
5. Approval and grant creation occur in one Firestore batch.
6. The manager's live portfolio updates when the grant becomes active.
7. The grantor or manager can revoke the grant. Reporting reads stop immediately.

## Automatic safety conditions

- Creating a manager profile grants no reporting access.
- A team grant remains valid only while the original grantor remains the current team owner.
- A direct-agent grant remains valid only while the grantor is that agent and the agent remains outside a team.
- A solo agent joining a team automatically loses direct-manager readability until the team leader approves a team request.
- Request documents use random IDs and cannot be listed by other users.
- MNGR cannot write AGNT operational collections.

## Reporting visibility

A verified team owner, or a manager with an active team grant, receives read-only access to:

- team metadata;
- team membership;
- team leaderboard summaries;
- team-assigned appointments; and
- dated accountability records for current verified team members.

An active solo-agent grant allows read-only access to:

- that agent's legacy leaderboard row; and
- that agent's dated accountability records.

It does not permit access to Prospector contacts, notes, MarketPulse state, user profile documents or Authentication administration.
