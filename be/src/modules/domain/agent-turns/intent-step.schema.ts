import { z } from "zod"
import { WAKE_SOURCE_KEY, wakeInboundSchema } from "@modules/domain/agent-work"
import { INTENT_TRIGGER_MAX, INTENT_TRIGGER_PATTERN } from "@modules/domain/intent-contracts"
import { TURN_TEXT_MAX } from "./intent-turn.policy"
import type { WakeRow } from "./agent-turns.contracts"

const ID_MAX = 100
const INTENT_MAX = 80
const LABEL_MAX = 200
const TASK_MAX = 4000
const LIMIT_MAX = 1000
const LIMITS_MAX = 40
const OWNS_MAX = 20
const CHECKS_MAX = 20
const CONTRACTS_MAX = 40
const DETAIL_MAX = 300
const DRAFT_MAX = 20_000
const QUESTION_MAX = 300
const TOPIC_MAX = 160
const DROPPED_MAX = 40
const RESULT_MAX = 40_000
const CONTEXT_KEYS_MAX = 20
const CONTEXT_VALUE_MAX = 200
const NAME_MAX = 120
const COUNT_MAX = 100
const TIME_MAX = 40
const REPLY_MAX = 2000
const MONEY_MAX = 4000

const idSchema = z.string().min(1).max(ID_MAX)
const triggerSchema = z.string().min(1).max(INTENT_TRIGGER_MAX).regex(INTENT_TRIGGER_PATTERN)
const trustSchema = z.enum(["outsider", "member", "manager", "system"])

type StrictObject<Shape extends z.core.$ZodShape> = z.ZodObject<Shape, z.core.$strict>
type TrustSchema = z.ZodEnum<{ outsider: "outsider"; member: "member"; manager: "manager"; system: "system" }>
type ContractSchema = StrictObject<{
    intent: z.ZodString
    label: z.ZodString
    ownTurn: z.ZodBoolean
    task: z.ZodString
    limits: z.ZodArray<z.ZodString>
    result: z.ZodString
    owns: z.ZodArray<z.ZodString>
    checks: z.ZodArray<z.ZodString>
}>
type PlanRowSchema = StrictObject<{
    versionId: z.ZodString
    trigger: z.ZodString
    trust: TrustSchema
    pinned: z.ZodNullable<z.ZodString>
    contracts: z.ZodArray<ContractSchema>
}>
type TurnRowSchema = StrictObject<{ text: z.ZodString }>
type ReadInputSchema = StrictObject<{ plan: PlanRowSchema; text: z.ZodString }>
type ReadingRowSchema = z.ZodDiscriminatedUnion<
    [
        StrictObject<{
            kind: z.ZodLiteral<"picked">
            contract: ContractSchema
            resultText: z.ZodString
            dropped: z.ZodArray<z.ZodString>
        }>,
        StrictObject<{ kind: z.ZodLiteral<"split">; contract: ContractSchema }>,
        StrictObject<{
            kind: z.ZodLiteral<"safe">
            cause: z.ZodEnum<{ no_intent: "no_intent"; invalid_output: "invalid_output"; check_failed: "check_failed" }>
            detail: z.ZodString
            intent: z.ZodNullable<z.ZodString>
            gap: z.ZodNullable<StrictObject<{ question: z.ZodString; topic: z.ZodString }>>
            draft: z.ZodString
        }>,
    ],
    "kind"
