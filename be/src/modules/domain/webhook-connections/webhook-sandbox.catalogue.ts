import type {
    SandboxCase,
    SandboxCatalogue,
    SandboxInboundCase,
    SandboxInboundContext,
    SandboxInput,
    SandboxInputField,
    SandboxWebhookEvent,
} from "@modules/domain/provider-sandbox"

/** The provider key of the generic webhook catalogue. */
export const WEBHOOK_SANDBOX_PROVIDER = "webhook"

/** The operation the outgoing cases answer in the sandbox call log and in the account's next-case selector. */
export const WEBHOOK_DELIVER_OPERATION = "deliver"

/** The ids of the cases, by what they prove (the implementation reads `state.nextCase` against the outgoing ones). */
export const WEBHOOK_CASE = {
    event: "WEBHOOK-1",
    redelivered: "WEBHOOK-2",
    headerNamed: "WEBHOOK-3",
    noId: "WEBHOOK-4",
    notAnEvent: "WEBHOOK-5",
    badType: "WEBHOOK-6",
    delivered: "WEBHOOK-7",
    refused: "WEBHOOK-8",
    rateLimited: "WEBHOOK-9",
    serverError: "WEBHOOK-10",
    noAnswer: "WEBHOOK-11",
    unreachable: "WEBHOOK-12",
} as const

/** The webhook route of an endpoint on NIVO for one account (the signed door of the generic webhook). */
const endpointRoute = (connectionId: string): string => `api/inbound/${connectionId}`

/** The two inputs of every inbound case (R62): the sender's words, the event type it names and a reference its data carries. */
const INPUTS: ReadonlyArray<SandboxInputField> = [
    { name: "type", label: "Loại sự kiện / Event type", kind: "text", example: "invoice.paid" },
    { name: "reference", label: "Mã tham chiếu trong dữ liệu / Reference in the data", kind: "text", example: "INV-1001" },
]

/** The inputs read back (the send checked their kinds against `INPUTS`). */
const readInput = (input: SandboxInput): { readonly type: string; readonly reference: string } => ({
    type: typeof input.type === "string" ? input.type : "",
    reference: typeof input.reference === "string" ? input.reference : "",
})

/** The delivery id of the fact a send makes: running per account (`seq` = the inbound sends of the account before this one). */
export const webhookSandboxEventId = (seq: number): string => `sbx-evt-${String(seq + 1).padStart(6, "0")}`

/** One inbound case: the plan turns the inputs and the running number into the webhook calls the sender makes. */
const caseOf = (
    plan: (input: { readonly type: string; readonly reference: string }, id: string, seq: number) => ReadonlyArray<SandboxWebhookEvent>,
): SandboxInboundCase => ({
    trigger: "generic_webhook",
    path: endpointRoute,
    inputs: INPUTS,
    eventsOf: (input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>> =>
        Promise.resolve(plan(readInput(input), webhookSandboxEventId(context.state.seq), context.state.seq)),
})

/** One outgoing case: what the receiver answers to the signed delivery. */
const deliver = (id: string, label: string, isDefault: boolean): SandboxCase => ({
    id,
    label,
    operation: WEBHOOK_DELIVER_OPERATION,
    ...(isDefault ? { default: true as const } : {}),
})

/**
 * The generic webhook's hardcoded sandbox cases (R60, R62). INBOUND (`WEBHOOK-1..6`): a system outside NIVO posts JSON to the account's
 * endpoint `api/inbound/<connectionId>` and the door reads it as the live door does; each case takes `{ type, reference }` (the sender's
 * words) and builds the body, ids running per account. OUTGOING (`WEBHOOK-7..12`): NIVO posts a signed business event to the receiver the
 * account names (the wizard's test, the delivery job); the account's sticky NEXT CASE of `deliver` picks what the receiver answers,
 * `WEBHOOK-7` while nothing is picked.
 */
export const WEBHOOK_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: WEBHOOK_SANDBOX_PROVIDER,
    cases: [
        {
            id: WEBHOOK_CASE.event,
            label: "An event: the sender names the type in its body and gives the delivery its own id",
            inbound: caseOf(({ type, reference }, id) => [{ body: { type, id, data: { reference } } }]),
        },
        {
            id: WEBHOOK_CASE.redelivered,
            label: "A redelivery: the same event (same id, same bytes) posted twice; the door keeps it once",
            inbound: caseOf(({ type, reference }, id) => {
                const event: SandboxWebhookEvent = { body: { type, id, data: { reference } } }
                return [event, event]
            }),
        },
        {
            id: WEBHOOK_CASE.headerNamed,
            label: "Named in the headers: the type in x-event-type and the delivery key in x-idempotency-key, a body with neither",
            inbound: caseOf(({ type, reference }, id) => [
                { body: { data: { reference } }, headers: { "x-event-type": type, "x-idempotency-key": id } },
            ]),
        },
        {
            id: WEBHOOK_CASE.noId,
            label: "No id anywhere: the sender names no delivery key, so the fact is the digest of its bytes (the running number keeps each send a new fact)",
            inbound: caseOf(({ type, reference }, _id, seq) => [{ body: { type, data: { reference, number: seq + 1 } } }]),
        },
        {
            id: WEBHOOK_CASE.notAnEvent,
            label: "Not an event: the body is a JSON list, which the door refuses before anything is kept",
            inbound: caseOf(({ reference }) => [{ body: [reference] }]),
        },
        {
            id: WEBHOOK_CASE.badType,
            label: "A type that is no event identity (it holds a space): the door refuses it before anything is kept",
            inbound: caseOf(({ reference }, id) => [{ body: { type: "not an event", id, data: { reference } } }]),
        },
        deliver(WEBHOOK_CASE.delivered, "The receiver accepts the signed delivery (HTTP 200)", true),
        deliver(WEBHOOK_CASE.refused, "The receiver refuses it for good (HTTP 400): recorded on the connection, never retried", false),
        deliver(WEBHOOK_CASE.rateLimited, "The receiver asks to slow down (HTTP 429): the queue retries", false),
        deliver(WEBHOOK_CASE.serverError, "The receiver fails with a server error (HTTP 503): the queue retries", false),
        deliver(WEBHOOK_CASE.noAnswer, "The receiver does not answer in time (timeout): the outcome is unknown, the queue retries", false),
        deliver(WEBHOOK_CASE.unreachable, "The receiver cannot be reached: nothing arrived, the queue retries", false),
    ] satisfies ReadonlyArray<SandboxCase>,
}
