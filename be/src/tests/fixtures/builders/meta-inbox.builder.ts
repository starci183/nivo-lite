import type { MetaEvent } from "@modules/integrations/meta"

/** Deterministic Meta delivery test data. */
export const BODY = { object: "page", entry: [{ id: "page-1" }] }

/** Deterministic Meta delivery test data. */
export const RAW_BODY = Buffer.from(JSON.stringify(BODY))

/** Deterministic Meta delivery test data. */
export const DELIVERY_ID = "cf4757fb1d998bf973749a593b19bf7ecac5a415369525483e3dd6219ed26a52"

/** Deterministic Meta delivery test data. */
export const SIGNATURE = "sha256=signed-delivery"

/** Deterministic Meta delivery test data. */
export const AT = "2026-10-12T03:00:00.000Z"

/** Deterministic Meta delivery test data. */
export const OWNER = { id: "connection-1", workspaceId: "workspace-1" }

/** Deterministic Meta delivery test data. */
export const event = (overrides: Partial<MetaEvent> = {}): MetaEvent => ({
    kind: "dm",
    platform: "facebook",
    page_id: "page-1",
    ig_id: null,
    sender_psid: "person-1",
    sender_igsid: null,
    sender_name: "Lan",
    text: "Hello",
    comment_id: null,
    post_id: null,
    leadgen_id: null,
    form_id: null,
    ad_id: null,
    referral: null,
    postback_payload: null,
    mid: "message-1",
    timestamp: Date.parse(AT),
    event_key: "dm:message-1",
    ...overrides,
})

/** Complete parameterized delivery cases, shared without dropping any case. */
export const unreadableReceipts = [
    { rawBody: undefined, signature: SIGNATURE },
    { rawBody: RAW_BODY, signature: undefined },
    { rawBody: Buffer.from("{invalid"), signature: SIGNATURE },
    { rawBody: Buffer.from("null"), signature: SIGNATURE },
    { rawBody: Buffer.from("[]"), signature: SIGNATURE },
]

/** Complete parameterized delivery cases, shared without dropping any case. */
export const directMessages = [
    {
        name: "a Facebook DM with its PSID taking precedence",
        inbound: event({ sender_igsid: "other-person" }),
        personId: "person-1",
        visitor: "Lan",
    },
    {
        name: "an Instagram DM with its IGSID and a null visitor",
        inbound: event({
            platform: "instagram",
            sender_psid: null,
            sender_igsid: "ig-person-1",
            sender_name: null,
            text: "Instagram hello",
            event_key: "dm:instagram-message-1",
        }),
        personId: "ig-person-1",
        visitor: null,
    },
]

/** Complete parameterized delivery cases, shared without dropping any case. */
export const ignoredMessages = [
    { name: "a postback", inbound: event({ kind: "postback" }) },
    { name: "a comment", inbound: event({ kind: "comment" }) },
    { name: "a mention", inbound: event({ kind: "mention" }) },
    { name: "a lead ad", inbound: event({ kind: "leadgen" }) },
    { name: "a DM without a person", inbound: event({ sender_psid: null, sender_igsid: null }) },
    { name: "a DM without text", inbound: event({ text: null }) },
    { name: "a DM with empty text", inbound: event({ text: "" }) },
]

/** A signed surface event used by the window assertions. */
export const dm = event({ text: "x".repeat(161) })

/** A signed surface event used by the window assertions. */
export const postback = event({
    kind: "postback",
    platform: "instagram",
    page_id: null,
    ig_id: "ig-1",
    sender_psid: null,
    sender_igsid: "ig-person-1",
    sender_name: null,
    text: null,
    event_key: "postback:button-1",
})

/** A signed surface event used by the window assertions. */
export const comment = event({ kind: "comment", comment_id: "comment-1", event_key: "comment:1" })

/** A signed surface event used by the window assertions. */
export const mention = event({
    kind: "mention",
    platform: "instagram",
    page_id: null,
    ig_id: "ig-1",
    comment_id: "comment-2",
    event_key: "mention:2",
})

/** Surface events covering missing and unowned identities. */
export const missingWindowEvents = [
    event({ sender_psid: null }),
    event({ kind: "postback", sender_psid: null, event_key: "postback:missing-person" }),
    event({ kind: "comment", event_key: "comment:missing-id" }),
    event({ kind: "mention", event_key: "mention:missing-id" }),
    event({ kind: "leadgen", event_key: "leadgen:lead-1" }),
]

