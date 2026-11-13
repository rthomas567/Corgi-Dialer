export const APP_DISPLAY_NAME = 'Corgi Dialer';
export const APP_DESCRIPTION = 'Click-to-call dialer (SignalWire test version)';

export const APPLICATION_UNIVERSAL_IDENTIFIER = '4283439d-d91e-4af0-9c51-611f3daf9eb5';
export const DEFAULT_ROLE_UNIVERSAL_IDENTIFIER = '41125f8d-7c5a-4eb6-a582-d2df94217be4';

// Settings (application variables)
// SignalWire test version: same IDs as the original SignalWire settings, so
// the values already filled in Twenty are kept.
export const VAR_SIGNALWIRE_SPACE_URL_ID = 'bdc49be4-d598-45f9-8949-2ed7e6705348';
export const VAR_SIGNALWIRE_PROJECT_ID_ID = '87701c7f-cace-473d-9792-a43b5307713e';
export const VAR_SIGNALWIRE_API_TOKEN_ID = '08aa755e-5da3-43b8-aa52-81779a440f61';
export const VAR_SIGNALWIRE_SIGNING_KEY_ID = '001a00e7-2c6d-4d5b-b63e-db7e216464d9';
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


// Version 8: power & parallel dialing
export const SESSION_START_FUNCTION_ID = 'c127b392-bb6a-4763-91b5-1a4b09cf3405';
export const SESSION_STATUS_FUNCTION_ID = 'e34d5f33-7162-43c4-8d27-a4f69917d4d6';
export const SESSION_CONTROL_FUNCTION_ID = '2be0de6b-4c78-4546-974f-aef87c8baf63';
export const SESSION_REP_ANSWERED_FUNCTION_ID = 'eba2c222-4674-4233-b44e-4c6a5a3d89d3';
export const SESSION_REP_EVENTS_FUNCTION_ID = 'a56dcb38-23c4-46d6-8a17-ff6c10997509';
export const SESSION_LEG_ANSWERED_FUNCTION_ID = 'dda0c06f-ffd8-47fb-bfda-bf73c7044603';
export const SESSION_LEG_EVENTS_FUNCTION_ID = 'cfcf796a-391f-40c6-a339-6fb411eb40d0';
export const QUEUE_ADD_FUNCTION_ID = '048b0148-53e3-4851-ae29-39d6ac2de196';
export const POWER_DIALER_PEOPLE_FRONT_COMPONENT_ID = 'efdfc5f5-429c-41bd-9139-d9b7d9bb4bfa';
export const POWER_DIALER_COMPANIES_FRONT_COMPONENT_ID = 'c2beed30-bb7a-4d47-9b7d-ce34cec3e869';
export const POWER_DIALER_QUEUE_FRONT_COMPONENT_ID = '086702ca-3905-4c16-9231-8414807b85a2';
export const POWER_DIALER_RESUME_FRONT_COMPONENT_ID = '0002e31b-dc55-4a76-8a0d-69a15e6cde24';
export const ADD_TO_QUEUE_PEOPLE_FRONT_COMPONENT_ID = 'afb348ec-5501-46fe-a169-6a2b4bfdbd48';
export const ADD_TO_QUEUE_COMPANIES_FRONT_COMPONENT_ID = 'e28af3d7-176c-4911-9906-74effcbd34f2';
export const DIAL_PEOPLE_COMMAND_ID = 'aeffe732-ed1d-4fb9-9490-c34abc14d3e1';
export const DIAL_COMPANIES_COMMAND_ID = '7ec70d1f-045f-41e8-9706-7ee99cf9cfac';
export const DIAL_QUEUE_COMMAND_ID = 'a82ed746-538d-4a46-bc2c-38cfd8b9fa2a';
export const OPEN_DIALER_COMMAND_ID = '30c73a33-50fe-4716-acbf-8a68c219d344';
export const QUEUE_PEOPLE_COMMAND_ID = 'bb252431-1cf1-40a4-b678-7b49a28c16f7';
export const QUEUE_COMPANIES_COMMAND_ID = 'e499b19f-602a-41c6-b2bd-4460eb3398ea';
export const CALL_QUEUE_OBJECT_ID = '2e0d5b9a-8800-4313-8df0-ac30c755e28a';
export const CALL_QUEUE_NAME_FIELD_ID = '0a5813bb-8a08-4e74-a947-978756922fc2';
export const CALL_QUEUE_STATUS_FIELD_ID = 'c7ff6070-2b4b-4171-a2af-92ea5b439277';
export const CALL_QUEUE_PERSON_FIELD_ID = 'e16cf98c-e37f-4c7a-97a4-60e96c985320';
export const CALL_QUEUE_COMPANY_FIELD_ID = '752e14c3-4b06-4a06-8a47-60ee7757b034';
export const CALL_QUEUE_LAST_CALLED_FIELD_ID = '0839b820-0037-48cd-96bd-0ad9562f3a0f';
export const CALL_QUEUE_LAST_RESULT_FIELD_ID = '2bdfdb86-fde1-4bc2-b284-f0474b23f78c';
export const PERSON_CALL_QUEUE_FIELD_ID = '4b65afbf-c99e-4286-ad6f-be3655c075ac';
export const COMPANY_CALL_QUEUE_FIELD_ID = '8cfb8bb6-a6a8-405d-a8b1-c4fe12b64c1b';
export const CALL_QUEUE_VIEW_ID = 'b759a8cd-25f3-46a0-927c-e045a7f71722';
export const CALL_QUEUE_NAV_ITEM_ID = '452e365f-6245-469d-bb67-0df54b6bbbbe';
export const CALL_QUEUE_SORT_ID = '56c4bc35-a407-4ab6-a727-659d9401f6ad';
export const CALL_QUEUE_VIEW_FIELD_IDS = [
  '768b19db-3035-4c5d-b432-11a9f4592ea7',
  'f8783673-9a33-4efa-9ac1-e319b5faccb9',
  '058af4da-58ea-43dd-bc1d-82a2b788be48',
  '5c2f25e5-b3ff-468a-8120-0641f9b76138',
  '9cad5314-3713-48e8-bab3-6a5479e2f35a',
  '40a18eb0-6ae5-440d-8f6b-e75de57a85a3',
] as const;

export const ROUTE_SESSION_START = '/dialer/session/start';
export const ROUTE_SESSION_STATUS = '/dialer/session/status';
export const ROUTE_SESSION_CONTROL = '/dialer/session/control';
export const ROUTE_SESSION_REP_ANSWERED = '/dialer/session/rep-answered';
export const ROUTE_SESSION_REP_EVENTS = '/dialer/session/rep-events';
export const ROUTE_SESSION_LEG_ANSWERED = '/dialer/session/leg-answered';
export const ROUTE_SESSION_LEG_EVENTS = '/dialer/session/leg-events';
export const ROUTE_QUEUE_ADD = '/dialer/queue/add';