>
type TraceRowSchema = StrictObject<{
    versionId: z.ZodString
    trigger: z.ZodString
    trust: TrustSchema
    offered: z.ZodArray<z.ZodString>
    intent: z.ZodNullable<z.ZodString>
    result: z.ZodEnum<{
        picked: "picked"
        split: "split"
        no_intent: "no_intent"
        invalid_output: "invalid_output"
        check_failed: "check_failed"
    }>
    detail: z.ZodString
    dropped: z.ZodArray<z.ZodString>
}>
type ReadResultSchema = StrictObject<{ reading: ReadingRowSchema; trace: TraceRowSchema }>
type WakeObjectSchema = StrictObject<{
    inbound: z.ZodOptional<typeof wakeInboundSchema>
    workspaceId: z.ZodString
    agentId: z.ZodString
    scopeKey: z.ZodString
    wakeId: z.ZodString
    turnId: z.ZodString
    source: z.ZodString
    eventKey: z.ZodString
    context: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodBoolean]>>
    actorMemberId: z.ZodNullable<z.ZodString>
    attempts: z.ZodNumber
    maxAttempts: z.ZodNumber
    wakeCreatedAt: z.ZodString
}>
type WakeRowSchema = z.ZodPipe<WakeObjectSchema, z.ZodTransform<WakeRow, z.output<WakeObjectSchema>>>
type DoorInputSchema = StrictObject<{
    wake: WakeRowSchema
    reading: ReadingRowSchema
    trace: TraceRowSchema
    moneyText: z.ZodOptional<z.ZodString>
}>
type RequestDoorInputSchema = StrictObject<{
    wake: WakeRowSchema
    reading: ReadingRowSchema
    trace: TraceRowSchema
    settle: StrictObject<{
        module: z.ZodString
        actorName: z.ZodString
        locale: z.ZodEnum<{ vi: "vi"; en: "en" }>
        installationId: z.ZodNullable<z.ZodString>
    }>
}>
type ActionRowSchema = z.ZodDiscriminatedUnion<
    [
        StrictObject<{
            index: z.ZodNumber
            action: z.ZodString
            outcome: z.ZodLiteral<"requested">
            workItemId: z.ZodString
        }>,
        StrictObject<{
            index: z.ZodNumber
            action: z.ZodString
            outcome: z.ZodLiteral<"dropped">
            reason: z.ZodString
        }>,
    ],
    "outcome"
>
type SettledRowSchema = StrictObject<{
    reply: z.ZodString
    needsHuman: z.ZodBoolean
    reason: z.ZodString
    tasks: z.ZodNumber
    actions: z.ZodArray<ActionRowSchema>
}>
type TagDoorResultSchema = z.ZodDiscriminatedUnion<
    [
        StrictObject<{ split: z.ZodLiteral<true>; fired: z.ZodBoolean }>,
        StrictObject<{ split: z.ZodLiteral<false>; settled: SettledRowSchema }>,
    ],
    "split"
>

/** One contract as a step row keeps it. */
export const contractSchema: ContractSchema = z.strictObject({
    intent: z.string().min(1).max(INTENT_MAX),
    label: z.string().max(LABEL_MAX),
    ownTurn: z.boolean(),
    task: z.string().max(TASK_MAX),
    limits: z.array(z.string().max(LIMIT_MAX)).max(LIMITS_MAX),
    result: z.string().min(1).max(INTENT_MAX),
    owns: z.array(z.string().max(INTENT_MAX)).max(OWNS_MAX),
    checks: z.array(z.string().min(1).max(INTENT_MAX)).max(CHECKS_MAX),
})

/** What a turn settles against, as a step row keeps it. */
export const planRowSchema: PlanRowSchema = z.strictObject({
    versionId: idSchema,
    trigger: triggerSchema,
    trust: trustSchema,
    pinned: z.string().max(INTENT_MAX).nullable(),
    contracts: z.array(contractSchema).max(CONTRACTS_MAX),
})

/** The model's text, the input of the `turn` step and its result. */
export const turnRowSchema: TurnRowSchema = z.strictObject({ text: z.string().max(TURN_TEXT_MAX) })

/** The input of the `read_result` step. */
export const readInputSchema: ReadInputSchema = z.strictObject({
    plan: planRowSchema,
    text: z.string().max(TURN_TEXT_MAX),
})

const gapTextSchema = z.strictObject({
    question: z.string().max(QUESTION_MAX),
    topic: z.string().max(TOPIC_MAX),
})

/** An `IntentReading` as a step row keeps it. */
export const readingRowSchema: ReadingRowSchema = z.discriminatedUnion("kind", [
    z.strictObject({
        kind: z.literal("picked"),
        contract: contractSchema,
        resultText: z.string().max(RESULT_MAX),
        dropped: z.array(z.string().max(INTENT_MAX)).max(DROPPED_MAX),
    }),
    z.strictObject({ kind: z.literal("split"), contract: contractSchema }),
    z.strictObject({
        kind: z.literal("safe"),
        cause: z.enum(["no_intent", "invalid_output", "check_failed"]),
        detail: z.string().max(DETAIL_MAX),
        intent: z.string().max(INTENT_MAX).nullable(),
        gap: gapTextSchema.nullable(),
        draft: z.string().max(DRAFT_MAX),
    }),
])

