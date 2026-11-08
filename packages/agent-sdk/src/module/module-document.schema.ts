import { z } from "zod"
import { INSTRUCTIONS_MAX, KEY_MAX, LABEL_MAX, LIST_MAX, RECORD_MAX, TEXT_MAX } from "../schema/bounds"
import { isNamespaced } from "../schema/namespaced"
import { specText } from "../schema/spec-text.schema"
import { specDocumentSchema } from "../spec/spec.schema"
import type {
    MemberSpec,
    ModuleDocument,
    OutcomeCondition,
    OutcomeRulesSpec,
    OutcomeSpec,
} from "./module-document.types"

const key = z.string().max(KEY_MAX)
const label = z.string().max(LABEL_MAX)
const text = z.string().max(TEXT_MAX)
const bilingual = z.object({ vi: text, en: text }).strict()
const bilingualList = z.object({ vi: z.array(text).max(LIST_MAX), en: z.array(text).max(LIST_MAX) }).strict()
const namespaced = z.string().max(KEY_MAX).refine(isNamespaced)
const stringList = z.array(key).max(LIST_MAX)
const role = z.enum([
    "identity.find",
    "identity.upsert",
    "receivable.find",
    "receivable.recordPayment",
    "payment.credits.list",
    "payment.debits.list",
    "invoice.list",
])

const manifestSchema = z
    .object({
        order: z.number().int(),
        name: bilingual,
        shortName: bilingual,
        description: bilingual,
        points: bilingualList,
        purpose: text,
        icon: key,
        glyph: key,
        mascot: key,
        category: key,
        status: z.enum(["stable", "early"]),
        audience: z.enum(["customer", "internal"]),
        includedWithWorkspace: z.boolean(),
        available: z.boolean(),
        knowledgeFolder: key,
        settingsExtras: key.nullable(),
        requires: z
            .object({
                capabilities: stringList,
                connections: stringList,
                roles: z
                    .object({ requires: z.array(role).max(LIST_MAX), uses: z.array(role).max(LIST_MAX) })
                    .strict()
                    .optional(),
            })
            .strict(),
        connectionProviders: stringList,
        defaultOperatingMode: z.enum(["assist", "autopilot"]),
        multiInstance: z.boolean(),
    })
    .strict()

const gateWrite = z.union([
    z
        .object({
            kind: z.literal("fact"),
            subjectType: z.enum([
                "business",
                "product",
                "service",
                "policy",
                "customer",
                "person",
                "supplier",
                "place",
                "other",
            ]),
            attributeLabel: label,
            scope: z.enum(["public", "internal", "restricted"]),
        })
        .strict(),
    z.object({ kind: z.literal("rule"), action: key, field: z.enum(["mode", "limit_vnd"]) }).strict(),
])

const right = z
    .object({
        kind: key,
        access: z.enum(["read", "write"]),
        scope: z.enum(["turn", "workspace"]),
        fields: z.tuple([key], key),
    })
    .strict()

const templateSchema = z
    .object({
        agent: z
            .object({
                label: bilingual,
                handle: key,
                summary: bilingual,
                capabilities: bilingualList,
                role: bilingual,
                instructions: z
                    .object({ vi: z.string().max(INSTRUCTIONS_MAX), en: z.string().max(INSTRUCTIONS_MAX) })
                    .strict(),
            })
            .strict(),
        gates: z
            .array(
                z
                    .object({
                        key,
                        label: bilingual,
                        hint: bilingual,
                        writes: z.array(gateWrite).max(LIST_MAX).optional(),
                    })
                    .strict(),
            )
            .max(LIST_MAX),
        authorityActions: z
            .array(
                z
                    .object({
                        action: key,
                        label: bilingual,
                        mode: z.enum(["auto", "ask", "never"]),
                        limitVnd: z.number().nullable(),
                        requiredFields: stringList,
                        amountLimit: z.boolean(),
                        graphFacts: stringList.optional(),
                        maxMode: z.enum(["ask", "never"]).nullable(),
                        note: bilingual,
                        next: stringList,
                    })
                    .strict(),
            )
            .max(LIST_MAX),
        accepts: z
            .array(
                z
                    .object({
                        command: key,
                        action: key,
                        subjectType: key,
                        requiredFields: stringList,
                        description: bilingual,
                    })
                    .strict(),
            )
            .max(LIST_MAX),
        triggers: z
            .array(
                z
                    .object({
                        key,
                        preset: z.enum(["every_15m", "hourly", "daily_at", "weekdays_at"]),
                        atTime: key.optional(),
                        probeKey: key.optional(),
                    })
                    .strict(),
            )
            .max(LIST_MAX),
        rights: z.array(right).max(LIST_MAX),
    })
    .strict()

