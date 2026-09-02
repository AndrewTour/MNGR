# MNGR v2.4.0 — Period and Viewport Fix

Standalone management intelligence for multiple AGNT teams and authorised solo agents.

## v2.4.0 period and viewport correction

- Consolidates the installed-iPhone bottom navigation into one 56px viewport-fixed bar.
- Removes the legacy application padding that was adding space above the navigation.
- Makes Today, This week and Last 4 weeks recalculate Home, Team, Appointments and Trends from the same selected period.
- Makes homepage agent health, management priority, appointment preview, snapshot and activity chart period-aware.
- Makes appointment totals and lists use dates from the selected reporting period.
- Makes trend metrics, charts, conversions, agent rows and direction use the selected reporting period.
- Separates manager-tool query errors from AGNT reporting health so an access-workflow issue is not presented as missing agent data.
- AGNT application files, Firestore rules and indexes remain unchanged from v2.3.0.

## v2.3.0 weekly health and shell correction

- Makes weekly agent health the homepage focus with On track, At risk and Off track classifications.
- Sorts Off track agents first and shows weekly calls, connects and appointments for rapid coaching review.
- Uses current-week outcome gaps in the homepage priority while retaining the 28-day outcome view inside Appointments.
- Adds a clear AGNT-style Back control to the Access page.
- Pins navigation to a fixed 74px bottom bar and removes excess safe-area growth.
- Reduces side padding and removes the desktop frame borders from the iPhone shell.
- Corrects team-owner access to current members' dated reporting records, resolving the matching unavailable-source count.
- AGNT application files and all existing AGNT write permissions remain unchanged.

## v2.2.0 decision-first interface

- Rebuilt MNGR on AGNT's light canvas, blue hierarchy, divider-led sections and fixed navigation geometry.
- Leads with the current management priority, then agents requiring attention and the next seven days of appointments.
- Reduces the overview snapshot to completion, calls, connect rate and appointments.
- Limits overdue appointment outcomes to the most recent 28 days so historical records do not overwhelm the current management brief.
- Sorts the team pulse by lowest current completion first and limits the preview to five agents.
- Moves reporting period out of the header and into the reporting scope controls.
- Converts reporting-source errors into a compact data-availability status.
- Firebase rules, indexes, manager authority and AGNT application files remain unchanged.

## v2.1.0 interface refinement

- Rebuilt the iPhone reporting selector as one compact `Viewing` control.
- Team choices now show only the team name; agent choices show only the agent name.
- Reduced the fixed bottom navigation height and anchored it directly to the viewport safe area.
- Removed duplicated mobile headings and secondary copy where the selected scope already provides the context.
- Flattened mobile cards, tightened spacing and increased visible reporting content without removing functionality.
- Firebase rules, indexes, authority logic and AGNT application files are unchanged from the working v2.0.1 release.

## v2.0.1 compatibility fix

- Makes the existing team-owner read permission provable to Firestore when MNGR queries a signed-in team leader's owned teams.
- Replaces the misleading generic “rules not published” startup warning with a precise access-check message.
- Does not change AGNT application code, AGNT writes, team membership or manager authority boundaries.

## Source boundary

- Built against the confirmed-working `AGNT-v1.37.5-Micro-Stability` data contract.
- No AGNT application file was changed, copied over or replaced.
- MNGR is its own static PWA and should be hosted separately from AGNT.
- Firebase Authentication and the existing Firebase project are shared.

## Manager Authority features

- Manager account creation using Firebase Authentication.
- Secure approval links for requesting access to a team or solo agent.
- Team requests can only be approved by the current verified team owner.
- Solo-agent requests can only be approved by that agent while they remain outside a team.
- Explicit, revocable management grants.
- Portfolio reporting across multiple managed teams and direct agents.
- Team-level and individual-agent drill-down from one persistent scope selector.
- Existing team leaders retain automatic reporting access to teams they own.
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
- iPhone-first installed PWA shell with a locked, non-zooming viewport and safe-area support.
- AGNT-style fixed bottom navigation for Home, Team, Appointments and Trends.
- Persistent reporting scope selector for Whole Team or one isolated agent.
- Agent scope filters activity, appointments, outcomes, trends and coaching prompts together.
- Centred phone-sized dashboard shell on larger screens.
- Installable PWA with offline application shell.

## AGNT data guarantee

MNGR never writes AGNT activity, appointments, contacts, leaderboard records, team membership or user profiles.

MNGR writes only its own access-control metadata:

- `managerProfiles`
- `managementRequests`
- `managerAccess/{managerUid}/grants`

The supplied Firestore rules provide manager **read access only** to AGNT reporting data after a valid grant is approved.

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
3. Merge and publish the included `firestore.rules` against the currently deployed AGNT rules.
4. Deploy `firestore.indexes.json` to the same Firebase project.
5. Open MNGR and create a manager account, or sign in using an existing AGNT team-leader account.
6. If using a custom domain, add the domain to Firebase Authentication's authorised domains.

Do not deploy these files over the AGNT repository.

## Firebase changes required

Yes: publish the supplied rules and indexes before using manager requests and multi-team access.

No data migration, Cloud Functions or Blaze plan is required. The included Firestore indexes are required.

## Files

- `index.html` — application shell and dashboard views
- `styles.css` — responsive MNGR design system
- `app.js` — authentication, authority workflow, read-only reporting subscriptions and scope logic
- `firebase-config.js` — existing Firebase web configuration
- `firestore.rules` — current AGNT rules plus scoped MNGR authority and reporting access
- `firestore.indexes.json` — required access-request and approval indexes
- `SECURITY-MODEL.md` — roles, approval lifecycle and data boundaries
- `FIREBASE-CHANGE.md` — required Firebase change and deployment check
- `FIREBASE-AUDIT.md` — AGNT compatibility audit and permission matrix
- `PRE-DEPLOYMENT-CHECKLIST.md` — staged launch, regression and rollback checks
- `manifest.json` — PWA metadata
- `service-worker.js` — offline application shell
- `icons/` — MNGR PWA artwork

## Important limitation

MNGR can report appointments and outcomes recorded inside the existing AGNT dated records. It deliberately does not inspect private Prospector contacts or notes. Prospecting trends are calculated from the accountability and appointment summaries AGNT already publishes.