/** An `IntentTrace` as a step row keeps it. */
export const traceRowSchema: TraceRowSchema = z.strictObject({
    versionId: idSchema,
    trigger: triggerSchema,
    trust: trustSchema,
    offered: z.array(z.string().max(INTENT_MAX)).max(CONTRACTS_MAX),
    intent: z.string().max(INTENT_MAX).nullable(),
    result: z.enum(["picked", "split", "no_intent", "invalid_output", "check_failed"]),
    detail: z.string().max(DETAIL_MAX),
    dropped: z.array(z.string().max(INTENT_MAX)).max(DROPPED_MAX),
})

/** The result of the `read_result` step. */
export const readResultSchema: ReadResultSchema = z.strictObject({ reading: readingRowSchema, trace: traceRowSchema })

/** The wake and turn a door acts for: everything a handler needs to settle from the row alone. */
export const wakeRowSchema: WakeRowSchema = z
    .strictObject({
        inbound: wakeInboundSchema.optional(),
        workspaceId: idSchema,
        agentId: idSchema,
        scopeKey: z.string().max(ID_MAX + NAME_MAX),
        wakeId: idSchema,
        turnId: idSchema,
        source: z.string().min(1).max(ID_MAX).regex(WAKE_SOURCE_KEY),
        eventKey: z.string().max(ID_MAX * 2),
        context: z
            .record(z.string().max(INTENT_MAX), z.union([z.string().max(CONTEXT_VALUE_MAX), z.boolean()]))
            .refine((context) => Object.keys(context).length <= CONTEXT_KEYS_MAX),
        actorMemberId: idSchema.nullable(),
        attempts: z.number().int().min(0).max(COUNT_MAX),
        maxAttempts: z.number().int().min(0).max(COUNT_MAX),
        wakeCreatedAt: z.string().max(TIME_MAX),
    })
    .transform(({ inbound, ...wake }): WakeRow => (inbound === undefined ? wake : { ...wake, inbound }))

/** The input of a door step. */
export const doorInputSchema: DoorInputSchema = z.strictObject({
    wake: wakeRowSchema,
    reading: readingRowSchema,
    trace: traceRowSchema,
    moneyText: z.string().max(MONEY_MAX).optional(),
})

const settleInputSchema = z.strictObject({
    module: z.string().min(1).max(ID_MAX),
    actorName: z.string().max(NAME_MAX),
    locale: z.enum(["vi", "en"]),
    installationId: idSchema.nullable(),
})

/** The input of a request door step: the door input and the settle input it applies the proposal under. */
export const requestDoorInputSchema: RequestDoorInputSchema = z.strictObject({
    wake: wakeRowSchema,
    reading: readingRowSchema,
    trace: traceRowSchema,
    settle: settleInputSchema,
})

const actionRowSchema = z.discriminatedUnion("outcome", [
    z.strictObject({
        index: z.number().int().min(0).max(COUNT_MAX),
        action: z.string().max(ID_MAX),
        outcome: z.literal("requested"),
        workItemId: idSchema,
    }),
    z.strictObject({
        index: z.number().int().min(0).max(COUNT_MAX),
        action: z.string().max(ID_MAX),
        outcome: z.literal("dropped"),
        reason: z.string().max(DETAIL_MAX),
    }),
])

/** What the tag door answers: the proposal as it was applied. */
export const settledRowSchema: SettledRowSchema = z.strictObject({
    reply: z.string().max(REPLY_MAX),
    needsHuman: z.boolean(),
    reason: z.string().max(DETAIL_MAX),
    tasks: z.number().int().min(0).max(COUNT_MAX),
    actions: z.array(actionRowSchema).max(COUNT_MAX),
})

/** What the tag door stores: a split that wrote its follow-up, or the proposal as it was applied. */
export const tagDoorResultSchema: TagDoorResultSchema = z.discriminatedUnion("split", [
    z.strictObject({ split: z.literal(true), fired: z.boolean() }),
    z.strictObject({ split: z.literal(false), settled: settledRowSchema }),
])
