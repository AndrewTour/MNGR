# Required Firebase rules change

The application code for AGNT remains untouched. MNGR requires one Firebase security extension so the verified team owner can read approved reporting records.

## What is added

`isManagerOfUser(userId)` verifies all of the following:

1. The requester is signed in.
2. The agent's profile currently identifies a team.
3. The requester owns that exact team.
4. The agent is still present in that team's verified member collection.

Only then may the requester read `users/{uid}/days/{date}` documents.

## What is not added

- No manager writes.
- No manager access to another user's profile document.
- No access to Prospector state.
- No access to contacts, MarketPulse or private nested data.
- No role or membership changes.
- No change to what agents can read or write.

## Deployment check

After publishing the rules:

- AGNT agents must still load and save their own data normally.
- A normal team member must not be able to read another member's day document.
- The team owner must be able to open MNGR and load verified team members.
- Removing a member from the team must immediately remove the owner's MNGR access to that former member.
