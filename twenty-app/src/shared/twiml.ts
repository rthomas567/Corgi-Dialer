import { Response } from 'twenty-sdk/logic-function';

// SignalWire's call instructions ("TwiML") are XML.
export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const twimlResponse = (innerXml: string) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } },
  );
