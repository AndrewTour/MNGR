# Required Firebase changes

AGNT application code remains untouched. MNGR v2.0.1 requires additive security rules, access-control collections and two indexes.

## v2.0.1 query-safe owner read

The `teams` match includes an explicit owner-only `allow list` expression. It permits only a signed-in user's `ownerUid == request.auth.uid` team query and expresses the same ownership permission already present for direct reads. It adds no writes and grants no access to another user's team.

## v2.3.0 team-owner reporting correction

MNGR already recognises an AGNT team owner as having automatic access to their own team. The dated-record rule now recognises that same verified ownership when reading a current member's `users/{uid}/days` reporting records. Previously, those reads required a separate manager grant, which caused one unavailable source for every member when the team owner used MNGR directly.

This is read-only and limited to current verified members of the owner's team. It adds no AGNT writes and does not expose profiles, Prospector, contacts, notes or another team's data.

## New MNGR-only collections

- `managerProfiles/{managerUid}` records that an authenticated account can create access requests.
- `managementRequests/{requestId}` stores seven-day approval requests.
- `managerAccess/{managerUid}/grants/{resourceType__resourceId}` stores active or revoked authority.

These collections do not replace or modify AGNT operational data.

## Reporting permissions added

An active team grant permits read-only access to the team, its member directory, team leaderboard, team appointments and current members' dated accountability records.

An active direct-agent grant permits read-only access to that solo agent's leaderboard and dated accountability records.

No manager receives access to user profiles, Prospector, contacts, notes, MarketPulse or AGNT writes.

## Deployment

1. Back up the currently deployed Firestore rules.
2. Compare them with the stable v1.37.5 baseline.
3. Merge or publish the supplied `firestore.rules` without removing any later intentional production changes.
4. Deploy `firestore.indexes.json`.
5. Test the approval workflow with test manager, team leader and solo-agent accounts.
6. Complete the AGNT regression checklist before production rollout.

No Cloud Function, Admin SDK, Blaze plan or data migration is required.
