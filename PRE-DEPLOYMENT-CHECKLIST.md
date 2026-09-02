# MNGR pre-deployment checklist

## Before publishing Firebase rules

- [ ] Confirm the live AGNT app is operating normally.
- [ ] Copy the currently deployed Firestore rules into a dated backup file.
- [ ] Compare the live rules with the v1.37.5 rules included in the confirmed-working AGNT package.
- [ ] If the live rules contain later intentional changes, merge only the two clearly labelled MNGR additions rather than replacing those later changes.
- [ ] Publish the audited `firestore.rules` from this package.

## Manager access check

- [ ] Sign into MNGR using the AGNT account that owns the team.
- [ ] Confirm MNGR shows `Permissions verified`.
- [ ] Confirm the number of loaded agents matches the verified AGNT team.
- [ ] Confirm a normal team-member account cannot open MNGR reporting.

## Reporting check

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

## Rollback

If AGNT or MNGR reports a permission error after publishing:

1. Restore the dated Firestore rules backup.
2. Publish the restored rules.
3. Confirm AGNT synchronisation returns to normal.
4. Do not change or delete any Firestore data.
