# Corgi Outbound Dialer

A browser-based outbound dialer for the Corgi Twenty CRM, built on SignalWire.
Type a number, call it from the browser, pick an outcome when you're done —
it gets logged straight into Twenty's `Calls` object.

Out of scope for this version (as discussed): inbound calls, call recording.

## What's already set up in Twenty

I made these changes directly in your workspace via the Twenty connection:

- **`Calls.outcome`** (multi-select) now has exactly: Connected, Voicemail,
  DNC, Busy, No Answer, Receptionist, High Interest, Low Interest, Hard No,
  Wrong Number. (It previously had a different set — "Not Interested" and
  "Meeting Booked" instead of Busy/High Interest/Low Interest/Hard No. No
  existing call records used any outcome value, so nothing was lost.)
- **`Calls.phoneNumber`** (text) — new field, stores the number that was
  actually dialed.
- **`Calls.durationSeconds`** (number) — new field, call length.
- **`WorkspaceMember.outboundNumber`** (text) — new field. This is where you
  record each rep's assigned outbound caller ID number. The dialer reads
  this to know who can dial out and what number they call from.

The `Calls` object already had `bdr` (which rep made the call) and `contact`
(which person they called) relations — the app uses those too.

## Architecture

```
Browser (frontend/index.html)
   │  1. rep picks their name, types a number, clicks Call
   │  2. asks backend for a short-lived SignalWire token
   ▼
Backend (backend/)
   │  mints the token, looks up/logs calls in Twenty
   ▼
SignalWire (Call Fabric)              Twenty CRM
   places the actual call        logs the outcome via REST API
```

There's no telephony webhook to host — Call Fabric places the call directly
from the token, so the backend's only jobs are minting tokens and talking to
Twenty.

## One-time setup

### 1. SignalWire

1. Create a SignalWire Space if you don't have one, and buy one phone
   number per rep who'll be dialing.
2. In the dashboard, go to **Subscribers** and create one Subscriber per
   rep. Use their Twenty login email as the Subscriber's `reference` — the
   backend uses that same email to request their token.
3. Assign each Subscriber the phone number that should show up as their
   caller ID. **This is what actually controls caller ID for Call
   Fabric outbound calls** — there's no per-call override, so this step is
   what makes "each rep's number rings only them" work.
4. Grab your **Project ID** and **API Token** from Dashboard → API.

### 2. Twenty

1. Settings → API & Webhooks → create an API key with read/write access to
   People, Calls, and Workspace Members. Copy it.
2. For each rep, open their Workspace Member record and fill in
   **Outbound Caller ID** with the same number you assigned them in
   SignalWire.

### 3. Backend

```bash
cd backend
cp .env.example .env
# fill in .env with the values from steps 1-2
npm install
npm start
```

It runs on `http://localhost:4000` by default (or whatever `PORT` you set).
Deploy it wherever you'd deploy any small Node service — it just needs to be
reachable over HTTPS from wherever reps open the frontend.

### 4. Frontend

`frontend/index.html` is a single static file — no build step. Before you
host it, set the backend URL it should talk to. Easiest way: add this line
right before the `<script type="module">` tag:

```html
<script>window.DIALER_BACKEND_URL = "https://your-backend.example.com";</script>
```

Then serve `index.html` from any static host (or just open it locally
against `http://localhost:4000` while testing). It has to be loaded over
**HTTPS** (or `localhost`) — browsers block microphone access otherwise.

The first time someone opens it, they'll be asked for the
`DIALER_SHARED_SECRET` you set in the backend's `.env`, then they pick their
name from the rep list.

## How a call flows

1. Rep types a number and hits **Call**.
2. Frontend asks the backend for a token, backend asks SignalWire for one
   tied to that rep's Subscriber.
3. Frontend uses the token to place the call straight from the browser via
   `@signalwire/js`.
4. When the call ends, the rep picks one of the ten outcomes and can add a
   note.
5. Frontend asks the backend to save it — the backend looks up whether the
   dialed number matches an existing Twenty person (and their company), then
   creates a `Call` record linking the rep, the outcome, notes, duration,
   and the matched contact if there was one.

## Things worth knowing before you rely on this

- **No real login.** The "shared secret" is one password for the whole
  team, not per-rep authentication. Picking a name from the dropdown is
  on the honor system. Fine for a small trusted team; not something to
  expose publicly as-is.
- **The frontend is standalone**, not embedded inside Twenty's own pages —
  reps use it in a separate tab alongside Twenty. Building it *into*
  Twenty's UI (e.g. a button on a person's record) is a bigger project on
  top of Twenty's own frontend, not something this covers.
- **The `esm.sh` import in `index.html`** is a quick-start convenience so
  there's no build step. For anything beyond a quick pilot, pull
  `@signalwire/js` in via npm and bundle it (Vite, esbuild, etc.) instead —
  it'll be faster and more reliable than fetching from a CDN on every load.
- **I haven't been able to test a live call** — I don't have your
  SignalWire credentials or network access to your Twenty instance from
  where this code was written. Everything above was built and wired up
  against SignalWire's and Twenty's documented, current APIs, and the
  Twenty-side schema changes were made for real in your workspace, but you
  should do a real test call before putting this in front of the team.
