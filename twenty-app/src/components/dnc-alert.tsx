import { IconAlertTriangle } from 'twenty-ui/icon';
import { useTheme } from 'twenty-ui/theme-constants';

type DncAlertProps = { message: string; scope?: 'company' | 'person' };

// Solid red, hard-to-miss "DO NOT CALL" block.
export const DncAlert = ({ message, scope = 'company' }: DncAlertProps) => {
  const theme = useTheme();
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing[2],
        padding: theme.spacing[5],
        borderRadius: theme.border.radius.md,
        background: theme.color.red,
        color: '#FFFFFF',
        fontFamily: theme.font.family,
      }}
    >
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2],
          margin: 0,
          fontSize: '28px',
          lineHeight: 1.1,
          fontWeight: theme.font.weight.semiBold,
          letterSpacing: '0.02em',
        }}
      >
        <IconAlertTriangle size={28} />
        DO NOT CALL
      </p>
      <p style={{ margin: 0, fontSize: theme.font.size.lg, lineHeight: 1.45 }}>{message}</p>
      <p style={{ margin: 0, fontSize: theme.font.size.md, lineHeight: 1.45, opacity: 0.9 }}>
        {scope === 'company'
          ? "The dialer is turned off here. To undo, turn off the company's DNC switch and change its Lead Status."
          : 'The dialer is turned off here. To undo, change the outcome on their DNC Dialer Call.'}
      </p>
    </div>
  );
};
