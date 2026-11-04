import { z } from "zod"
import { body, ident, prose } from "../schema/bounded.schema"
import { entriesAtMost } from "../schema/entries"
import { specText } from "../schema/spec-text.schema"
import type { Namespaced } from "../schema/schema.types"
import { specDocumentSchema } from "../spec/spec.schema"
import type {
    MemberSpec,
    ModuleDocument,
    OutcomeCondition,
    OutcomeRulesSpec,
    OutcomeSpec,
} from "./module-document.types"

const bilingual = z.object({ vi: prose, en: prose }).strict()
const longBilingual = z.object({ vi: body, en: body }).strict()
const bilingualList = z.object({ vi: z.array(prose).max(50), en: z.array(prose).max(50) }).strict()
const namespaced: z.ZodType<Namespaced> = z.templateLiteral([ident, ".", ident])
const stringList = z.array(ident).max(100)
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
        purpose: prose,
        icon: ident,
        glyph: ident,
        mascot: ident,
        category: ident,
        status: z.enum(["stable", "early"]),
        audience: z.enum(["customer", "internal"]),
        includedWithWorkspace: z.boolean(),
        available: z.boolean(),
        knowledgeFolder: ident,
        settingsExtras: ident.nullable(),
        requires: z
            .object({
                capabilities: stringList,
                connections: stringList,
                roles: z
                    .object({ requires: z.array(role).max(20), uses: z.array(role).max(20) })
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
            attributeLabel: ident,
            scope: z.enum(["public", "internal", "restricted"]),
        })
        .strict(),
    z.object({ kind: z.literal("rule"), action: ident, field: z.enum(["mode", "limit_vnd"]) }).strict(),
])

const right = z
    .object({
        kind: ident,
        access: z.enum(["read", "write"]),
        scope: z.enum(["turn", "workspace"]),
        fields: z.tuple([ident], ident),
    })
    .strict()

const templateSchema = z
    .object({
        agent: z
            .object({
                label: bilingual,
                handle: ident,
                summary: bilingual,
                capabilities: bilingualList,
                role: bilingual,
                instructions: longBilingual,
            })
            .strict(),
        gates: z
            .array(
                z
                    .object({
                        key: ident,
                        label: bilingual,
                        hint: bilingual,
                        writes: z.array(gateWrite).max(50).optional(),
                    })
                    .strict(),
            )
            .max(100),
        authorityActions: z
            .array(
                z
                    .object({
                        action: ident,
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
            .max(100),
        accepts: z
            .array(
                z
                    .object({
                        command: ident,
                        action: ident,
                        subjectType: ident,
                        requiredFields: stringList,
                        description: bilingual,
                    })
                    .strict(),
            )
            .max(100),
        triggers: z
            .array(
                z
                    .object({
                        key: ident,
                        preset: z.enum(["every_15m", "hourly", "daily_at", "weekdays_at"]),
                        atTime: ident.optional(),
                        probeKey: ident.optional(),
                    })
                    .strict(),
            )
            .max(100),
        rights: z.array(right).max(100),
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
                properties: z.record(ident, memberSchema).refine(entriesAtMost(100)),
                required: stringList,
                nullable: z.boolean().optional(),
            })
            .strict(),
    ]),
)

const conditionSchema: z.ZodType<OutcomeCondition> = z.lazy(() =>
    z.union([
        z.object({ signal: ident }).strict(),
        z.object({ missing: ident }).strict(),
        z.object({ check: ident }).strict(),
        z.object({ fact: z.object({ subjectType: ident, attributeLabel: ident }).strict() }).strict(),
        z.object({ all: z.array(conditionSchema).max(100) }).strict(),
    ]),
)

const outcomeSchema: z.ZodType<OutcomeSpec> = z.union([
    z.enum(["act", "reask_then_person", "person", "decline"]),
    z.object({ pending: ident }).strict(),
])

const outcomeRulesSchema: z.ZodType<OutcomeRulesSpec> = z
    .object({
        rules: z.array(z.object({ when: conditionSchema, then: outcomeSchema }).strict()).max(100),
        otherwise: outcomeSchema,
    })
    .strict()

const trusts = z.array(z.enum(["outsider", "member", "manager", "system"])).max(100)

const contractsSchema = z
    .object({
        limits: z
            .record(ident, z.object({ text: specText, member: ident.optional(), trusts: trusts.optional() }).strict())
            .refine(entriesAtMost(100)),
        members: z.record(ident, memberSchema).refine(entriesAtMost(100)),
        signals: z
            .array(
                z
                    .object({
                        key: ident,
                        question: specText,
                        requires: z.object({ intent: ident, member: ident }).strict().optional(),
                    })
                    .strict(),
            )
            .max(100),
        effects: z.array(namespaced).max(100),
        claims: z
            .record(
                ident,
                z
                    .object({
                        requires: namespaced,
                        phrases: z.object({ vi: stringList, en: stringList }).strict(),
                        line: specText.optional(),
                    })
                    .strict(),
            )
            .refine(entriesAtMost(100)),
        outcomes: z.record(ident, outcomeRulesSchema).refine(entriesAtMost(100)),
        intents: z
            .array(
                z
                    .object({
                        intent: ident,
                        triggers: stringList,
                        answers: z.boolean(),
                        ownTurn: z.boolean(),
                        task: specText,
                        limits: stringList,
                        result: namespaced,
                        owns: stringList,
                        required: z.array(z.object({ member: ident, ask: specText }).strict()).max(100),
                        checks: z
                            .array(
                                z
                                    .object({
                                        id: namespaced,
                                        params: z
                                            .record(ident, z.union([ident, z.number(), z.boolean()]))
                                            .refine(entriesAtMost(50))
                                            .optional(),
                                    })
                                    .strict(),
                            )
                            .max(100),
                        claims: stringList,
                        outcome: ident.nullable(),
                        policy: namespaced.nullable(),
                    })
                    .strict(),
            )
            .max(100),
    })
    .strict()

/**
 * The zod schema of a module document: its structure and types. What needs the installed blocks (the workbenches) or crosses
 * members (actions and commands) is judged by `moduleProblems`.
 */
export const moduleDocumentSchema: z.ZodType<ModuleDocument> = z
    .object({
        schema: z.literal("nivo/module@1"),
        key: ident,
        version: z.number(),
        changelog: body,
        breaking: z.boolean(),
        manifest: manifestSchema,
        template: templateSchema,
        contracts: contractsSchema,
        workbenches: z.record(ident, specDocumentSchema).refine(entriesAtMost(50)),
    })
    .strict()
