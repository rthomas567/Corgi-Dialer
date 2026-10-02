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

// Removed in version 7 (the small Call button and its side panel). Kept so the
// IDs are never reused.
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

// Version 4: call recording
export const VAR_RECORDING_ANNOUNCEMENT_ID = '7bae7178-87f3-4b66-95cd-17a3dc88386c';
export const RECORDING_READY_FUNCTION_ID = '509084ef-711f-4bc7-8c9a-a915503f773b';
export const WHISPER_FUNCTION_ID = 'b5afc768-c808-4d32-b05f-7d789ff70a6d';
export const ROUTE_RECORDING_READY = '/dialer/recording-ready';
export const ROUTE_WHISPER = '/dialer/whisper';

export const DIALER_CALL_RECORDING_FIELD_ID = '75aa8d29-1f40-431a-a2c2-2d98f25ac6e3';
export const DIALER_CALL_RECORDING_SECONDS_FIELD_ID = '7b6bc744-f61a-4afb-bbaf-d0f1b30604c8';
export const DIALER_CALL_RESULT_FIELD_ID = '006d3817-93f8-4b6c-b26c-ddc5ffa73ae8';
export const DIALER_CALL_REP_FIELD_ID = '27afa349-4034-4be8-b8c3-a10b7a3250fc';

export const RECORDED_CALLS_VIEW_ID = 'ad52e088-fae0-46f2-950a-b859d8752dd3';
export const RECORDED_CALLS_FILTER_ID = '02e34f54-5c15-488a-8a69-71329d4c86d6';
export const RECORDED_CALLS_SORT_ID = 'ea493a6a-6944-477f-94c8-d5f5d93aea11';
export const RECORDED_CALLS_NAV_ITEM_ID = '72172f31-c79f-4bec-a04d-c804dea34025';
export const RECORDED_CALLS_VIEW_FIELD_IDS = [
  'b7149b70-b2be-42bc-8fce-1a5ab2b3c263',
  '5c1049bf-32bb-41de-be80-88a6c4545135',
  '0d93f4a7-63e3-4711-86ff-8bcfd0a6ca70',
  '485482f2-59f6-44be-bc30-ec39d0b71771',
  'c95cc4ed-5e52-4208-9802-b63aa9fcc6bf',
  'af072548-0d2f-4a7b-8277-b39a631bb5de',
  'bdd811d2-3613-40eb-8698-d95649e0f705',
  '0726335f-9dbf-4f39-91a8-b852452908c9',
  'b7758d42-d2df-428b-8d9b-2072ce7c4c9d',
] as const;


// Version 5: big orange Call box on the person page + required outcome
export const MY_CALL_FUNCTION_ID = 'a9f50c05-77c9-46d2-89f1-ccbf12e17c1a';
export const ROUTE_MY_CALL = '/dialer/my-call';
export const PERSON_CALL_WIDGET_ID = 'abc963fe-b784-485c-9940-ad3ced684c12';
export const PERSON_CALL_BOX_FRONT_COMPONENT_ID = 'e8f2c20f-cb16-496c-92c3-105cf756cf33';

// Version 6: big Do Not Call warnings (person page + company page)
export const COMPANY_DNC_BOX_FRONT_COMPONENT_ID = '5a27ab98-e569-43fb-aca8-bd2c670e0b83';
export const COMPANY_DNC_WIDGET_ID = '64d2b695-3ff1-4a7f-8fc6-d6106f68ca27';

// Version 8: Atlas -> Opportunities sync (replaces Broker Submissions)
export const ATLAS_WEBHOOK_FUNCTION_ID = 'b013077b-febf-42e2-b724-f5efb4d1bec8';
export const ATLAS_SAMPLES_FUNCTION_ID = '68fd5a97-7d64-4944-9f92-b9256cbce94c';
export const ROUTE_ATLAS_WEBHOOK = '/atlas/webhook';
export const ROUTE_ATLAS_SAMPLES = '/atlas/samples';
export const OPPORTUNITY_ATLAS_SUBMISSION_FIELD_ID = '74ae412a-5737-41d5-9130-b50db1fa6822';
export const VAR_ATLAS_WEBHOOK_SECRET_ID = '0d3058ed-af35-4035-bf68-8c5037cb7168';
export const VAR_ATLAS_API_KEY_ID = 'f03a8fd6-6eb5-4275-b176-ec18a816592d';
export const VAR_ATLAS_ENVIRONMENT_ID = '56c699c1-b6c5-4db8-8b1b-2ca3d33c2e03';
