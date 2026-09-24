# Corgi Dialer (Twenty app)

Adds a **Call** button to every person's page in Twenty. Clicking it opens a
dialer panel on the right. The rep's own phone rings first; when they pick
up, SignalWire dials the person and shows the rep's work number as caller ID.

After the call, the rep picks one of ten outcomes (Connected, Voicemail, DNC,
Busy, No Answer, Receptionist, High Interest, Low Interest, Hard No, Wrong
Number), adds optional notes, and clicks **Save call**. That creates a
**Dialer Call** record linked to the person and their company. "Created by"
on the record shows which rep made the call. Saving again updates the same
record, so reps can fix a wrong pick.

Every saved call also moves the company's **Last Contacted** date forward to
the day of the call (it never moves backwards).

### Do Not Call

- A company is Do Not Call when its **DNC** switch is on **or** its **Lead
  Status** is **DNC**. Nobody at that company can be called from the dialer:
  the panel shows a red "Do Not Call" banner instead of the Call button, and
  the server refuses to dial even if the panel was already open.
- Saving a call with the **DNC** outcome turns on the company's DNC switch
  and sets its Lead Status to DNC, for the whole team. The panel warns in red
  before saving and the save button reads "Save and mark Do Not Call".
- If the person has no company, only that person is blocked.
- To undo: turn off the company's DNC switch **and** change its Lead Status.
  For a person with no company, change the outcome on their DNC Dialer Call.

## How it works

```
Rep clicks "Call" in Twenty
        │
        ▼
start-call  ──►  SignalWire rings the rep's phone
                          │  rep picks up
                          ▼
bridge      ──►  SignalWire dials the person (rep's number as caller ID)
                          │
call-events ◄──  SignalWire reports: ringing / answered / ended
call-status ◄──  the panel checks progress every 2 seconds
hang-up     ──►  ends the call from the panel
save-outcome──►  saves outcome + notes as a Dialer Call record,
                 updates Last Contacted, and applies DNC
call-check  ──►  the panel asks "is this person OK to call?" when it opens
```

| Folder | What's in it |
| --- | --- |
| `src/front-components/dialer-panel.tsx` | The panel reps see |
| `src/objects/dialer-call.object.ts` | The Dialer Call record type |
| `src/fields/` | The "Dialer Calls" lists on person and company pages |
| `src/shared/outcomes.ts` | The ten outcomes (edit here to change them) |
| `src/shared/dnc.ts` | The Do Not Call rules |
| `src/command-menu-items/` | The Call button on person pages |
| `src/logic-functions/` | The five server-side steps above |
| `src/shared/` | Helpers: phone formatting, SignalWire, settings |
| `src/application-config.ts` | The app's settings (SignalWire login, rep phones) |

## One-time install (admin)

Needs Node.js 24.5 or newer.

1. Open **Command Prompt as administrator** and run `corepack enable`
   (this turns on Yarn, the package tool this project uses).
2. In a normal Command Prompt, inside this folder:
   ```
   yarn install
   yarn twenty remote:add --url https://corgi-smb.twenty.com
   yarn twenty apply
   ```
   `remote:add` opens a browser to sign in to Twenty. `apply` shows what
   will be added and asks you to confirm.
3. In Twenty, go to **Settings → Apps → Corgi Dialer** and fill in:
   - **SignalWire Space URL**: e.g. `corgi-atlas.signalwire.com`
   - **SignalWire Project ID** and **SignalWire API Token** (kept secret;
     never put these in GitHub)
   - **Rep phone settings**, one entry per rep, keyed by Twenty login email:
     ```json
     {
       "ricky@beagleforpm.com": { "callerId": "+15551230000", "ringTo": "+15559870000" }
     }
     ```
     `callerId` = the rep's SignalWire number. `ringTo` = the phone to ring
     first (their cell or desk phone). Always use the +1XXXXXXXXXX format.
4. After your first successful test call, also fill in **SignalWire Signing
   Key** (SignalWire dashboard → API Credentials → Signing Key → Show). From
   then on, the dialer ignores any call update that didn't come from
   SignalWire. If calls stop updating right after you add it, clear the field
   and tell whoever maintains this app.

## Updating after code changes

```
git pull
yarn install
yarn twenty apply
```

## Checking problems

Watch the server-side steps live while you place a test call:

```
yarn twenty dev:function:logs
```

## Checks before pushing

```
yarn typecheck
yarn lint
yarn test:unit
```

## Known limits

- Rep phone settings are one shared block of text; a proper settings screen
  comes later.
- The Call button still appears on a DNC person's page; clicking it opens the
  panel with the red Do Not Call banner and no way to dial.
- The DNC rules rely on the company's `dnc` switch and a `DNC` option in
  Lead Status. Renaming either in Twenty breaks the check.
