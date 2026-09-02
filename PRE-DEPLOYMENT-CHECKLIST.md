# MNGR pre-deployment checklist

## Before publishing Firebase rules

- [ ] Confirm the live AGNT app is operating normally.
- [ ] Copy the currently deployed Firestore rules into a dated backup file.
- [ ] Compare the live rules with the v1.37.5 rules included in the confirmed-working AGNT package.
- [ ] If the live rules contain later intentional changes, merge the MNGR authority additions rather than replacing those later changes.
- [ ] Publish the audited `firestore.rules` from this package.
- [ ] Deploy the included `firestore.indexes.json` and wait until both indexes are ready.

## Manager authority check

- [ ] Create a new MNGR manager account and confirm it initially has no reporting access.
- [ ] Create a team request and copy its approval link.
- [ ] Open the link as the verified team leader and approve the correct team.
- [ ] Confirm the approved team appears in the manager portfolio without a page reload.
- [ ] Create a solo-agent request and approve it using an AGNT account that is not attached to a team.
- [ ] Confirm a team member cannot approve a direct-agent request.
- [ ] Confirm a normal team member cannot approve a team request.
- [ ] Revoke both grant types and confirm reporting access stops immediately.
- [ ] Sign into MNGR using the AGNT account that owns a team and confirm their own team remains available.
- [ ] Confirm MNGR shows `Permissions verified`.
- [ ] Confirm the number of loaded agents matches the verified AGNT team.
- [ ] Confirm a normal team-member account with no approval link has no reporting data.

## Reporting check

- [ ] Select one `Team` scope and confirm combined figures are shown across all four tabs.
- [ ] Select `All Managed` and confirm totals combine every authorised team and direct agent without duplication.
- [ ] Switch between two approved teams and confirm names, members, appointments and totals do not leak between scopes.
- [ ] Select one agent and confirm every tab shows only that agent's activity, appointments, outcomes and trends.
- [ ] Confirm the appointment agent filter is locked to the selected agent while in individual scope.
- [ ] Return to `Whole Team` and confirm the appointment agent filter becomes available again.
- [ ] Compare one agent's calls, connects, data and knocking against AGNT for today.
- [ ] Compare one historical workday against the AGNT leaderboard history.
- [ ] Confirm a personal upcoming appointment appears once.
- [ ] Confirm a team-assigned appointment appears once and under the assigned agent.
- [ ] Confirm a completed appointment displays its recorded outcome.
- [ ] Confirm an appointment past its scheduled time without an outcome appears under `Needs attention`.
- [ ] Confirm `Booked` uses the appointment creation date and `Scheduled` uses the appointment date.

## AGNT regression check

- [ ] Sign into AGNT as the team owner and one normal member.
- [ ] Save a call, connect and data entry.
- [ ] Start and end a short knocking timer test.
- [ ] Create or edit a personal appointment.
- [ ] Assign a test appointment to another team member and acknowledge it.
- [ ] Open Prospector and confirm contacts load.
- [ ] Confirm MarketPulse continues to load its current state.
- [ ] Confirm the team leaderboard updates.

## Deployment

- [ ] Deploy MNGR to a separate repository and URL.
- [ ] Do not place MNGR files inside the AGNT repository.
- [ ] Add the MNGR hostname to Firebase Authentication authorised domains if required.
- [ ] Test the hosted MNGR URL before adding it to the iPhone Home Screen.
- [ ] On iPhone, confirm the app opens at a fixed scale, respects the notch/home indicator and does not zoom when a field or dropdown receives focus.
- [ ] Confirm all four bottom navigation items remain reachable above the iPhone home indicator.

## Rollback

If AGNT or MNGR reports a permission error after publishing:

1. Restore the dated Firestore rules backup.
2. Publish the restored rules.
3. Confirm AGNT synchronisation returns to normal.
4. Do not change or delete any Firestore data.
