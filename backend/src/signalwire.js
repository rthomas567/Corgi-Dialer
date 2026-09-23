const SIGNALWIRE_SPACE = process.env.SIGNALWIRE_SPACE;
const SIGNALWIRE_PROJECT_ID = process.env.SIGNALWIRE_PROJECT_ID;
const SIGNALWIRE_API_TOKEN = process.env.SIGNALWIRE_API_TOKEN;

// Mints a short-lived Subscriber Access Token (SAT) for one rep.
// `reference` should be a stable identifier for the rep (we use their
// Twenty email) - SignalWire uses it to find/create the matching Subscriber.
//
// IMPORTANT: caller ID for outbound PSTN calls from Call Fabric is
// controlled by the Subscriber's own assigned phone number in the
// SignalWire dashboard (Subscribers section), not by a per-call param.
// So each rep needs a one-time setup step: create/confirm their Subscriber
// in SignalWire and assign them the same number stored in their Twenty
// workspace member record (outboundNumber). See README.
export async function mintSubscriberToken(reference) {
  const auth = Buffer.from(
    `${SIGNALWIRE_PROJECT_ID}:${SIGNALWIRE_API_TOKEN}`
  ).toString("base64");

  const res = await fetch(
    `https://${SIGNALWIRE_SPACE}/api/fabric/subscribers/tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reference }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SignalWire token error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.token;
}
