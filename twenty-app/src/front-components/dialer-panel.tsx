import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';
import { IconCheck, IconPhone, IconX } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme-constants';

import {
  DIALER_PANEL_FRONT_COMPONENT_ID,
  ROUTE_CALL_CHECK,
  ROUTE_CALL_STATUS,
  ROUTE_HANG_UP,
  ROUTE_SAVE_OUTCOME,
  ROUTE_START_CALL,
} from 'src/constants/universal-identifiers';
import { CALL_OUTCOMES, type CallOutcomeValue } from 'src/shared/outcomes';

type Stage =
  | 'idle'
  | 'starting'
  | 'rep-ringing'
  | 'prospect-ringing'
  | 'connected'
  | 'ended'
  | 'failed';

type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string } | null;
  jobTitle?: string | null;
  phones?: {
    primaryPhoneNumber?: string | null;
    primaryPhoneCallingCode?: string | null;
  } | null;
  company?: { name?: string | null } | null;
};

type SaveResponse =
  | { ok: true; recordId: string; companyMarkedDnc: boolean; warning: string | null }
  | { ok: false; message: string };
type CheckResponse =
  | { ok: true; doNotCall: boolean; reason: string | null; companyName: string | null }
  | { ok: false; message: string };
type DncState =
  | { status: 'checking' }
  | { status: 'ok'; companyName: string | null }
  | { status: 'blocked'; reason: string };

const DNC_VALUE = 'DNC';

const todayInBrowser = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};
type SaveState = 'idle' | 'saving' | 'saved';

type StartResponse = { ok: true; callSid: string } | { ok: false; message: string };
type StatusResponse =
  | {
      ok: true;
      stage: Exclude<Stage, 'idle'>;
      endReason: string | null;
      durationSeconds: number | null;
    }
  | { ok: false; message: string };

const ACTIVE_STAGES: Stage[] = ['starting', 'rep-ringing', 'prospect-ringing', 'connected'];
const POLL_MS = 2000;

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const endedMessage = (reason: string | null, firstName: string) => {
  switch (reason) {
    case 'rep-no-answer':
    case 'rep-busy':
    case 'rep-canceled':
      return "You didn't pick up, so the call was canceled.";
    case 'rep-failed':
      return "Your phone couldn't be reached. Check the phone number in the app settings.";
    case 'prospect-busy':
      return `${firstName}'s line was busy.`;
    case 'prospect-no-answer':
      return `${firstName} didn't answer.`;
    case 'prospect-failed':
      return `The call to ${firstName} didn't go through. The number may be wrong.`;
    case 'hung-up':
      return 'You ended the call.';
    default:
      return 'Call ended.';
  }
};

const unwrapPerson = (response: unknown): Person | null => {
  const data = (response as { data?: Record<string, unknown> } | null)?.data;
  const person = data?.person ?? Object.values(data ?? {})[0];
  return (person as Person) ?? null;
};

type OutcomePickerProps = {
  selected: CallOutcomeValue | null;
  isLocked: boolean;
  onSelect: (value: CallOutcomeValue) => void;
};

// The ten outcomes as a two-column grid of toggle buttons.
const OutcomePicker = ({ selected, isLocked, onSelect }: OutcomePickerProps) => {
  const theme = useTheme();
  return (
    <div
      role="group"
      aria-label="Call outcome"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: theme.spacing[2],
      }}
    >
      {CALL_OUTCOMES.map((outcome) => {
        const isSelected = outcome.value === selected;
        // DNC is always shown in red so nobody picks it by accident.
        const isDnc = outcome.value === DNC_VALUE;
        const accentColor = isDnc ? theme.color.red : theme.color.blue;
        return (
          <button
            key={outcome.value}
            type="button"
            aria-pressed={isSelected}
            disabled={isLocked}
            onClick={() => onSelect(outcome.value)}
            style={{
              height: '36px',
              padding: `0 ${theme.spacing[2]}`,
              borderRadius: theme.border.radius.sm,
              border: `1px solid ${isSelected || isDnc ? accentColor : theme.border.color.medium}`,
              background: isSelected
                ? isDnc
                  ? theme.background.danger
                  : theme.accent.quaternary
                : theme.background.primary,
              color: isSelected || isDnc ? accentColor : theme.font.color.primary,
              opacity: isLocked && !isSelected ? 0.5 : 1,
              fontFamily: theme.font.family,
              fontSize: theme.font.size.md,
              fontWeight: isSelected ? theme.font.weight.semiBold : theme.font.weight.regular,
              textAlign: 'left',
              cursor: isLocked ? 'default' : 'pointer',
            }}
          >
            {outcome.label}
          </button>
        );
      })}
    </div>
  );
};

