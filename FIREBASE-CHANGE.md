# Required Firebase changes

AGNT application code remains untouched. MNGR v2 requires additive security rules, access-control collections and two indexes.

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
