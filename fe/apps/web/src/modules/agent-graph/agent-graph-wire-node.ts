import { z } from "zod"
import { approverSchema, sourceSchema } from "./agent-graph-wire-approval"

type KindSchemaShape = z.ZodEnum<{
    trigger: "trigger"
    condition: "condition"
    execute: "execute"
    output: "output"
}>

/** The four kinds of node the back end draws, each with the step it takes within its kind. */
export const kindSchema: KindSchemaShape = z.enum(["trigger", "condition", "execute", "output"])

const lineSchema = z.looseObject({ label: z.string(), ref: z.string().optional() })
const useSchema = z.looseObject({
    label: z.string(),
    tool: z.string().nullable().optional(),
    scope: z.enum(["read", "write"]),
})
const dataSchema = z.looseObject({ label: z.string(), place: z.string() })

type BranchSchemaShape = z.ZodObject<
    {
        key: z.ZodString
        when: z.ZodUnknown
        mode: z.ZodEnum<{
            stop: "stop"
            auto: "auto"
            ask: "ask"
        }>
        next: z.ZodString
        approver: z.ZodNullable<
            z.ZodObject<
                {
                    group: z.ZodObject<
                        {
                            roles: z.ZodArray<z.ZodString>
                            rooms: z.ZodArray<z.ZodString>
                            members: z.ZodArray<z.ZodString>
                        },
                        z.core.$loose
                    >
                    policy: z.ZodEnum<{
                        any: "any"
                        all: "all"
                        sequential: "sequential"
                    }>
                    timeoutMinutes: z.ZodNumber
                    onTimeout: z.ZodObject<
                        {
                            kind: z.ZodEnum<{
                                backup: "backup"
                                stop: "stop"
                                agent_owner: "agent_owner"
                                unset: "unset"
                            }>
                            group: z.ZodOptional<
                                z.ZodObject<
                                    {
                                        roles: z.ZodArray<z.ZodString>
                                        rooms: z.ZodArray<z.ZodString>
                                        members: z.ZodArray<z.ZodString>
                                    },
                                    z.core.$loose
                                >
                            >
                        },
                        z.core.$loose
                    >
                },
                z.core.$loose
            >
        >
        sources: z.ZodArray<
            z.ZodObject<
                {
                    kind: z.ZodEnum<{
                        brain: "brain"
                        template: "template"
                        chat: "chat"
                        learned: "learned"
                        owner: "owner"
                        rule: "rule"
                    }>
                    passage: z.ZodOptional<z.ZodString>
                    quote: z.ZodOptional<z.ZodString>
                    key: z.ZodOptional<z.ZodString>
                    memberId: z.ZodOptional<z.ZodString>
                    version: z.ZodOptional<z.ZodNumber>
                    action: z.ZodOptional<z.ZodString>
                },
                z.core.$loose
            >
        >
        selfCorrected: z.ZodOptional<z.ZodBoolean>
    },
    z.core.$loose
>

/** A condition tree is read as it comes; only the branch editor looks inside it, and it writes a new one. */
export const branchSchema: BranchSchemaShape = z.looseObject({
    key: z.string(),
    when: z.unknown(),
    mode: z.enum(["auto", "ask", "stop"]),
    next: z.string(),
    approver: approverSchema.nullable(),
    sources: z.array(sourceSchema),
    selfCorrected: z.boolean().optional(),
})

