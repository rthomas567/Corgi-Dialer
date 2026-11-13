import { useEffect, useRef, useState } from 'react';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { useSelectedRecordIds } from 'twenty-sdk/front-component';
import { useTheme } from 'twenty-ui/theme-constants';

import { ROUTE_QUEUE_ADD } from 'src/constants/universal-identifiers';

type AddResponse =
  | { ok: true; added: number; alreadyQueued: number; failed: number }
  | { ok: false; message: string };

// "Add to Call Queue": adds the selected people or companies as soon as it opens.
export const AddToQueue = ({ source }: { source: 'person' | 'company' }) => {
  const theme = useTheme();
  const selectedIds = useSelectedRecordIds();
  const [message, setMessage] = useState('Adding to the Call Queue…');
  const [isError, setIsError] = useState(false);
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    if (selectedIds.length === 0) {
      setMessage(`Tick the ${source === 'person' ? 'people' : 'companies'} to add first.`);
      return;
    }
    sentRef.current = true;
    new RestApiClient()
      .post<AddResponse>(`/s${ROUTE_QUEUE_ADD}`, { object: source, recordIds: selectedIds })
      .then((result) => {
        if (!result.ok) {
          setIsError(true);
          setMessage(result.message);
          return;
        }
        const parts = [`Added ${result.added} to the Call Queue.`];
        if (result.alreadyQueued > 0) parts.push(`${result.alreadyQueued} already waiting there.`);
        if (result.failed > 0) parts.push(`${result.failed} could not be added.`);
        setMessage(parts.join(' '));
      })
      .catch(() => {
        setIsError(true);
        setMessage('Could not add to the Call Queue. Try again.');
      });
  }, [selectedIds, source]);

  return (
    <div style={{ padding: theme.spacing[4], fontFamily: theme.font.family }}>
      <p
        style={{
          margin: 0,
          fontSize: theme.font.size.md,
          lineHeight: 1.5,
          color: isError ? theme.font.color.danger : theme.font.color.primary,
        }}
      >
        {message}
      </p>
    </div>
  );
};
