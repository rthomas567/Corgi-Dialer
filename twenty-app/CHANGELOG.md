## Company dialer: Companies and People tabs

- "Start dialing" on Companies now has two tabs.
- Companies tab: each selected company with its phone number (or "No phone number") and a DO NOT CALL badge where it applies; dial the main lines as before.
- People tab: everyone at each selected company with job title, phone, email and city. Call one person with their own Call button, or tick several and power / parallel dial them. Companies with nobody show "There are no people associated with this company."

## Power and parallel dialing

- New "Start dialing" on People, Companies, and the new Call Queue: power (1 line) or parallel (2-5 lines).
- First person to pick up is connected; a second is hung up and shown as "call back".
- Voicemails are detected and skipped; every attempt is logged.
- Rep presses 1 to start, so their own voicemail can't start a session.
- Do Not Call now also covers Do Not Call / YC Company Do Not Call / Call Disposition on companies and people, and blocks any number saved as DNC.
- New Call Queue (sidebar) with "Add to Call Queue".

## Switched to Twilio

- Calls now go through Twilio instead of SignalWire.
- New settings: Twilio Account SID and Twilio Auth Token. The four SignalWire settings are gone.
- Call updates are always checked against the Twilio Auth Token.

# Changelog

All notable changes to this application are documented in this file.

## 0.1.0

- Initial application scaffolded with [`create-twenty-app`](https://www.npmjs.com/package/create-twenty-app)