type NodeSchemaShape = z.ZodObject<
    {
        key: z.ZodString
        kind: z.ZodEnum<{
            trigger: "trigger"
            condition: "condition"
            execute: "execute"
            output: "output"
        }>
        step: z.ZodString
        title: z.ZodString
        doneBy: z.ZodEnum<{
            agent: "agent"
            nivo: "nivo"
            person: "person"
        }>
        knows: z.ZodArray<
            z.ZodObject<
                {
                    label: z.ZodString
                    ref: z.ZodOptional<z.ZodString>
                },
                z.core.$loose
            >
        >
        does: z.ZodString
        uses: z.ZodArray<
            z.ZodObject<
                {
                    label: z.ZodString
                    tool: z.ZodOptional<z.ZodNullable<z.ZodString>>
                    scope: z.ZodEnum<{
                        read: "read"
                        write: "write"
                    }>
                },
                z.core.$loose
            >
        >
        reads: z.ZodArray<
            z.ZodObject<
                {
                    label: z.ZodString
                    place: z.ZodString
                },
                z.core.$loose
            >
        >
        writes: z.ZodArray<
            z.ZodObject<
                {
                    label: z.ZodString
                    place: z.ZodString
                },
                z.core.$loose
            >
        >
        approver: z.ZodNullable<
            z.ZodObject<
                {
                    group: z.ZodObject<
                        {
                            roles: z.ZodArray<z.ZodString>
                            rooms: z.ZodArray<z.ZodString>
                            members: z.ZodArray<z.ZodString>
                        },
                        z.core.$loose
                    >
                    policy: z.ZodEnum<{
                        any: "any"
                        all: "all"
                        sequential: "sequential"
                    }>
                    timeoutMinutes: z.ZodNumber
                    onTimeout: z.ZodObject<
                        {
                            kind: z.ZodEnum<{
                                backup: "backup"
                                stop: "stop"
                                agent_owner: "agent_owner"
                                unset: "unset"
                            }>
                            group: z.ZodOptional<
                                z.ZodObject<
                                    {
                                        roles: z.ZodArray<z.ZodString>
                                        rooms: z.ZodArray<z.ZodString>
                                        members: z.ZodArray<z.ZodString>
                                    },
                                    z.core.$loose
                                >
                            >
                        },
                        z.core.$loose
                    >
                },
                z.core.$loose
            >
        >
        sources: z.ZodArray<
            z.ZodObject<
                {
                    kind: z.ZodEnum<{
                        brain: "brain"
                        template: "template"
                        chat: "chat"
                        learned: "learned"
                        owner: "owner"
                        rule: "rule"
                    }>
                    passage: z.ZodOptional<z.ZodString>
                    quote: z.ZodOptional<z.ZodString>
                    key: z.ZodOptional<z.ZodString>
                    memberId: z.ZodOptional<z.ZodString>
                    version: z.ZodOptional<z.ZodNumber>
                    action: z.ZodOptional<z.ZodString>
                },
                z.core.$loose
            >
        >
        next: z.ZodArray<z.ZodString>
        decide: z.ZodOptional<
            z.ZodObject<
                {
                    intent: z.ZodString
                    facts: z.ZodArray<z.ZodString>
                    branches: z.ZodArray<
                        z.ZodObject<
                            {
                                key: z.ZodString
                                when: z.ZodUnknown
                                mode: z.ZodEnum<{
                                    stop: "stop"
                                    auto: "auto"
                                    ask: "ask"
                                }>
                                next: z.ZodString
                                approver: z.ZodNullable<
                                    z.ZodObject<
                                        {
                                            group: z.ZodObject<
                                                {
                                                    roles: z.ZodArray<z.ZodString>
                                                    rooms: z.ZodArray<z.ZodString>
                                                    members: z.ZodArray<z.ZodString>
                                                },
                                                z.core.$loose
                                            >
                                            policy: z.ZodEnum<{
                                                any: "any"
                                                all: "all"
                                                sequential: "sequential"
                                            }>
                                            timeoutMinutes: z.ZodNumber
                                            onTimeout: z.ZodObject<
                                                {
                                                    kind: z.ZodEnum<{
                                                        backup: "backup"
                                                        stop: "stop"
                                                        agent_owner: "agent_owner"
                                                        unset: "unset"
                                                    }>
                                                    group: z.ZodOptional<
                                                        z.ZodObject<
                                                            {
                                                                roles: z.ZodArray<z.ZodString>
                                                                rooms: z.ZodArray<z.ZodString>
                                                                members: z.ZodArray<z.ZodString>
                                                            },
                                                            z.core.$loose
                                                        >
                                                    >
                                                },
                                                z.core.$loose
                                            >
                                        },
                                        z.core.$loose
                                    >
                                >
                                sources: z.ZodArray<
                                    z.ZodObject<
                                        {
                                            kind: z.ZodEnum<{
                                                brain: "brain"
                                                template: "template"
                                                chat: "chat"
                                                learned: "learned"
                                                owner: "owner"
                                                rule: "rule"
                                            }>
                                            passage: z.ZodOptional<z.ZodString>
                                            quote: z.ZodOptional<z.ZodString>
                                            key: z.ZodOptional<z.ZodString>
                                            memberId: z.ZodOptional<z.ZodString>
                                            version: z.ZodOptional<z.ZodNumber>
                                            action: z.ZodOptional<z.ZodString>
                                        },
                                        z.core.$loose
                                    >
                                >
                                selfCorrected: z.ZodOptional<z.ZodBoolean>
                            },
                            z.core.$loose
                        >
                    >
                },
                z.core.$loose
            >
        >
    },
    z.core.$loose
>

/** One node of the document, with what it knows, does, uses and asks. */
export const nodeSchema: NodeSchemaShape = z.looseObject({
    key: z.string(),
    kind: kindSchema,
    step: z.string(),
    title: z.string(),
    doneBy: z.enum(["agent", "nivo", "person"]),
    knows: z.array(lineSchema),
    does: z.string(),
    uses: z.array(useSchema),
    reads: z.array(dataSchema),
    writes: z.array(dataSchema),
    approver: approverSchema.nullable(),
    sources: z.array(sourceSchema),
    next: z.array(z.string()),
    decide: z
        .looseObject({ intent: z.string(), facts: z.array(z.string()), branches: z.array(branchSchema) })
        .optional(),
})
