import { z } from "zod"
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

const bilingual = z.object({ vi: z.string(), en: z.string() }).strict()
const bilingualList = z.object({ vi: z.array(z.string()), en: z.array(z.string()) }).strict()
const namespaced = z.templateLiteral([z.string(), ".", z.string()]) as z.ZodType<Namespaced>
const stringList = z.array(z.string())
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
        purpose: z.string(),
        icon: z.string(),
        glyph: z.string(),
        mascot: z.string(),
        category: z.string(),
        status: z.enum(["stable", "early"]),
        audience: z.enum(["customer", "internal"]),
        includedWithWorkspace: z.boolean(),
        available: z.boolean(),
        knowledgeFolder: z.string(),
        settingsExtras: z.string().nullable(),
        requires: z
            .object({
                capabilities: stringList,
                connections: stringList,
                roles: z
                    .object({ requires: z.array(role), uses: z.array(role) })
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
            attributeLabel: z.string(),
            scope: z.enum(["public", "internal", "restricted"]),
        })
        .strict(),
    z.object({ kind: z.literal("rule"), action: z.string(), field: z.enum(["mode", "limit_vnd"]) }).strict(),
])

const right = z
    .object({
        kind: z.string(),
        access: z.enum(["read", "write"]),
        scope: z.enum(["turn", "workspace"]),
        fields: z.tuple([z.string()], z.string()),
    })
    .strict()

const templateSchema = z
    .object({
        agent: z
            .object({
                label: bilingual,
                handle: z.string(),
                summary: bilingual,
                capabilities: bilingualList,
                role: bilingual,
                instructions: bilingual,
            })
            .strict(),
        gates: z.array(
            z
                .object({ key: z.string(), label: bilingual, hint: bilingual, writes: z.array(gateWrite).optional() })
                .strict(),
        ),
        authorityActions: z.array(
            z
                .object({
                    action: z.string(),
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
        ),
        accepts: z.array(
            z
                .object({
                    command: z.string(),
                    action: z.string(),
                    subjectType: z.string(),
                    requiredFields: stringList,
                    description: bilingual,
                })
                .strict(),
        ),
        triggers: z.array(
            z
                .object({
                    key: z.string(),
                    preset: z.enum(["every_15m", "hourly", "daily_at", "weekdays_at"]),
                    atTime: z.string().optional(),
                    probeKey: z.string().optional(),
                })
                .strict(),
        ),
        rights: z.array(right),
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
                properties: z.record(z.string(), memberSchema),
                required: stringList,
                nullable: z.boolean().optional(),
            })
            .strict(),
    ]),
)

const conditionSchema: z.ZodType<OutcomeCondition> = z.lazy(() =>
    z.union([
        z.object({ signal: z.string() }).strict(),
        z.object({ missing: z.string() }).strict(),
        z.object({ check: z.string() }).strict(),
        z.object({ fact: z.object({ subjectType: z.string(), attributeLabel: z.string() }).strict() }).strict(),
        z.object({ all: z.array(conditionSchema) }).strict(),
    ]),
)

const outcomeSchema: z.ZodType<OutcomeSpec> = z.union([
    z.enum(["act", "reask_then_person", "person", "decline"]),
    z.object({ pending: z.string() }).strict(),
])

const outcomeRulesSchema: z.ZodType<OutcomeRulesSpec> = z
    .object({
        rules: z.array(z.object({ when: conditionSchema, then: outcomeSchema }).strict()),
        otherwise: outcomeSchema,
    })
    .strict()

const trusts = z.array(z.enum(["outsider", "member", "manager", "system"]))

const contractsSchema = z
    .object({
        limits: z.record(
            z.string(),
            z.object({ text: specText, member: z.string().optional(), trusts: trusts.optional() }).strict(),
        ),
        members: z.record(z.string(), memberSchema),
        signals: z.array(
            z
                .object({
                    key: z.string(),
                    question: specText,
                    requires: z.object({ intent: z.string(), member: z.string() }).strict().optional(),
                })
                .strict(),
        ),
        effects: z.array(namespaced),
        claims: z.record(
            z.string(),
            z
                .object({
                    requires: namespaced,
                    phrases: z.object({ vi: stringList, en: stringList }).strict(),
                    line: specText.optional(),
                })
                .strict(),
        ),
        outcomes: z.record(z.string(), outcomeRulesSchema),
        intents: z.array(
            z
                .object({
                    intent: z.string(),
                    triggers: stringList,
                    answers: z.boolean(),
                    ownTurn: z.boolean(),
                    task: specText,
                    limits: stringList,
                    result: namespaced,
                    owns: stringList,
                    required: z.array(z.object({ member: z.string(), ask: specText }).strict()),
                    checks: z.array(
                        z
                            .object({
                                id: namespaced,
                                params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
                            })
                            .strict(),
                    ),
                    claims: stringList,
                    outcome: z.string().nullable(),
                    policy: namespaced.nullable(),
                })
                .strict(),
        ),
    })
    .strict()

/**
 * The zod schema of a module document: its structure and types. What needs the installed blocks (the workbenches) or crosses
 * members (actions and commands) is judged by `moduleProblems`.
 */
export const moduleDocumentSchema: z.ZodType<ModuleDocument> = z
    .object({
        schema: z.literal("nivo/module@1"),
        key: z.string(),
        version: z.number(),
        changelog: z.string(),
        breaking: z.boolean(),
        manifest: manifestSchema,
        template: templateSchema,
        contracts: contractsSchema,
        workbenches: z.record(z.string(), specDocumentSchema),
    })
    .strict()
