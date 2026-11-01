import { z } from "zod"

const KEY_MAX = 120
const ID_MAX = 200
const VALUE_MAX = 2000
const TEXT_MAX = 4000
const PAYLOAD_KEYS_MAX = 100
const ITEMS_MAX = 100
const CHAIN_AGENTS_MAX = 50
const DEPTH_MAX = 1000

/** A JSON value a payload may hold. */
type PayloadValue =
    string | number | boolean | null | ReadonlyArray<PayloadValue> | { readonly [key: string]: PayloadValue }

const payloadScalarSchema = z.union([z.string().max(TEXT_MAX), z.number(), z.boolean(), z.null()])

/** A JSON value whose every collection has a count bound; the door bounds the whole payload in bytes before it is kept. */
const payloadValueSchema: z.ZodType<PayloadValue> = z.lazy(() =>
    z.union([payloadScalarSchema, z.array(payloadValueSchema).max(ITEMS_MAX), payloadRecordSchema]),
)

/** The words and fields of an event, as bounded JSON. */
const payloadRecordSchema = z
    .record(z.string().max(KEY_MAX), payloadValueSchema)
    .refine((record) => Object.keys(record).length <= PAYLOAD_KEYS_MAX)
    .meta({ maxProperties: PAYLOAD_KEYS_MAX })

/** Who sent an event. */
const wakeActorSchema = z.strictObject({
    kind: z.string().min(1).max(KEY_MAX),
    id: z.string().max(ID_MAX).nullable(),
    role: z.string().max(KEY_MAX).nullable(),
})

/** The chain of agents an event belongs to. */
const wakeChainSchema = z.strictObject({
    id: z.string().min(1).max(ID_MAX),
    depth: z.number().int().min(0).max(DEPTH_MAX),
    agentIds: z.array(z.string().min(1).max(ID_MAX)).max(CHAIN_AGENTS_MAX),
    cause: z.string().max(VALUE_MAX).nullable(),
})

/** A file that came with an event. */
const wakeAttachmentSchema = z.strictObject({
    fileId: z.string().min(1).max(ID_MAX),
    mimeType: z.string().min(1).max(KEY_MAX),
})

/** One thing an event proves. */
const wakeEvidenceSchema = z.strictObject({
    key: z.string().min(1).max(KEY_MAX),
    value: z.union([z.string().max(VALUE_MAX), z.number(), z.boolean()]),
    kind: z.string().min(1).max(KEY_MAX),
    via: z.string().min(1).max(KEY_MAX),
})

/** The normalized inbound event as the context of a wake keeps it; anything outside this shape is dropped when a wake is read back. */
export const wakeInboundSchema = z.strictObject({
    eventType: z.string().min(1).max(KEY_MAX),
    actor: wakeActorSchema,
    trust: z.string().min(1).max(KEY_MAX),
    chain: wakeChainSchema.nullable(),
    payload: payloadRecordSchema,
    attachments: z.array(wakeAttachmentSchema).max(ITEMS_MAX),
    evidence: z.array(wakeEvidenceSchema).max(ITEMS_MAX),
})
