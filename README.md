# MNGR v1.0.2 — Phase 1 Deployment Candidate

Standalone, read-only management intelligence for AGNT teams.

## Source boundary

- Built against the confirmed-working `AGNT-v1.37.5-Micro-Stability` data contract.
- No AGNT application file was changed, copied over or replaced.
- MNGR is its own static PWA and should be hosted separately from AGNT.
- Firebase Authentication and the existing Firebase project are shared.

## Phase 1 features

- Verified team-owner access only.
- Live team overview and management brief.
- Today, this-week and four-week accountability totals.
- Individual agent scorecards and direction of travel.
- Calls, connects, data, knocking and appointment trends.
- Upcoming appointments across verified team members.
- Recent appointment outcomes.
- Past appointments requiring an outcome.
- Team-assigned appointment deduplication and correct agent attribution.
- Separate booked-date and scheduled-date reporting.
- Cached reporting with visible freshness and permission state.
- Unavailable data remains pending rather than appearing as zero.
- Responsive desktop, tablet and iPhone layouts.
- Installable PWA with offline application shell.

## Read-only guarantee

MNGR does not import Firestore write functions and contains no UI that changes AGNT data. Signing in and signing out are the only account actions.

The supplied Firestore rules add manager **read access only** to:

- The `days` records of a verified member of the manager's current team, which contain accountability totals and appointments.

The rules do not give MNGR access to:

- `users/{uid}/prospecting/*`
- Other users' profile documents
- Contacts or prospect notes
- MarketPulse state
- Authentication administration
- Writes to another user's profile or dated records

All existing AGNT owner-write permissions, team collections and leaderboard permissions are retained.

## Deployment

1. Create a separate GitHub Pages repository or separate folder/domain for MNGR.
2. Upload the contents of this package to that location.
3. Replace the Firebase project's Firestore rules with the included `firestore.rules`, then publish them.
4. Open MNGR and sign in using the AGNT account that owns the team.
5. If using a custom domain, add the domain to Firebase Authentication's authorised domains.

Do not deploy these files over the AGNT repository.

## Firebase changes required

Yes: publish the supplied additive Firestore rules before MNGR can read team-member dated records.

No data migration, Cloud Functions, Blaze plan, new collection or composite index is required.

## Files

- `index.html` — application shell and dashboard views
- `styles.css` — responsive MNGR design system
- `app.js` — authentication, read-only subscriptions and reporting logic
- `firebase-config.js` — existing Firebase web configuration
- `firestore.rules` — current AGNT rules plus the scoped MNGR read boundary
- `FIREBASE-CHANGE.md` — required Firebase change and deployment check
- `FIREBASE-AUDIT.md` — AGNT compatibility audit and permission matrix
- `PRE-DEPLOYMENT-CHECKLIST.md` — staged launch, regression and rollback checks
- `manifest.json` — PWA metadata
- `service-worker.js` — offline application shell
- `icons/` — MNGR PWA artwork

## Important limitation

MNGR can report appointments and outcomes recorded inside the existing AGNT dated records. It deliberately does not inspect private Prospector contacts or notes. Prospecting trends are calculated from the accountability and appointment summaries AGNT already publishes.
