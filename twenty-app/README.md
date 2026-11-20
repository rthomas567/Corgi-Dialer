# Corgi Dialer (Twenty app)

Adds a **Call** box with a big orange **Call** button to the top of every
person's page in Twenty. The rep's own phone rings first; when they pick
up, Twilio dials the person and shows the rep's work number as caller ID.

After the call, the rep picks one of ten outcomes (Connected, Voicemail, DNC,
Busy, No Answer, Receptionist, High Interest, Low Interest, Hard No, Wrong
Number), adds optional notes, and clicks **Save call**. That creates a
**Dialer Call** record linked to the person and their company. "Created by"
on the record shows which rep made the call. Saving again updates the same
record, so reps can fix a wrong pick.

Every saved call also moves the company's **Last Contacted** date forward to
the day of the call (it never moves backwards).

### Calling from a person's page

- The top of each person's **Home** tab has a **Call** box with a big orange
  **Call** button. The call status, hang-up button, and outcome step all
  appear right in that box. It's the only Call button (the small side-panel
  one was removed).
- **An outcome is required after every answered call.** When the call ends, a
  pop-up window asks for the outcome and the dialer locks on the outcome step.
  The rep can't start another call (from any page) until it's saved. If they
  navigate away, it comes back the next time they open the dialer. Calls the
  rep never picked up on their own phone don't need an outcome.

### Recordings

