export const APP_DISPLAY_NAME = 'Corgi Dialer';
export const APP_DESCRIPTION = 'Click-to-call dialer powered by SignalWire';

export const APPLICATION_UNIVERSAL_IDENTIFIER = '4283439d-d91e-4af0-9c51-611f3daf9eb5';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '41125f8d-7c5a-4eb6-a582-d2df94217be4';

// Settings (application variables)
export const VAR_SIGNALWIRE_SPACE_URL_ID = 'bdc49be4-d598-45f9-8949-2ed7e6705348';
export const VAR_SIGNALWIRE_PROJECT_ID_ID = '87701c7f-cace-473d-9792-a43b5307713e';
export const VAR_SIGNALWIRE_API_TOKEN_ID = '08aa755e-5da3-43b8-aa52-81779a440f61';
export const VAR_DIALER_REPS_ID = 'ca4221ba-2402-4830-be5a-f2f29fff7d79';

// Server-side functions
export const START_CALL_FUNCTION_ID = '705071a6-1769-41f6-b7d2-cc3814bcb10a';
export const BRIDGE_FUNCTION_ID = '75fbe4be-82fd-4bea-a661-aa22ec97825f';
export const CALL_EVENTS_FUNCTION_ID = '6e903fa4-0907-43d4-8c8e-edd5ded5aba0';
export const CALL_STATUS_FUNCTION_ID = 'ede01fd8-f3a9-42ca-ad67-a8a922962fd2';
export const HANG_UP_FUNCTION_ID = '153db5ee-44fe-4c02-9b17-dd0728ebc6a4';

// Dialer panel + Call button
export const DIALER_PANEL_FRONT_COMPONENT_ID = 'ee7dae32-47af-479a-afb1-506dcd54bf8b';
export const CALL_PERSON_COMMAND_MENU_ITEM_ID = 'ddd9abf4-6d54-4f8b-b77a-2ba2fbe20bf0';

// Route paths (the panel calls these with a "/s" prefix)
export const ROUTE_START_CALL = '/dialer/start-call';
export const ROUTE_BRIDGE = '/dialer/bridge';
export const ROUTE_CALL_EVENTS = '/dialer/call-events';
export const ROUTE_CALL_STATUS = '/dialer/call-status';
export const ROUTE_HANG_UP = '/dialer/hang-up';

// Version 2: saving call outcomes
export const VAR_SIGNALWIRE_SIGNING_KEY_ID = '001a00e7-2c6d-4d5b-b63e-db7e216464d9';
export const SAVE_OUTCOME_FUNCTION_ID = '07186422-8341-4f8b-acd0-75db4b2f930e';
export const ROUTE_SAVE_OUTCOME = '/dialer/save-outcome';

export const DIALER_CALL_OBJECT_ID = '1839786a-ec02-490c-9cf2-d6c017781d24';
export const DIALER_CALL_NAME_FIELD_ID = '4c62ae05-b2f0-4d6d-b73d-518b18904768';
export const DIALER_CALL_OUTCOME_FIELD_ID = 'a4762440-7d09-4c5d-bfe9-74b07e865a9d';
export const DIALER_CALL_NOTES_FIELD_ID = '44cba5bf-812f-4375-930e-be0ff9fe465a';
export const DIALER_CALL_DURATION_FIELD_ID = 'f54ee60a-9984-43a2-a75b-953b399c1fbc';
export const DIALER_CALL_PHONE_FIELD_ID = 'e1194653-48c7-4105-a7dc-8955f416e00b';
export const DIALER_CALL_SID_FIELD_ID = '26c16167-5529-48e0-a206-af755f2fa86e';
export const DIALER_CALL_CALLED_AT_FIELD_ID = 'e08833c6-eecd-4e55-a6f4-1fe784f8f58e';
export const DIALER_CALL_PERSON_FIELD_ID = '2b06a596-b82d-49f2-b9a7-1f25049a3cdb';
export const DIALER_CALL_COMPANY_FIELD_ID = '5c0eef9e-7e81-4a6c-9c58-090dc9836235';
export const PERSON_DIALER_CALLS_FIELD_ID = 'feba3397-857f-4f21-93bb-3a57ea35b7c2';
export const COMPANY_DIALER_CALLS_FIELD_ID = 'dbf19755-42d8-4a7c-a95c-f106c83fa2db';

// Version 3: Do Not Call handling
export const CALL_CHECK_FUNCTION_ID = '229f7452-8d2b-4f45-ba6d-f9ddf148528d';
export const ROUTE_CALL_CHECK = '/dialer/call-check';
