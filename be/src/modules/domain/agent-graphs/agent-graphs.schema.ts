import { z } from "zod"
import {
    MAX_CONDITION_TERMS,
    MAX_DOES_LENGTH,
    MAX_GRAPH_NODES,
    MAX_TITLE_LENGTH,
} from "./agent-graphs.contracts"
import type { Condition, GraphDocument } from "./agent-graphs.contracts"

const factValueSchema = z.union([z.string().max(200), z.number(), z.boolean()])

const termSchema = z.union([
    z.object({ fact: z.string().min(1).max(100), op: z.enum(["lt", "lte", "gt", "gte", "eq", "neq"]), value: factValueSchema }).strict(),
    z.object({ fact: z.string().min(1).max(100), op: z.literal("in"), value: z.array(z.string().max(100)).min(1).max(30) }).strict(),
    z.object({ fact: z.string().min(1).max(100), op: z.literal("known") }).strict(),
])

/** The closed condition tree; a group nests at most twice and holds at most six terms in all. */
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
    z.union([
        termSchema,
        z.object({ all: z.array(conditionSchema).min(1).max(MAX_CONDITION_TERMS) }).strict(),
        z.object({ any: z.array(conditionSchema).min(1).max(MAX_CONDITION_TERMS) }).strict(),
    ]),
)

const groupSchema = z
    .object({
        roles: z.array(z.enum(["owner", "manager", "staff"])).max(5),
        rooms: z.array(z.string().max(60)).max(30),
        members: z.array(z.string().max(60)).max(30),
    })
    .strict()

const timeoutSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("backup"), group: groupSchema }).strict(),
    z.object({ kind: z.literal("stop") }).strict(),
    z.object({ kind: z.literal("agent_owner") }).strict(),
    z.object({ kind: z.literal("unset") }).strict(),
])

const approverSchema = z
    .object({
        group: groupSchema,
        policy: z.enum(["any", "all", "sequential"]),
        timeoutMinutes: z.number().int().min(1).max(10_080),
        onTimeout: timeoutSchema,
    })
    .strict()

const sourceSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("brain"), factId: z.string().max(200), passage: z.string().max(2000), valueHash: z.string().max(200) }).strict(),
    z.object({ kind: z.literal("template"), key: z.string().max(200), version: z.number().int() }).strict(),
    z.object({ kind: z.literal("chat"), messageId: z.string().max(200), quote: z.string().max(500) }).strict(),
    z.object({ kind: z.literal("learned"), proposalId: z.string().max(200) }).strict(),
    z.object({ kind: z.literal("owner"), memberId: z.string().max(200) }).strict(),
    z.object({ kind: z.literal("rule"), action: z.string().max(200) }).strict(),
])

const branchSchema = z
    .object({
        key: z.string().min(1).max(60),
        when: z.union([conditionSchema, z.literal("else")]),
        then: z.enum(["auto", "ask", "stop"]),
        next: z.string().min(1).max(60),
        approver: approverSchema.nullable(),
        sources: z.array(sourceSchema).max(10),
        selfCorrected: z.boolean().optional(),
    })
    .strict()

const nodeSchema = z
    .object({
        key: z.string().min(1).max(60),
        kind: z.enum(["trigger", "condition", "execute", "output"]),
        step: z.enum([
            "customer_message",
            "tag",
            "event",
            "schedule",
            "read_context",
            "evaluate",
            "call",
            "reply",
            "approval",
            "write",
            "stop",
        ]),
        title: z.string().max(MAX_TITLE_LENGTH),
        doneBy: z.enum(["agent", "nivo", "person"]),
        knows: z
            .array(
                z.object({
                    kind: z.enum(["brain_fact", "brain_passage", "dossier", "lesson", "record"]),
                    ref: z.string().max(200),
                    label: z.string().max(200),
                }),
            )
            .max(30),
        does: z.string().max(MAX_DOES_LENGTH),
        uses: z
            .array(
                z.object({
                    provider: z.enum(["brain", "drive", "sepay", "zalo", "telegram", "office", "mcp"]),
                    tool: z.string().max(200).nullable(),
                    scope: z.enum(["read", "write"]),
                    label: z.string().max(200),
                    placeholder: z.boolean().optional(),
                }),
            )
            .max(30),
        reads: z.array(z.object({ fact: z.string().max(200), label: z.string().max(200), place: z.string().max(200) })).max(30),
        writes: z.array(z.object({ fact: z.string().max(200), label: z.string().max(200), place: z.string().max(200) })).max(30),
        approver: approverSchema.nullable(),
        sources: z.array(sourceSchema).max(10),
        none: z.array(z.enum(["knows", "uses", "reads", "writes", "sources"])).max(5),
        next: z.array(z.string().max(60)).max(20),
        decide: z
            .object({
                intent: z.string().min(1).max(100),
                facts: z.array(z.string().max(100)).max(10),
                branches: z.array(branchSchema).min(1).max(12),
            })
            .strict()
            .optional(),
        action: z.string().max(100).optional(),
        pipeline: z.string().max(100).optional(),
    })
    .strict()

const rightSchema = z
    .object({
        kind: z.enum(["brain", "customers", "documents", "payments", "channels", "invoices"]),
        scope: z.enum(["conversation", "workspace"]),
        hide: z.array(z.string().max(60)).max(40),
        mask: z.array(z.string().max(60)).max(40),
    })
    .strict()

/** The graph of one agent, validated at every write and every read: nothing else parses. */
export const graphDocumentSchema: z.ZodType<GraphDocument> = z
    .object({ nodes: z.array(nodeSchema).max(MAX_GRAPH_NODES * 2), rights: z.array(rightSchema).max(10) })
    .strict()