- Every connected call is recorded (both sides, mixed together for easy listening).
- Each call gets a **Dialer Call** record the moment it starts, "Created by"
  the rep, with **Rep**, **Call result** (Connected, No answer, Busy, Rep
  didn't pick up, and so on) filled in automatically. When the recording is
  ready (usually within a minute or two), a **Play recording** link and the
  recording length are added to that record.
- **Recorded Calls** in the left sidebar lists every recorded call, newest
  first. Filter by rep with the **Rep** column (or **Created by**).
- **Consent:** when the person picks up, they first hear the **Recording
  announcement** from the app settings, then get connected. Several states
  (including Illinois and California) require everyone on a call to agree to
  recording. Only clear the announcement if you're sure you don't need it.
- Recording links play without a login, and their addresses are long and random.
  Anyone who has a link can play it, so don't share links outside Twenty.
  Recordings are stored by Twilio.

### Do Not Call

- A company is Do Not Call when **any** of these is set: the **DNC** switch,
  **Do Not Call**, **YC Company Do Not Call**, **Lead Status = DNC**, or
  **Call Disposition = Do not call (in progress)**. The same flags on a
  person block that person. A phone number saved as DNC once is never dialed
  again, whichever record it's on. Nobody at that company can be called from the dialer:
  the panel shows a red "Do Not Call" banner instead of the Call button, and
  the server refuses to dial even if the panel was already open.
- Saving a call with the **DNC** outcome turns on the company's DNC switch
  and sets its Lead Status to DNC, for the whole team. The panel warns in red
  before saving and the save button reads "Save and mark Do Not Call".
- If the person has no company, only that person is blocked.
- **It's impossible to miss.** Every DNC company's page, and every page of a
  person who works there, shows a big solid-red **DO NOT CALL** block at the
  top of the Home tab, and the dialer has no Call button there. Both pages
  re-check every 15 seconds, so a company marked DNC by a teammate locks
  within seconds without a refresh.
- To undo: turn off the company's DNC switch **and** change its Lead Status.
  For a person with no company, change the outcome on their DNC Dialer Call.

### Power and parallel dialing

- **Start:** in People, Companies, or **Call Queue**, tick the records you want
  to call (up to 500), then click **Start dialing**. Pick **Parallel** (2-5
  lines at once) or **Power** (one at a time). Companies are called on their
  main line (Phone, then Company Phone).
- **Your phone rings first.** Pick up and **press 1**. (Pressing 1 means your
  own voicemail can never start a session.) You then wait on an open line.
- **Parallel:** the dialer calls several people at once. The first real person
  to pick up is connected to you, and the other lines are hung up. If someone
  else picks up at the same moment, they're hung up on (no message) and a
  yellow **"also picked up - call them back"** notice appears with their number.
  Lines hung up before anyone answered go back on the list once.
- **Voicemails** are detected by Twilio, hung up, and logged as Voicemail. You
  never hear them.
- **Outcome:** after each conversation, pick an outcome. Dialing continues
  only once it's saved.
- **Do Not Call:** every entry is checked right before it's dialed. Anyone
  DNC is skipped and never dialed, even if they were marked DNC mid-session.
- **Every attempt is logged** as a Dialer Call (no answer, busy, voicemail,
  call back, connected), by the rep.
- **Pause / Stop** buttons are on the panel. Dialing only moves forward while
  the dialer panel is open; hang up your phone to end the session.
  Get back to a running session with **Open dialer** (Ctrl/Cmd+K).
- **Call Queue:** tick people or companies and click **Add to Call Queue**.
  Entries are marked Called / Skipped - DNC / No phone number as they're dialed.

## How it works

```
Rep clicks "Call" in Twenty
        │
        ▼
start-call  ──►  Twilio rings the rep's phone
                          │  rep picks up
                          ▼
bridge      ──►  Twilio dials the person (rep's number as caller ID)
                          │
call-events ◄──  Twilio reports: ringing / answered / ended
call-status ◄──  the panel checks progress every 2 seconds
hang-up     ──►  ends the call from the panel
save-outcome──►  saves outcome + notes as a Dialer Call record,
                 updates Last Contacted, and applies DNC
call-check  ──►  the panel asks "is this person OK to call?" when it opens
whisper     ──►  plays the recording announcement to the person called
recording-ready◄ Twilio: "the recording is ready" → adds it to the record
```

| Folder | What's in it |
| --- | --- |
| `src/components/dialer.tsx` | The dialer itself (used in both places below) |
| `src/front-components/` | The person-page Call box and the company-page Do Not Call box |
| `src/page-layout-widgets/` | Places the Call box (person page) and Do Not Call box (company page) |
| `src/components/dnc-alert.tsx` | The big red DO NOT CALL block |
| `src/objects/dialer-call.object.ts` | The Dialer Call record type |
| `src/fields/` | The "Dialer Calls" lists on person and company pages |
| `src/shared/outcomes.ts` | The ten outcomes (edit here to change them) |
| `src/shared/dnc.ts` | The Do Not Call rules |
| `src/views/`, `src/navigation-menu-items/` | The Recorded Calls list and its sidebar entry |
| `src/logic-functions/` | The five server-side steps above |
| `src/shared/` | Helpers: phone formatting, Twilio, settings |
| `src/application-config.ts` | The app's settings (Twilio login, rep phones) |

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
   - **Twilio Account SID** and **Twilio Auth Token** (Twilio Console home
     page → Account Info). Both are kept secret; never put them in GitHub or
     chat. The Auth Token is also used to check that every call update really
     came from Twilio, so anything else is ignored.
   - **Rep phone settings**, one entry per rep, keyed by Twenty login email:
     ```json
     {
       "ricky@beagleforpm.com": { "callerId": "+15551230000", "ringTo": "+15559870000" }
     }
     ```
     `callerId` = a Twilio number you bought, or a number verified in Twilio
     (Phone Numbers → Verified Caller IDs). `ringTo` = the phone to ring
     first (their cell or desk phone). Always use the +1XXXXXXXXXX format.
4. Recordings: in Twilio, **Voice → Settings → General**, check "Enforce HTTP
   Auth on media URLs". If it is on, the "Play recording" links will ask for
   a login; turn it off for the links to play straight from Twenty.

## Updating after code changes

Push to GitHub. The "Deploy dialer to Twenty" GitHub Action installs the
update into Twenty automatically (see `.github/workflows/deploy-twenty-app.yml`
at the top of the repo). Watch it under the repo's **Actions** tab.

Automatic installs never delete anything from Twenty. When a change removes
something (like the old small Call button), run the install by hand once:
GitHub repo > **Actions** > **Deploy dialer to Twenty** > **Run workflow**,
tick **Also remove pieces deleted from the code**, and click **Run workflow**.

Running `yarn twenty apply` from a Windows PC does not work yet because of a
Twenty tool bug with Windows file paths.

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
- The DNC rules rely on the field names `dnc`, `doNotCall`,
  `ycCompanyDoNotCall`, `leadStatus` (option `DNC`) and `callDisposition`
  (option `DO_NOT_CALL_IN_PROGRESS`). Renaming them in Twenty breaks the check.
- Parallel dialing hangs up on a second person who answers at the same time
  (by choice, with no message). Federal rules cap these dropped calls at 3%
  of answered calls and expect a short message saying who called; check with
  whoever handles compliance. The "Call back" count shows how often it happens.
- Twilio's voicemail detection isn't perfect: now and then a person is treated
  as a voicemail, or a voicemail is connected to the rep.
- "Select all" on a huge view may only pass the records loaded on screen.
