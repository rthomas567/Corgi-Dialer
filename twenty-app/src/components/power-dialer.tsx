import { useCallback, useEffect, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import {
  AppPath,
  navigate,
  openCommandConfirmationModal,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import {
  IconCheck,
  IconPhone,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerStop,
  IconX,
} from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme-constants';

import { ActionButton, Dialer, formatDuration, OutcomePicker, todayInBrowser } from 'src/components/dialer';
import {
  ROUTE_COMPANY_PEOPLE,
  ROUTE_SAVE_OUTCOME,
  ROUTE_SESSION_CONTROL,
  ROUTE_SESSION_START,
  ROUTE_SESSION_STATUS,
} from 'src/constants/universal-identifiers';
import type { CompanyWithPeople } from 'src/shared/company-people';
import type { CallOutcomeValue } from 'src/shared/outcomes';
import type { SessionView } from 'src/shared/session-engine';
import type { TargetStatus } from 'src/shared/session-store';

export type DialerSource = 'person' | 'company' | 'callQueueItem' | null;

type StatusResponse = { ok: true; session: SessionView | null } | { ok: false; message: string };
type CompanyPeopleResponse =
  | { ok: true; companies: CompanyWithPeople[]; notShown: number }
  | { ok: false; message: string };
type BasicResponse = { ok: true } | { ok: false; message: string; needsOutcome?: boolean };
type SaveResponse =
  | { ok: true; recordId: string; companyMarkedDnc: boolean; warning: string | null }
  | { ok: false; message: string };

const POLL_MS = 1500;
const MAX_LINES = 5;
const MAX_SESSION_SIZE = 500;

const SOURCE_LABEL: Record<Exclude<DialerSource, null>, [string, string]> = {
  person: ['person', 'people'],
  company: ['company', 'companies'],
  callQueueItem: ['queue entry', 'queue entries'],
};

const LINE_STATUS_TEXT: Partial<Record<TargetStatus, string>> = {
  dialing: 'Dialing…',
  ringing: 'Ringing…',
  answered: 'Picked up…',
  connected: 'Connected to you',
  voicemail: 'Voicemail - skipped',
  'no-answer': 'No answer',
  busy: 'Busy',
  failed: "Didn't go through",
  dropped: 'Also picked up - call back',
  canceled: 'Hung up (you connected)',
  done: 'Call finished',
};

const END_TEXT: Record<string, string> = {
  'list-finished': 'You reached the end of the list.',
  stopped: 'You stopped the session.',
  'rep-hung-up': 'You hung up your phone, so the session ended.',
  'rep-no-answer': "You didn't pick up your phone, so the session didn't start.",
  'rep-busy': 'Your phone was busy, so the session didn\'t start.',
  'rep-failed': "Your phone couldn't be reached. Check your phone number in the app settings.",
  'rep-canceled': 'The call to your phone was canceled.',
};

const recordPath = (personId: string | null, companyId: string | null) =>
  personId
    ? { objectNameSingular: 'person', objectRecordId: personId }
    : companyId
      ? { objectNameSingular: 'company', objectRecordId: companyId }
      : null;

// The power / parallel dialer, opened from "Start dialing" on a list of
// people, companies, or Call Queue entries (or "Open dialer" to come back).
export const PowerDialer = ({ source }: { source: DialerSource }) => {
  const theme = useTheme();
  const selectedIds = useSelectedRecordIds();

  const [view, setView] = useState<SessionView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'parallel' | 'power'>('parallel');
  const [lines, setLines] = useState(MAX_LINES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CallOutcomeValue | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<'companies' | 'people'>('companies');
  const [companyData, setCompanyData] = useState<CompanyWithPeople[] | null>(null);
  const [companiesNotShown, setCompaniesNotShown] = useState(0);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [pickedPeople, setPickedPeople] = useState<string[]>([]);
  const [callPersonId, setCallPersonId] = useState<string | null>(null);
  const pollingRef = useRef(false);
  const poppedForRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const result = await new RestApiClient().get<StatusResponse>(`/s${ROUTE_SESSION_STATUS}`);
      if (result.ok) {
        setView(result.session);
      } else {
        setError(result.message);
      }
    } catch {
      // A missed check is fine; the next one catches up.
    } finally {
      pollingRef.current = false;
      setLoaded(true);
    }
  }, []);

  // Check in regularly. This is also what keeps the dialing going, so
  // dialing pauses by itself if this panel is closed.
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Company dialer: load each selected company's phone and its people.
  const selectedKey = selectedIds.join(',');
  useEffect(() => {
    if (source !== 'company' || selectedIds.length === 0) {
      setCompanyData(null);
      return;
    }
    let cancelled = false;
    setPeopleError(null);
    setCompanyData(null);
    setPickedPeople([]);
    new RestApiClient()
      .post<CompanyPeopleResponse>(`/s${ROUTE_COMPANY_PEOPLE}`, { companyIds: selectedIds })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setCompanyData(result.companies);
          setCompaniesNotShown(result.notShown);
        } else {
          setPeopleError(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) setPeopleError('Could not load these companies. Try again.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, selectedKey]);

  // Talk-time clock.
  useEffect(() => {
    if (!view?.connected) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [view?.connected]);

  // Pop up a reminder the moment a conversation ends without an outcome.
  const needsOutcomeSid = view?.needsOutcome?.callSid ?? null;
  useEffect(() => {
    if (!needsOutcomeSid || poppedForRef.current === needsOutcomeSid) return;
    poppedForRef.current = needsOutcomeSid;
    setOutcome(null);
    setNotes('');
    setSaveNote(null);
    openCommandConfirmationModal({
      title: 'How did the call go?',
      subtitle: `Pick an outcome for ${view?.needsOutcome?.name}. Dialing continues once you save it.`,
      confirmButtonText: 'Pick outcome',
      confirmButtonAccent: 'blue',
    }).catch(() => undefined);
  }, [needsOutcomeSid, view?.needsOutcome?.name]);

  const control = async (action: string, callSid?: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await new RestApiClient().post<BasicResponse>(`/s${ROUTE_SESSION_CONTROL}`, {
        action,
        callSid,
      });
      if (!result.ok) setError(result.message);
      await refresh();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const start = async (object: Exclude<DialerSource, null>, recordIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const result = await new RestApiClient().post<BasicResponse & { sessionId?: string }>(
        `/s${ROUTE_SESSION_START}`,
        { object, recordIds, mode, lines },
      );
      if (!result.ok) {
        setError(result.message);
      }
      await refresh();
    } catch {
      setError('Could not start dialing. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    const onCall = Boolean(view?.connected);
    const answer = await openCommandConfirmationModal({
      title: 'Stop dialing?',
      subtitle: onCall
        ? 'This also ends the call you are on right now.'
        : 'Lines still ringing will be hung up.',
      confirmButtonText: 'Stop',
      confirmButtonAccent: 'danger',
    }).catch(() => 'confirm' as const);
    if (answer === 'confirm') await control('stop');
  };

  const saveOutcome = async () => {
    if (!view?.needsOutcome || !outcome) return;
    setSaving(true);
    setError(null);
    try {
      const result = await new RestApiClient().post<SaveResponse>(`/s${ROUTE_SAVE_OUTCOME}`, {
        callSid: view.needsOutcome.callSid,
        outcome,
        notes,
        localDate: todayInBrowser(),
      });
      if (!result.ok) {
        setError(result.message);
      } else {
        setSaveNote(result.warning ?? 'Saved.');
        setOutcome(null);
        setNotes('');
        await refresh();
      }
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openRecord = (personId: string | null, companyId: string | null) => {
    const params = recordPath(personId, companyId);
    if (params) void navigate(AppPath.RecordShowPage, params).catch(() => undefined);
  };

  // --- styles ---------------------------------------------------------------
  const s = {
    root: {
      display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[4],
      padding: theme.spacing[4], fontFamily: theme.font.family, color: theme.font.color.primary,
      boxSizing: 'border-box' as const, width: '100%',
    },
    title: { margin: 0, fontSize: theme.font.size.xl, fontWeight: theme.font.weight.semiBold },
    hint: { margin: 0, fontSize: theme.font.size.sm, color: theme.font.color.tertiary, lineHeight: 1.5 },
    text: { margin: 0, fontSize: theme.font.size.md, lineHeight: 1.5 },
    error: { margin: 0, fontSize: theme.font.size.md, color: theme.font.color.danger, lineHeight: 1.5 },
    card: {
      display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[2],
      padding: theme.spacing[4], borderRadius: theme.border.radius.md,
      background: theme.background.secondary, border: `1px solid ${theme.border.color.light}`,
    },
    segment: { display: 'flex', gap: theme.spacing[2] },
    segmentButton: (active: boolean) => ({
      flex: 1, height: '40px', borderRadius: theme.border.radius.sm, cursor: 'pointer',
      border: `1px solid ${active ? theme.color.orange : theme.border.color.medium}`,
      background: active ? theme.color.orange : theme.background.primary,
      color: active ? '#FFFFFF' : theme.font.color.primary,
      fontFamily: theme.font.family, fontSize: theme.font.size.md,
      fontWeight: active ? theme.font.weight.semiBold : theme.font.weight.regular,
    }),
    label: { margin: 0, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.medium, color: theme.font.color.secondary },
    banner: (color: string) => ({
      margin: 0, padding: theme.spacing[3], borderRadius: theme.border.radius.md,
      border: `2px solid ${color}`, fontSize: theme.font.size.md, fontWeight: theme.font.weight.medium, lineHeight: 1.4,
    }),
    connected: {
      display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[2],
      padding: theme.spacing[4], borderRadius: theme.border.radius.md,
      border: `2px solid ${theme.color.green}`, background: theme.background.primary,
    },
    bigName: { margin: 0, fontSize: theme.font.size.xl, fontWeight: theme.font.weight.semiBold },
    timer: { margin: 0, fontSize: '32px', fontWeight: theme.font.weight.semiBold, fontVariantNumeric: 'tabular-nums' as const },
    lineRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[2],
      padding: `${theme.spacing[2]} 0`, borderBottom: `1px solid ${theme.border.color.light}`,
    },
    lineName: { margin: 0, fontSize: theme.font.size.md, fontWeight: theme.font.weight.medium },
    lineSub: { margin: 0, fontSize: theme.font.size.sm, color: theme.font.color.tertiary },
    lineStatus: { margin: 0, fontSize: theme.font.size.sm, color: theme.font.color.secondary, textAlign: 'right' as const, flexShrink: 0 },
    callBack: {
      display: 'flex', alignItems: 'center', gap: theme.spacing[2], padding: theme.spacing[3],
      borderRadius: theme.border.radius.md, border: `2px solid ${theme.color.yellow}`, background: theme.background.primary,
    },
    linkButton: {
      border: `1px solid ${theme.border.color.medium}`, background: theme.background.primary,
      borderRadius: theme.border.radius.sm, padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
      cursor: 'pointer', fontFamily: theme.font.family, fontSize: theme.font.size.sm, color: theme.font.color.primary,
    },
    counts: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: theme.spacing[2] },
    count: { display: 'flex', flexDirection: 'column' as const, padding: theme.spacing[2], borderRadius: theme.border.radius.sm, background: theme.background.secondary },
    countNumber: { margin: 0, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.semiBold },
    countLabel: { margin: 0, fontSize: theme.font.size.xs, color: theme.font.color.tertiary },
    progressTrack: { height: '6px', borderRadius: '3px', background: theme.background.tertiary, overflow: 'hidden' as const },
    outcomeCard: {
      display: 'flex', flexDirection: 'column' as const, gap: theme.spacing[3], padding: theme.spacing[4],
      borderRadius: theme.border.radius.md, border: `2px solid ${theme.color.orange}`, background: theme.background.primary,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    },
    notes: {
      width: '100%', minHeight: '64px', boxSizing: 'border-box' as const, padding: theme.spacing[2],
      borderRadius: theme.border.radius.sm, border: `1px solid ${theme.border.color.medium}`,
      background: theme.background.primary, color: theme.font.color.primary,
      fontFamily: theme.font.family, fontSize: theme.font.size.md, resize: 'vertical' as const,
    },
    row: { display: 'flex', gap: theme.spacing[2] },
  };

  if (!loaded) {
    return <div style={s.root}><p style={s.hint}>Loading the dialer…</p></div>;
  }

  // --- No session yet: the start screen ------------------------------------
  if (!view) {
    if (!source) {
      return (
        <div style={s.root}>
          <p style={s.title}>Power dialer</p>
          <p style={s.text}>
            No dialing session is running. To start one, tick the people, companies, or Call Queue
            entries you want to call, then click <strong>Start dialing</strong>.
          </p>
        </div>
      );
    }
    const [one, many] = SOURCE_LABEL[source];
    const count = selectedIds.length;

    const dialSettings = (
      <div style={s.card}>
        <p style={s.label}>How to dial</p>
        <div style={s.segment}>
          <button type="button" style={s.segmentButton(mode === 'parallel')} onClick={() => setMode('parallel')}>
            Parallel
          </button>
          <button type="button" style={s.segmentButton(mode === 'power')} onClick={() => setMode('power')}>
            Power (one at a time)
          </button>
        </div>
        {mode === 'parallel' ? (
          <>
            <p style={s.label}>Lines at once</p>
            <div style={s.segment}>
              {[2, 3, 4, 5].map((n) => (
                <button key={n} type="button" style={s.segmentButton(lines === n)} onClick={() => setLines(n)}>
                  {n}
                </button>
              ))}
            </div>
            <p style={s.hint}>
              Calls {lines} at a time. The first person to pick up is connected to you. If someone
              else also picks up, they're hung up on and you'll see a "call back" notice.
              Voicemails are skipped and logged.
            </p>
          </>
        ) : (
          <p style={s.hint}>Calls one at a time. Voicemails are skipped and logged.</p>
        )}
      </div>
    );

    const startBlock = (object: Exclude<DialerSource, null>, ids: string[], noun: [string, string]) => {
      const tooMany = ids.length > MAX_SESSION_SIZE;
      return (
        <>
          {dialSettings}
          <p style={s.hint}>
            Your phone rings first - pick up and press 1 to begin. Anyone marked Do Not Call is
            skipped and never dialed. Calls are recorded.
          </p>
          {tooMany && <p style={s.error}>Select {MAX_SESSION_SIZE} or fewer at a time.</p>}
          {error && <p style={s.error}>{error}</p>}
          <ActionButton
            label={
              ids.length > 0
                ? `Start dialing ${ids.length} ${ids.length === 1 ? noun[0] : noun[1]}`
                : 'Start dialing'
            }
            tone="call"
            size="large"
            icon={<IconPhone size={22} />}
            isBusy={busy}
            isDisabled={ids.length === 0 || tooMany}
            onClick={() => void start(object, ids)}
          />
        </>
      );
    };

    // People and Call Queue: one list, one Start button.
    if (source !== 'company') {
      return (
        <div style={s.root}>
          <p style={s.title}>Start dialing</p>
          <p style={s.text}>
            {count === 0 ? `Tick the ${many} you want to call first.` : `${count} ${count === 1 ? one : many} selected.`}
          </p>
          {startBlock(source, selectedIds, [one, many])}
        </div>
      );
    }

    // Companies: a Companies tab (main lines) and a People tab (everyone there).
    if (callPersonId) {
      return (
        <div style={s.root}>
          <button type="button" style={{ ...s.linkButton, alignSelf: 'flex-start' }} onClick={() => setCallPersonId(null)}>
            ← Back to people
          </button>
          <Dialer personId={callPersonId} />
        </div>
      );
    }

    const allPeople = (companyData ?? []).flatMap((company) => company.people);
    const callable = allPeople.filter((person) => !person.doNotCall && person.phone);
    const picked = pickedPeople.filter((id) => callable.some((person) => person.id === id));
    const togglePerson = (id: string) =>
      setPickedPeople((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    const allPicked = callable.length > 0 && picked.length === callable.length;

    const badge = (label: string, color: string) => (
      <span
        style={{
          fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semiBold, color: '#FFFFFF',
          background: color, borderRadius: theme.border.radius.sm, padding: `1px ${theme.spacing[1]}`,
        }}
      >
        {label}
      </span>
    );

    return (
      <div style={s.root}>
        <p style={s.title}>Start dialing</p>
        <div style={s.segment} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'companies'} style={s.segmentButton(tab === 'companies')} onClick={() => setTab('companies')}>
            Companies ({count})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'people'} style={s.segmentButton(tab === 'people')} onClick={() => setTab('people')}>
            People{companyData ? ` (${allPeople.length})` : ''}
          </button>
        </div>

        {count === 0 && <p style={s.text}>Tick the companies you want to call first.</p>}
        {peopleError && <p style={s.error}>{peopleError}</p>}
        {count > 0 && !companyData && !peopleError && <p style={s.hint}>Loading…</p>}
        {companiesNotShown > 0 && (
          <p style={s.hint}>Showing the first {count - companiesNotShown} companies. Select fewer to see the rest.</p>
        )}

        {tab === 'companies' && companyData && (
          <>
            <div style={s.card}>
              {companyData.map((company) => (
                <div key={company.id} style={s.lineRow}>
                  <div>
                    <p style={s.lineName}>{company.name}</p>
                    <p style={s.lineSub}>{company.phone ?? 'No phone number'}</p>
                  </div>
                  {company.doNotCall && badge('DO NOT CALL', theme.color.red)}
                </div>
              ))}
            </div>
            {startBlock('company', selectedIds, [one, many])}
          </>
        )}

        {tab === 'people' && companyData && (
          <>
            {callable.length > 0 && (
              <label style={{ ...s.row, alignItems: 'center', fontSize: theme.font.size.md, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => setPickedPeople(allPicked ? [] : callable.map((person) => person.id))}
                />
                Select everyone who can be called ({callable.length})
              </label>
            )}
            {companyData.map((company) => (
              <div key={company.id} style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[2] }}>
                  <p style={{ ...s.lineName, fontWeight: theme.font.weight.semiBold }}>{company.name}</p>
                  {company.doNotCall && badge('DO NOT CALL', theme.color.red)}
                </div>
                {company.people.length === 0 ? (
                  <p style={s.hint}>There are no people associated with this company.</p>
                ) : (
                  company.people.map((person) => {
                    const canCall = !person.doNotCall && Boolean(person.phone);
                    return (
                      <div key={person.id} style={{ ...s.lineRow, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${person.name}`}
                          disabled={!canCall}
                          checked={picked.includes(person.id)}
                          onChange={() => togglePerson(person.id)}
                          style={{ marginTop: '4px' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={s.lineName}>{person.name}</p>
                          {person.jobTitle && <p style={s.lineSub}>{person.jobTitle}</p>}
                          <p style={s.lineSub}>{person.phone ?? 'No phone number'}</p>
                          {person.email && <p style={{ ...s.lineSub, overflowWrap: 'anywhere' }}>{person.email}</p>}
                          {person.city && <p style={s.lineSub}>{person.city}</p>}
                          <button
                            type="button"
                            style={{ ...s.linkButton, marginTop: theme.spacing[1] }}
                            onClick={() => openRecord(person.id, null)}
                          >
                            Open
                          </button>
                        </div>
                        {person.doNotCall ? (
                          badge('DNC', theme.color.red)
                        ) : (
                          <button
                            type="button"
                            disabled={!canCall}
                            onClick={() => setCallPersonId(person.id)}
                            style={{
                              border: 'none', borderRadius: theme.border.radius.sm, cursor: canCall ? 'pointer' : 'default',
                              background: canCall ? theme.color.orange : theme.background.tertiary,
                              color: canCall ? '#FFFFFF' : theme.font.color.tertiary,
                              fontFamily: theme.font.family, fontSize: theme.font.size.md,
                              fontWeight: theme.font.weight.semiBold, padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
                              display: 'flex', alignItems: 'center', gap: theme.spacing[1], flexShrink: 0,
                            }}
                          >
                            <IconPhone size={14} /> Call
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ))}
            {allPeople.length > 0 && startBlock('person', picked, ['person', 'people'])}
          </>
        )}
      </div>
    );
  }

  // --- A session is running (or just finished) ------------------------------
  const isEnded = view.state === 'ended';
  const progress = view.total > 0 ? Math.round((view.position / view.total) * 100) : 0;
  const talkSeconds = view.connected?.connectedAt
    ? Math.max(0, Math.floor((now - Date.parse(view.connected.connectedAt)) / 1000))
    : 0;
  const ringing = view.activeLines.filter((line) => line.status !== 'connected');

  return (
    <div style={s.root}>
      <div>
        <p style={s.title}>
          {view.mode === 'parallel' ? `Parallel dialing - ${view.lines} lines` : 'Power dialing'}
        </p>
        <p style={s.hint}>
          {view.position} of {view.total} dialed or checked
        </p>
      </div>
      <div style={s.progressTrack}>
        <div style={{ width: `${progress}%`, height: '100%', background: theme.color.orange }} />
      </div>

      {!isEnded && view.repStatus === 'ringing' && (
        <p style={s.banner(theme.color.orange)}>Your phone is ringing. Pick up and press 1 to start dialing.</p>
      )}
      {!isEnded && view.paused && (
        <p style={s.banner(theme.color.blue)}>Paused. No new calls will be placed until you resume.</p>
      )}
      {isEnded && (
        <p style={s.banner(theme.color.gray)}>
          Session over. {END_TEXT[view.endReason ?? ''] ?? ''}
        </p>
      )}

      {view.connected && (
        <div style={s.connected} aria-live="polite">
          <p style={s.label}>Connected</p>
          <p style={s.bigName}>{view.connected.name}</p>
          {view.connected.companyName && view.connected.companyName !== view.connected.name && (
            <p style={s.lineSub}>{view.connected.companyName}</p>
          )}
          <p style={s.lineSub}>{view.connected.number}</p>
          <p style={s.timer}>{formatDuration(talkSeconds)}</p>
          <div style={s.row}>
            <button
              type="button"
              style={s.linkButton}
              onClick={() => openRecord(view.connected!.personId, view.connected!.companyId)}
            >
              Open record
            </button>
          </div>
          <ActionButton
            label="Hang up"
            tone="hang-up"
            icon={<IconX size={18} />}
            isBusy={busy}
            onClick={() => void control('hang-up')}
          />
        </div>
      )}

      {view.needsOutcome && (
        <div style={s.outcomeCard}>
          <p style={s.bigName}>How did the call with {view.needsOutcome.name} go?</p>
          <p style={s.hint}>Dialing continues once you save an outcome.</p>
          <OutcomePicker selected={outcome} isLocked={saving} onSelect={setOutcome} />
          <textarea
            style={s.notes}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <ActionButton
            label="Save outcome"
            tone={outcome === 'DNC' ? 'dnc' : 'save'}
            icon={<IconCheck size={18} />}
            isBusy={saving}
            isDisabled={!outcome}
            onClick={() => void saveOutcome()}
          />
        </div>
      )}
      {!view.needsOutcome && saveNote && <p style={s.hint}>{saveNote}</p>}

      {view.dropped.map((person) => (
        <div key={person.callSid} style={s.callBack} role="status">
          <div style={{ flex: 1 }}>
            <p style={s.lineName}>
              {person.name}
              {person.companyName && person.companyName !== person.name ? ` (${person.companyName})` : ''} also
              picked up
            </p>
            <p style={s.lineSub}>Call them back: {person.number}</p>
          </div>
          <button type="button" style={s.linkButton} onClick={() => openRecord(person.personId, person.companyId)}>
            Open
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            style={s.linkButton}
            onClick={() => void control('dismiss', person.callSid)}
          >
            <IconX size={14} />
          </button>
        </div>
      ))}

      {!isEnded && ringing.length > 0 && (
        <div style={s.card}>
          <p style={s.label}>Lines</p>
          {ringing.map((line) => (
            <div key={line.callSid} style={s.lineRow}>
              <div>
                <p style={s.lineName}>{line.name}</p>
                <p style={s.lineSub}>
                  {[line.companyName !== line.name ? line.companyName : null, line.number]
                    .filter(Boolean)
                    .join(' - ')}
                </p>
              </div>
              <p style={s.lineStatus}>{LINE_STATUS_TEXT[line.status] ?? line.status}</p>
            </div>
          ))}
        </div>
      )}

      <div style={s.counts}>
        {[
          [view.counts.connected, 'Connected'],
          [view.counts.voicemail, 'Voicemail'],
          [view.counts.noAnswer, 'No answer'],
          [view.counts.dropped, 'Call back'],
          [view.counts.skippedDnc, 'Skipped (DNC)'],
          [view.counts.noNumber, 'No number'],
        ].map(([value, label]) => (
          <div key={label} style={s.count}>
            <p style={s.countNumber}>{value}</p>
            <p style={s.countLabel}>{label}</p>
          </div>
        ))}
      </div>

      {error && <p style={s.error}>{error}</p>}

      {!isEnded ? (
        <div style={s.row}>
          <ActionButton
            label={view.paused ? 'Resume' : 'Pause'}
            tone="save"
            icon={view.paused ? <IconPlayerPlay size={18} /> : <IconPlayerPause size={18} />}
            isBusy={busy}
            onClick={() => void control(view.paused ? 'resume' : 'pause')}
          />
          <ActionButton
            label="Stop"
            tone="hang-up"
            icon={<IconPlayerStop size={18} />}
            isBusy={busy}
            onClick={() => void stop()}
          />
        </div>
      ) : (
        <ActionButton
          label="Close"
          tone="save"
          icon={<IconCheck size={18} />}
          isBusy={busy}
          isDisabled={Boolean(view.needsOutcome)}
          onClick={() => void control('close')}
        />
      )}
    </div>
  );
};
