# Firebase compatibility audit

Audited against the `firestore.rules` and Firestore operations contained in the confirmed-working `AGNT-v1.37.5-Micro-Stability` package.

## Result

The original AGNT rules remain byte-for-byte equivalent after the two clearly labelled MNGR additions are removed. No existing AGNT permission is narrowed, replaced or redirected.

MNGR adds one effective permission only:

- The verified owner of a team may read `users/{memberUid}/days/{date}` while that user remains a verified member of the same team.

## Permission matrix

| Data path | AGNT agent | Verified team owner through MNGR | Other signed-in user |
| --- | --- | --- | --- |
| `users/{uid}` | Own read/write | No additional access | Denied |
| `users/{uid}/days/{date}` | Own read/write | Team-member read only | Denied |
| `users/{uid}/prospecting/*` | Own read/write | Denied | Denied |
| `users/{uid}/marketPulseInbox/*` | Own read/write | Denied | Denied |
| `leaderboard/{uid}` | Existing permission unchanged | No additional access | Existing permission unchanged |
| `teams/{teamId}` | Existing permission unchanged | Existing owner permission | Existing permission unchanged |
| `teams/{teamId}/members/*` | Existing permission unchanged | Existing owner permission | Existing permission unchanged |
| `teams/{teamId}/appointments/*` | Existing permission unchanged | Existing owner permission | Existing permission unchanged |
| `teams/{teamId}/leaderboard/*` | Existing permission unchanged | Existing owner permission | Existing permission unchanged |
| `teamCodes/{code}` | Existing permission unchanged | Existing owner permission | Existing permission unchanged |

## AGNT operations checked

- Personal profile read/write
- Dated activity read/write
- Prospector state read/write
- MarketPulse inbox read/write
- Solo leaderboard publishing
- Team creation, joining, leaving and deletion
- Team membership management
- Team leaderboard read/write
- Team appointment creation, acknowledgement and deletion
- Join-code lookup and rotation

## Access removal

MNGR access requires both the member's current `teamId` and a live membership document under that exact team. Deleting the membership document therefore removes manager access immediately, even if the former member's cached profile has not yet been updated.

## MNGR application behaviour

The MNGR JavaScript imports no Firestore write functions. It reads only:

- The signed-in manager's own AGNT profile to resolve their team.
- Existing team metadata, members, leaderboard and assigned appointments.
- Dated activity documents for verified team members.

## Validation completed

- JavaScript syntax checks passed.
- Static PWA asset checks passed.
- No Firestore write API is present in MNGR.
- Removing the labelled MNGR additions makes the supplied rules byte-identical to the AGNT v1.37.5 rules.
- ZIP integrity check passed.

The rules have not been deployed to the live Firebase project and have not been tested against production data. Back up the currently deployed rules and confirm they still match the v1.37.5 baseline before publishing.
