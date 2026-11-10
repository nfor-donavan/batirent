# BatiRent: 10-minute demo script

Before you start: `npm run seed` (fresh dates), API + web running, log in as **manager@ylm.batirent.cm** (Yaoundé). Switch FR/EN and light/dark during the demo to show both.

1. **The problem (1 min).** Yards track steel on chalkboards; foremen keep scaffolding past the contract date; nobody can prove what came back cracked.
2. **Dashboard (2 min).** The big number is the share of the fleet currently on building sites. Point at the segmented bar (amber = on site, grey = in the yard, red = lost/damaged), the value of equipment at sites, and the accumulated overdue penalties.
3. **Overdue engine (2 min).** Open *Tchoupo Construction SARL* (Bastos, 9 days late). Show the daily penalty (rate × 1.5), the partial return recorded 2 days ago (penalty frozen on the earlier quantities, lower rate afterwards), the photo evidence with its SHA-256 fingerprint, the statement of account (rental + penalties − deposit), and the SMS the client received.
4. **Expiring contracts (1 min).** Back on the dashboard: warning rings for contracts due today / tomorrow.
5. **Field app (2 min).** Log in as **operator@ylm.batirent.cm** on the phone: large steppers, "+10" and "All" buttons, camera per damaged line, offline queue (turn on airplane mode, submit, then reconnect). Refresh the web contract page: the new inspection and photos are there.
6. **Trust (1 min).** *Parc matériel* → stock integrity check on the dashboard ("yard stock matches open contracts exactly"); *Journal d'audit*; log in as the Douala manager to show that yards never see each other's data.
7. **Close (1 min).** Roles, bilingual interface, ready for Render/Vercel/Atlas.
