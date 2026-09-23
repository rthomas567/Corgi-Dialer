const TWENTY_API_URL = process.env.TWENTY_API_URL;
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;

const headers = {
  Authorization: `Bearer ${TWENTY_API_KEY}`,
  "Content-Type": "application/json",
};

async function twentyFetch(path, options = {}) {
  const res = await fetch(`${TWENTY_API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const message = json?.error?.message || json?.message || res.statusText;
    throw new Error(`Twenty API ${res.status}: ${message}`);
  }
  return json;
}

// Reps = workspace members that have an outboundNumber assigned.
// That field is the single source of truth for "which number rings when
// this person dials out" - set it on the workspace member record in Twenty.
export async function listReps() {
  const data = await twentyFetch("/workspaceMembers?limit=200");
  const members = data?.data?.workspaceMembers ?? [];
  return members
    .filter((m) => m.outboundNumber)
    .map((m) => ({
      id: m.id,
      name: [m.name?.firstName, m.name?.lastName].filter(Boolean).join(" "),
      email: m.userEmail,
      outboundNumber: m.outboundNumber,
    }));
}

// Find a person record by phone number, so a finished call can be linked
// to the right contact (and company) automatically.
export async function findPersonByPhone(phone) {
  const filter = encodeURIComponent(`phones.primaryPhoneNumber[eq]:"${phone}"`);
  const data = await twentyFetch(
    `/people?filter=${filter}&limit=1&depth=1`
  );
  return data?.data?.people?.[0] ?? null;
}

export async function createCall({
  repId,
  phone,
  outcome,
  notes,
  durationSeconds,
  personId,
  companyId,
  name,
}) {
  const body = {
    name: name || phone,
    phoneNumber: phone,
    outcome: outcome ? [outcome] : [],
    notes: notes || "",
    durationSeconds: durationSeconds ?? null,
    bdrId: repId,
    ...(personId ? { contactId: personId } : {}),
    ...(companyId ? { companyId } : {}),
  };
  const data = await twentyFetch("/calls", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data?.data?.createCall ?? data;
}
