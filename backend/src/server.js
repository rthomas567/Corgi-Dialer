import "dotenv/config";
import express from "express";
import cors from "cors";
import { listReps, findPersonByPhone, createCall } from "./twenty.js";
import { mintSubscriberToken } from "./signalwire.js";

const PORT = process.env.PORT || 4000;
const DIALER_SHARED_SECRET = process.env.DIALER_SHARED_SECRET;

const app = express();
app.use(cors());
app.use(express.json());

// Simple shared-password gate. This is NOT per-rep authentication - it just
// stops randoms from hitting your backend if the URL leaks. For real
// deployments, put this behind your own login / SSO.
function requireSecret(req, res, next) {
  if (!DIALER_SHARED_SECRET) return next();
  if (req.header("x-dialer-secret") !== DIALER_SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

// List reps who have a number assigned (i.e. who can dial out).
app.get("/api/reps", requireSecret, async (req, res) => {
  try {
    res.json({ reps: await listReps() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mint a SignalWire browser token for the rep who's about to dial.
app.post("/api/token", requireSecret, async (req, res) => {
  const { repEmail } = req.body || {};
  if (!repEmail) return res.status(400).json({ error: "repEmail is required" });
  try {
    const token = await mintSubscriberToken(repEmail);
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Look up a Twenty contact by the number being dialed, so we can link the
// call to the right person (and their company) once it's logged.
app.get("/api/people/lookup", requireSecret, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: "phone is required" });
  try {
    const person = await findPersonByPhone(phone);
    res.json({ person });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Log a finished call + chosen outcome back into Twenty's Calls object.
app.post("/api/calls", requireSecret, async (req, res) => {
  const {
    repId,
    phone,
    outcome,
    notes,
    durationSeconds,
    personId,
    companyId,
    name,
  } = req.body || {};

  if (!repId || !phone || !outcome) {
    return res
      .status(400)
      .json({ error: "repId, phone and outcome are required" });
  }

  try {
    const call = await createCall({
      repId,
      phone,
      outcome,
      notes,
      durationSeconds,
      personId,
      companyId,
      name,
    });
    res.json({ call });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Corgi dialer backend listening on http://localhost:${PORT}`);
});
