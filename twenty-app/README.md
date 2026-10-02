# Corgi Dialer (Twenty app)

Adds a **Call** box with a big orange **Call** button to the top of every
person's page in Twenty. The rep's own phone rings first; when they pick
up, SignalWire dials the person and shows the rep's work number as caller ID.

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
  Recordings are stored by SignalWire.

### Do Not Call

- A company is Do Not Call when its **DNC** switch is on **or** its **Lead
  Status** is **DNC**. Nobody at that company can be called from the dialer:
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

## Atlas → Opportunities sync

Replaces the old Broker Submissions sync. Atlas sends its webhooks to
`https://corgi-smb.twenty.com/s/atlas/webhook`, and each Atlas **quote** becomes
one **Opportunity** (Pipeline = BROKERED, Lead Source = Broker), linked to the
quote in Atlas.

- `quote.status_changed` creates the Opportunity (first time) and moves its stage.
- `quote.pricing_changed` updates **Amount**; the newest price revision wins.
- `submission.coverage_changed` moves the stage and records the **Atlas Submission Number**.
- `submission.status_changed` (version-2 webhooks) fills in the insured name, the
  agency (**Company**, created if new) and the producer (**Person**, created if new).
- `policy.issued` sets **BOUND** and the bound date.

Stages: draft/pending/submitted → Submission Received; review/referred/needs
review/processing → In Review; quoted → Quote Sent; bound/purchased → BOUND;
declined → Closed Lost. Stages only move forward (BOUND is final), so a stage a
rep sets by hand, like Negotiating, isn't undone by a late Atlas message.

Safety: every message's signature is checked (HMAC-SHA256, 5-minute window);
repeated deliveries are ignored; sandbox messages are skipped unless
**Atlas environment** is set to `test`. The last 10 messages are kept and can be
read (signed-in) at `GET /s/atlas/samples`.

Settings (Settings → Apps → Corgi Dialer): **Atlas webhook signing secret**
(required), **Atlas API key** (optional lookups), **Atlas environment**.

Atlas doesn't publish the field names inside the version-2 `detail` block, so
the insured/agency/producer reader (`src/atlas/detail.ts`) looks for the likely
names; check the first real Opportunities and tighten it if anything is blank.

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
whisper     ──►  plays the recording announcement to the person called
recording-ready◄ SignalWire: "the recording is ready" → adds it to the record
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
| `src/atlas/` | The Atlas → Opportunities sync (signature check, mapping, storage) |
| `src/views/`, `src/navigation-menu-items/` | The Recorded Calls list and its sidebar entry |
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
- The DNC rules rely on the company's `dnc` switch and a `DNC` option in
  Lead Status. Renaming either in Twenty breaks the check.
