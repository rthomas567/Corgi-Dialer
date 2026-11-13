## SignalWire test version

- Same as the Twilio version with power and parallel dialing, but runs on SignalWire (same settings as before).

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