type ActionButtonProps = {
  label: string;
  tone: 'call' | 'hang-up' | 'save' | 'dnc';
  icon: ReactNode;
  isBusy: boolean;
  isDisabled?: boolean;
  onClick: () => void;
};

// A plain button styled with Twenty's own colors.
const ActionButton = ({ label, tone, icon, isBusy, isDisabled, onClick }: ActionButtonProps) => {
  const theme = useTheme();
  const disabled = isBusy || Boolean(isDisabled);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={isBusy}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
        width: '100%',
        height: '40px',
        border: 'none',
        borderRadius: theme.border.radius.md,
        background: tone === 'hang-up' || tone === 'dnc' ? theme.color.red : theme.color.blue,
        color: '#FFFFFF',
        fontFamily: theme.font.family,
        fontSize: theme.font.size.md,
        fontWeight: theme.font.weight.medium,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {icon}
      {isBusy ? 'One moment…' : label}
    </button>
  );
};

const DialerPanel = () => {
  const theme = useTheme();
  const selectedRecordIds = useSelectedRecordIds();
  const personId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;

  const [person, setPerson] = useState<Person | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [talkSeconds, setTalkSeconds] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CallOutcomeValue | null>(null);
  const [notes, setNotes] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [dnc, setDnc] = useState<DncState>({ status: 'checking' });
  const connectedAtRef = useRef<number | null>(null);

  const firstName = person?.name?.firstName?.trim() || 'this person';
  const fullName =
    [person?.name?.firstName, person?.name?.lastName].filter(Boolean).join(' ') ||
    'Unnamed person';
  const phoneDisplay = person?.phones?.primaryPhoneNumber
    ? `${person.phones.primaryPhoneCallingCode ?? ''} ${person.phones.primaryPhoneNumber}`.trim()
    : null;

  // Check Do Not Call before showing the Call button.
  useEffect(() => {
    if (!personId) {
      return;
    }
    let cancelled = false;
    setDnc({ status: 'checking' });
    new RestApiClient()
      .get<CheckResponse>(`/s${ROUTE_CALL_CHECK}`, { query: { personId } })
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok && result.doNotCall) {
          setDnc({ status: 'blocked', reason: result.reason ?? 'This lead is marked Do Not Call.' });
        } else {
          setDnc({ status: 'ok', companyName: result.ok ? result.companyName : null });
        }
      })
      .catch(() => {
        // If the check can't run, the server still refuses DNC calls at dial time.
        if (!cancelled) {
          setDnc({ status: 'ok', companyName: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  // Load the person being called.
  useEffect(() => {
    if (!personId) {
      return;
    }
    let cancelled = false;
    new RestApiClient()
      .get(`/rest/people/${personId}`, { query: { depth: 1 } })
      .then((response) => {
        if (!cancelled) {
          setPerson(unwrapPerson(response));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load this person.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  // While a call is active, check its progress every couple of seconds.
  useEffect(() => {
    if (!callSid || !ACTIVE_STAGES.includes(stage)) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const status = await new RestApiClient().get<StatusResponse>(
          `/s${ROUTE_CALL_STATUS}`,
          { query: { callSid } },
        );
        if (!status.ok) {
          return;
        }
        if (status.stage === 'connected' && connectedAtRef.current === null) {
          connectedAtRef.current = Date.now();
        }
        if (status.stage === 'ended') {
          setEndReason(status.endReason);
          setMessage(endedMessage(status.endReason, firstName));
          if (status.durationSeconds) {
            setTalkSeconds(status.durationSeconds);
          }
        }
        setStage(status.stage);
      } catch {
        // A missed check is fine; the next one will catch up.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [callSid, stage, firstName]);

  // Talk-time counter.
  useEffect(() => {
    if (stage !== 'connected') {
      return;
    }
    const timer = setInterval(() => {
      if (connectedAtRef.current !== null) {
        setTalkSeconds(Math.floor((Date.now() - connectedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [stage]);

  const startCall = useCallback(async () => {
    if (!personId) {
      return;
    }
    setIsBusy(true);
    setMessage(null);
    setTalkSeconds(0);
    setEndReason(null);
    setOutcome(null);
    setNotes('');
    setSaveState('idle');
    setSaveError(null);
    setSaveWarning(null);
    connectedAtRef.current = null;
    try {
      const result = await new RestApiClient().post<StartResponse>(
        `/s${ROUTE_START_CALL}`,
        { personId },
      );
      if (result.ok) {
        setCallSid(result.callSid);
        setStage('starting');
      } else {
        setStage('failed');
        setMessage(result.message);
      }
    } catch {
      setStage('failed');
      setMessage('The dialer could not be reached. Try again in a moment.');
    } finally {
      setIsBusy(false);
    }
  }, [personId]);

  const hangUp = useCallback(async () => {
    if (!callSid) {
      return;
    }
    setIsBusy(true);
    try {
      await new RestApiClient().post(`/s${ROUTE_HANG_UP}`, { callSid });
      setStage('ended');
      setEndReason('hung-up');
      setMessage(endedMessage('hung-up', firstName));
    } catch {
      setMessage('Could not hang up from here. Hang up on your phone instead.');
    } finally {
      setIsBusy(false);
    }
  }, [callSid, firstName]);

  const saveOutcome = useCallback(async () => {
    if (!callSid || !outcome) {
      return;
    }
    setSaveState('saving');
    setSaveError(null);
    try {
      const result = await new RestApiClient().post<SaveResponse>(
        `/s${ROUTE_SAVE_OUTCOME}`,
        { callSid, outcome, notes, localDate: todayInBrowser() },
      );
      if (result.ok) {
        setSaveState('saved');
        setSaveWarning(result.warning);
        if (outcome === DNC_VALUE) {
          setDnc({
            status: 'blocked',
            reason: result.companyMarkedDnc
              ? 'You marked this company Do Not Call. Nobody there can be called from the dialer again.'
              : 'You marked this person Do Not Call. They can no longer be called from the dialer.',
          });
        }
      } else {
        setSaveState('idle');
        setSaveError(result.message);
      }
    } catch {
      setSaveState('idle');
      setSaveError('Could not reach the dialer to save. Try again.');
    }
  }, [callSid, outcome, notes]);

  const styles = {
    root: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing[6],
      padding: theme.spacing[4],
      fontFamily: theme.font.family,
      color: theme.font.color.primary,
    },
    name: {
      margin: 0,
      fontSize: theme.font.size.xl,
      fontWeight: theme.font.weight.semiBold,
    },
    secondary: {
      margin: 0,
      marginTop: theme.spacing[1],
      fontSize: theme.font.size.md,
      color: theme.font.color.secondary,
    },
    number: {
      margin: 0,
      marginTop: theme.spacing[2],
      fontSize: theme.font.size.lg,
      fontVariantNumeric: 'tabular-nums' as const,
    },
    statusBox: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing[1],
      padding: theme.spacing[4],
      borderRadius: theme.border.radius.md,
      background: theme.background.secondary,
      border: `1px solid ${theme.border.color.light}`,
    },
    statusLine: {
      margin: 0,
      fontSize: theme.font.size.lg,
      fontWeight: theme.font.weight.medium,
    },
    timer: {
      margin: 0,
      fontSize: '40px',
      lineHeight: 1.1,
      fontWeight: theme.font.weight.semiBold,
      fontVariantNumeric: 'tabular-nums' as const,
    },
    hint: {
      margin: 0,
      fontSize: theme.font.size.sm,
      color: theme.font.color.tertiary,
      lineHeight: 1.5,
    },
    dncBanner: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: theme.spacing[1],
      padding: theme.spacing[4],
      borderRadius: theme.border.radius.md,
      background: theme.background.danger,
      border: `2px solid ${theme.color.red}`,
      borderLeftWidth: '6px',
    },
    dncTitle: {
      margin: 0,
      fontSize: theme.font.size.lg,
      fontWeight: theme.font.weight.semiBold,
      color: theme.color.red,
    },
    dncText: {
      margin: 0,
      fontSize: theme.font.size.md,
      lineHeight: 1.5,
      color: theme.font.color.primary,
    },
    fieldLabel: {
      display: 'block',
      margin: 0,
      marginBottom: theme.spacing[2],
      fontSize: theme.font.size.sm,
      fontWeight: theme.font.weight.medium,
      color: theme.font.color.secondary,
    },
    notes: {
      width: '100%',
      minHeight: '72px',
      boxSizing: 'border-box' as const,
      padding: theme.spacing[2],
      borderRadius: theme.border.radius.sm,
      border: `1px solid ${theme.border.color.medium}`,
      background: theme.background.primary,
      color: theme.font.color.primary,
      fontFamily: theme.font.family,
      fontSize: theme.font.size.md,
      resize: 'vertical' as const,
    },
    saved: {
      margin: 0,
      fontSize: theme.font.size.md,
      color: theme.font.color.secondary,
    },
    error: {
      margin: 0,
      fontSize: theme.font.size.md,
      color: theme.font.color.danger,
      lineHeight: 1.5,
    },
  };

  if (!personId) {
    return (
      <div style={styles.root}>
        <p style={styles.hint}>Open one person to call them.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.root}>
        <p style={styles.error}>{loadError}</p>
      </div>
    );
  }

  const isActive = ACTIVE_STAGES.includes(stage);
  // Only ask for an outcome if the rep actually picked up their phone.
  const canLogOutcome =
    stage === 'ended' && Boolean(callSid) && !(endReason ?? '').startsWith('rep-');
  const isDncBlocked = dnc.status === 'blocked';
  const isDncPicked = outcome === DNC_VALUE;
  const isDncSaved = isDncPicked && saveState === 'saved';
  const dncTarget =
    (dnc.status === 'ok' && dnc.companyName) || person?.company?.name || null;

  return (
    <div style={styles.root}>
      <div>
        <p style={styles.name}>{person ? fullName : 'Loading…'}</p>
        {(person?.jobTitle || person?.company?.name) && (
          <p style={styles.secondary}>
            {[person?.jobTitle, person?.company?.name].filter(Boolean).join(' at ')}
          </p>
        )}
        <p style={styles.number}>{person ? phoneDisplay ?? 'No phone number' : ''}</p>
      </div>

      {isDncBlocked && (
        <div style={styles.dncBanner} role="alert">
          <p style={styles.dncTitle}>Do Not Call</p>
          <p style={styles.dncText}>{dnc.reason}</p>
        </div>
      )}

      {isActive && (
        <div style={styles.statusBox} aria-live="polite">
          {stage === 'connected' ? (
            <>
              <p style={styles.statusLine}>Talking with {firstName}</p>
              <p style={styles.timer}>{formatDuration(talkSeconds)}</p>
            </>
          ) : (
            <>
              <p style={styles.statusLine}>
                {stage === 'prospect-ringing' ? `Calling ${firstName}…` : 'Ringing your phone…'}
              </p>
              <p style={styles.hint}>
                {stage === 'prospect-ringing'
                  ? 'Stay on the line. You’ll hear it ring.'
                  : `Pick up your phone and we’ll dial ${firstName}.`}
              </p>
            </>
          )}
        </div>
      )}

      {stage === 'ended' && (
        <div style={styles.statusBox} aria-live="polite">
          <p style={styles.statusLine}>{message ?? 'Call ended.'}</p>
          {talkSeconds > 0 && (
            <p style={styles.hint}>You talked for {formatDuration(talkSeconds)}.</p>
          )}
        </div>
      )}

      {canLogOutcome && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[4] }}>
          <div>
            <p style={styles.fieldLabel}>How did it go?</p>
            <OutcomePicker
              selected={outcome}
              isLocked={isDncSaved}
              onSelect={(value) => {
                setOutcome(value);
                if (saveState === 'saved') {
                  setSaveState('idle');
                }
              }}
            />
          </div>
          <div>
            <label style={styles.fieldLabel} htmlFor="dialer-notes">
              Notes (optional)
            </label>
            <textarea
              id="dialer-notes"
              value={notes}
              disabled={isDncSaved}
              placeholder="Anything worth remembering for next time"
              onChange={(event) => {
                setNotes(event.target.value);
                if (saveState === 'saved') {
                  setSaveState('idle');
                }
              }}
              style={styles.notes}
            />
          </div>
          {isDncPicked && !isDncSaved && (
            <div style={styles.dncBanner} role="alert">
              <p style={styles.dncTitle}>This will mark {dncTarget ?? firstName} Do Not Call</p>
              <p style={styles.dncText}>
                {dncTarget
                  ? `Its Lead Status becomes DNC and nobody at ${dncTarget} can be called from the dialer again, by anyone on the team.`
                  : `${firstName} can't be called from the dialer again, by anyone on the team.`}
              </p>
            </div>
          )}
          {saveState === 'saved' ? (
            <p style={styles.saved} aria-live="polite">
              Saved to {firstName}'s Dialer Calls.
            </p>
          ) : (
            <ActionButton
              tone={isDncPicked ? 'dnc' : 'save'}
              label={
                !outcome
                  ? 'Pick an outcome to save'
                  : isDncPicked
                    ? 'Save and mark Do Not Call'
                    : 'Save call'
              }
              icon={<IconCheck size={16} />}
              isBusy={saveState === 'saving'}
              isDisabled={!outcome}
              onClick={saveOutcome}
            />
          )}
          {saveWarning && <p style={styles.error}>{saveWarning}</p>}
          {saveError && <p style={styles.error}>{saveError}</p>}
        </div>
      )}

      {stage === 'failed' && message && <p style={styles.error}>{message}</p>}

      <div>
        {isActive ? (
          <ActionButton
            tone="hang-up"
            label="Hang up"
            icon={<IconX size={16} />}
            isBusy={isBusy}
            onClick={hangUp}
          />
        ) : isDncBlocked ? null : (
          <ActionButton
            tone="call"
            label={
              dnc.status === 'checking'
                ? 'Checking Do Not Call…'
                : stage === 'idle'
                  ? `Call ${firstName}`
                  : 'Call again'
            }
            icon={<IconPhone size={16} />}
            isBusy={isBusy}
            isDisabled={!person || !phoneDisplay || dnc.status === 'checking'}
            onClick={startCall}
          />
        )}
        {stage === 'idle' && !isDncBlocked && person && phoneDisplay && (
          <p style={{ ...styles.hint, marginTop: theme.spacing[2] }}>
            Your phone rings first. When you pick up, we dial {firstName} from your
            work number.
          </p>
        )}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: DIALER_PANEL_FRONT_COMPONENT_ID,
  name: 'dialer-panel',
  description: 'Call the selected person from Twenty.',
  component: DialerPanel,
});