/** Surface events covering missing and unowned identities. */
export const unownedSurfaceEvents = [
    event({ page_id: null }),
    event({ platform: "instagram", ig_id: null }),
    event({ page_id: "unowned-page" }),
    event({ platform: "instagram", ig_id: "unowned-ig" }),
]

/** Independent expected window effects in their recorded order. */
export const expectedThreadWindows = (manager: unknown) => [
    [{ connectionId: "connection-1", platform: "facebook", userId: "person-1", at: AT }, manager],
    [{ connectionId: "connection-1", platform: "instagram", userId: "ig-person-1", at: AT }, manager],
]

/** Independent expected window effects in their recorded order. */
export const expectedCommentWindows = (manager: unknown) => [
    [{ connectionId: "connection-1", commentId: "comment-1", platform: "facebook", at: AT }, manager],
    [{ connectionId: "connection-1", commentId: "comment-2", platform: "instagram", at: AT }, manager],
]

/** Expected window calls, with the transaction supplied by the spec. */
export const expectedMessageJobs = (manager: unknown, queue: string) => [
    [
        manager,
        queue,
        { connectionId: "connection-1", workspaceId: "workspace-1", event: dm },
        { dedupeKey: "meta_inbound:connection-1:dm:message-1" },
    ],
    [
        manager,
        queue,
        { connectionId: "connection-1", workspaceId: "workspace-1", event: postback },
        { dedupeKey: "meta_inbound:connection-1:postback:button-1" },
    ],
]

/** Expected window calls, with the transaction supplied by the spec. */
export const expectedCommentJobs = (manager: unknown, queue: string) => [
    [
        manager,
        queue,
        { connectionId: "connection-1", workspaceId: "workspace-1", event: comment },
        { dedupeKey: "meta_inbound:connection-1:comment:1" },
    ],
    [
        manager,
        queue,
        { connectionId: "connection-1", workspaceId: "workspace-1", event: mention },
        { dedupeKey: "meta_inbound:connection-1:mention:2" },
    ],
]

/** One queued handoff for each owned surface event. */
export const surfaceEventCalls = (events: ReadonlyArray<MetaEvent>, manager: unknown, queue: string) =>
    events.map((item) => [
        manager,
        queue,
        { connectionId: "connection-1", workspaceId: "workspace-1", event: item },
        { dedupeKey: `meta_inbound:connection-1:${item.event_key}` },
    ])

/** The expected direct-message handoff. */
export const directMessageCalls = (manager: unknown, inbound: MetaEvent, personId: string, visitor: string | null) => [
    [
        "connection-1",
        {
            platform: inbound.platform,
            personId,
            visitor,
            text: inbound.text,
            eventId: inbound.event_key,
        },
        manager,
    ],
]

/** Expected recorded surface state. */
export const expectedSurfaceLookups = (manager: unknown) => [
    ["meta", "page_id", "page-1", manager],
    ["meta", "ig_id", "ig-1", manager],
]

/** Expected recorded surface state. */
export const expectedMessageRecords = (manager: unknown) => [
    ["connection-1", { amount: 0, content: "Lan", at: AT, text: "x".repeat(160) }, manager],
    ["connection-1", { amount: 0, content: "postback", at: AT, text: "" }, manager],
]

/** Expected recorded surface state. */
export const expectedCommentRecords = (manager: unknown) => [
    ["connection-1", { amount: 0, content: "Lan", at: AT, text: "Hello" }, manager],
    ["connection-1", { amount: 0, content: "Lan", at: AT, text: "Hello" }, manager],
]

/** Expected recorded surface state. */
export const expectedUnownedLookups = (manager: unknown) => [
    ["meta", "page_id", "unowned-page", manager],
    ["meta", "ig_id", "unowned-ig", manager],
]

/** A receipt exercising the real Meta parser during rollback and replay. */
export const replayReceiptBody = {
    object: "page",
    entry: [
        {
            id: "page-1",
            messaging: [{ sender: { id: "person-1" }, message: { mid: "message-real", text: "Hello" } }],
        },
    ],
}