const memberSchema: z.ZodType<MemberSpec> = z.lazy(() =>
    z.union([
        z
            .object({
                type: z.literal("string"),
                maxLength: z.number().int(),
                enum: stringList.optional(),
                nullable: z.boolean().optional(),
            })
            .strict(),
        z
            .object({
                type: z.enum(["integer", "number"]),
                minimum: z.number(),
                maximum: z.number(),
                nullable: z.boolean().optional(),
            })
            .strict(),
        z.object({ type: z.literal("boolean") }).strict(),
        z
            .object({
                type: z.literal("array"),
                items: memberSchema,
                minItems: z.number().int().optional(),
                maxItems: z.number().int(),
            })
            .strict(),
        z
            .object({
                type: z.literal("object"),
                properties: z.record(key, memberSchema).refine((entries) => Object.keys(entries).length <= RECORD_MAX),
                required: stringList,
                nullable: z.boolean().optional(),
            })
            .strict(),
    ]),
)

const conditionSchema: z.ZodType<OutcomeCondition> = z.lazy(() =>
    z.union([
        z.object({ signal: key }).strict(),
        z.object({ missing: key }).strict(),
        z.object({ check: key }).strict(),
        z.object({ fact: z.object({ subjectType: key, attributeLabel: label }).strict() }).strict(),
        z.object({ all: z.array(conditionSchema).max(LIST_MAX) }).strict(),
    ]),
)

const outcomeSchema: z.ZodType<OutcomeSpec> = z.union([
    z.enum(["act", "reask_then_person", "person", "decline"]),
    z.object({ pending: key }).strict(),
])

const outcomeRulesSchema: z.ZodType<OutcomeRulesSpec> = z
    .object({
        rules: z.array(z.object({ when: conditionSchema, outcome: outcomeSchema }).strict()).max(LIST_MAX),
        otherwise: outcomeSchema,
    })
    .strict()

const trusts = z.array(z.enum(["outsider", "member", "manager", "system"])).max(4)

const contractsSchema = z
    .object({
        limits: z
            .record(key, z.object({ text: specText, member: key.optional(), trusts: trusts.optional() }).strict())
            .refine((entries) => Object.keys(entries).length <= RECORD_MAX),
        members: z.record(key, memberSchema).refine((entries) => Object.keys(entries).length <= RECORD_MAX),
        signals: z
            .array(
                z
                    .object({
                        key,
                        question: specText,
                        requires: z.object({ intent: key, member: key }).strict().optional(),
                    })
                    .strict(),
            )
            .max(LIST_MAX),
        effects: z.array(namespaced).max(LIST_MAX),
        claims: z
            .record(
                key,
                z
                    .object({
                        requires: namespaced,
                        phrases: z.object({ vi: stringList, en: stringList }).strict(),
                        line: specText.optional(),
                    })
                    .strict(),
            )
            .refine((entries) => Object.keys(entries).length <= RECORD_MAX),
        outcomes: z.record(key, outcomeRulesSchema).refine((entries) => Object.keys(entries).length <= RECORD_MAX),
        intents: z
            .array(
                z
                    .object({
                        intent: key,
                        triggers: stringList,
                        answers: z.boolean(),
                        ownTurn: z.boolean(),
                        task: specText,
                        limits: stringList,
                        result: namespaced,
                        owns: stringList,
                        required: z.array(z.object({ member: key, ask: specText }).strict()).max(LIST_MAX),
                        checks: z
                            .array(
                                z
                                    .object({
                                        id: namespaced,
                                        params: z
                                            .record(key, z.union([text, z.number(), z.boolean()]))
                                            .refine((entries) => Object.keys(entries).length <= RECORD_MAX)
                                            .optional(),
                                    })
                                    .strict(),
                            )
                            .max(LIST_MAX),
                        claims: stringList,
                        outcome: key.nullable(),
                        policy: namespaced.nullable(),
                    })
                    .strict(),
            )
            .max(LIST_MAX),
    })
    .strict()

/**
 * The zod schema of a module document: its structure and types. What needs the installed blocks (the workbenches) or crosses
 * members (actions and commands) is judged by `moduleProblems`.
 */
export const moduleDocumentSchema: z.ZodType<ModuleDocument> = z
    .object({
        schema: z.literal("nivo/module@1"),
        key,
        version: z.number(),
        changelog: text,
        breaking: z.boolean(),
        manifest: manifestSchema,
        template: templateSchema,
        contracts: contractsSchema,
        workbenches: z.record(key, specDocumentSchema).refine((entries) => Object.keys(entries).length <= RECORD_MAX),
    })
    .strict()
