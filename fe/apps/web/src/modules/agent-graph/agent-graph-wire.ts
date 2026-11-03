import { z } from "zod"

/** The four kinds of node the back end draws, each with the step it takes within its kind. */
const kindSchema = z.enum(["trigger", "condition", "execute", "output"])

const groupSchema = z.looseObject({
    roles: z.array(z.string()),
    rooms: z.array(z.string()),
    members: z.array(z.string()),
})

const onTimeoutSchema = z.looseObject({
    kind: z.enum(["backup", "stop", "agent_owner", "unset"]),
    group: groupSchema.optional(),
})

type ApproverSchemaShape = z.ZodObject<
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

const approverSchema: ApproverSchemaShape = z.looseObject({
    group: groupSchema,
    policy: z.enum(["any", "all", "sequential"]),
    timeoutMinutes: z.number(),
    onTimeout: onTimeoutSchema,
})

type SourceSchemaShape = z.ZodObject<
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

const sourceSchema: SourceSchemaShape = z.looseObject({
    kind: z.enum(["brain", "template", "chat", "learned", "owner", "rule"]),
    passage: z.string().optional(),
    quote: z.string().optional(),
    key: z.string().optional(),
    memberId: z.string().optional(),
    version: z.number().optional(),
    action: z.string().optional(),
})

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
        then: z.ZodEnum<{
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
const branchSchema: BranchSchemaShape = z.looseObject({
    key: z.string(),
    when: z.unknown(),
    then: z.enum(["auto", "ask", "stop"]),
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
                                then: z.ZodEnum<{
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

const nodeSchema: NodeSchemaShape = z.looseObject({
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

type DocumentSchemaShape = z.ZodObject<
    {
        nodes: z.ZodArray<
            z.ZodObject<
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
                                            then: z.ZodEnum<{
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
        >
        rights: z.ZodArray<z.ZodUnknown>
    },
    z.core.$loose
>

const documentSchema: DocumentSchemaShape = z.looseObject({ nodes: z.array(nodeSchema), rights: z.array(z.unknown()) })

type CardSchemaShape = z.ZodObject<
    {
        id: z.ZodString
        description: z.ZodString
        tone: z.ZodEnum<{
            success: "success"
            neutral: "neutral"
            accent: "accent"
            warning: "warning"
            danger: "danger"
            muted: "muted"
        }>
        shape: z.ZodEnum<{
            rect: "rect"
            round: "round"
            diamond: "diamond"
            stadium: "stadium"
        }>
        count: z.ZodString
        isPlaceholder: z.ZodBoolean
    },
    z.core.$strip
>

const cardSchema: CardSchemaShape = z.object({
    id: z.string(),
    description: z.string(),
    tone: z.enum(["neutral", "accent", "success", "warning", "danger", "muted"]),
    shape: z.enum(["rect", "round", "diamond", "stadium"]),
    count: z.string(),
    isPlaceholder: z.boolean(),
})

type ProblemSchemaShape = z.ZodObject<
    {
        code: z.ZodString
        nodeKey: z.ZodString
        branchKey: z.ZodNullable<z.ZodString>
        detail: z.ZodString
    },
    z.core.$strip
>

const problemSchema: ProblemSchemaShape = z.object({
    code: z.string(),
    nodeKey: z.string(),
    branchKey: z.string().nullable(),
    detail: z.string(),
})
type GapSchemaShape = z.ZodObject<
    {
        code: z.ZodString
        nodeKey: z.ZodString
        branchKey: z.ZodNullable<z.ZodString>
    },
    z.core.$strip
>

const gapSchema: GapSchemaShape = z.object({ code: z.string(), nodeKey: z.string(), branchKey: z.string().nullable() })

type ProposalSchemaShape = z.ZodObject<
    {
        id: z.ZodString
        kind: z.ZodEnum<{
            learned: "learned"
            conflict: "conflict"
            template_update: "template_update"
        }>
        status: z.ZodEnum<{
            open: "open"
            confirmed: "confirmed"
            declined: "declined"
            superseded: "superseded"
        }>
        nodeKey: z.ZodNullable<z.ZodString>
        branchKey: z.ZodNullable<z.ZodString>
        widens: z.ZodBoolean
        evidence: z.ZodArray<z.ZodString>
        createdAt: z.ZodString
        before: z.ZodOptional<z.ZodNullable<z.ZodString>>
        after: z.ZodOptional<z.ZodNullable<z.ZodString>>
    },
    z.core.$strip
>

const proposalSchema: ProposalSchemaShape = z.object({
    id: z.string(),
    kind: z.enum(["conflict", "learned", "template_update", "gap", "contract"]),
    status: z.enum(["open", "confirmed", "declined", "superseded"]),
    nodeKey: z.string().nullable(),
    branchKey: z.string().nullable(),
    widens: z.boolean(),
    evidence: z.array(z.string()),
    createdAt: z.string(),
    before: z.string().nullable().optional(),
    after: z.string().nullable().optional(),
})

type FactSchemaShape = z.ZodObject<
    {
        key: z.ZodString
        label: z.ZodString
        type: z.ZodEnum<{
            string: "string"
            number: "number"
            boolean: "boolean"
        }>
        unit: z.ZodNullable<
            z.ZodEnum<{
                count: "count"
                vnd: "vnd"
                percent: "percent"
            }>
        >
        allowed: z.ZodArray<z.ZodString>
    },
    z.core.$strip
>

const factSchema: FactSchemaShape = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["number", "string", "boolean"]),
    unit: z.enum(["vnd", "percent", "count"]).nullable(),
    allowed: z.array(z.string()),
})

type TraceSchemaShape = z.ZodArray<
    z.ZodObject<
        {
            key: z.ZodString
            title: z.ZodString
            kind: z.ZodEnum<{
                trigger: "trigger"
                condition: "condition"
                execute: "execute"
                output: "output"
            }>
            step: z.ZodString
            branchKey: z.ZodNullable<z.ZodString>
        },
        z.core.$strip
    >
>

const traceSchema: TraceSchemaShape = z.array(
    z.object({
        key: z.string(),
        title: z.string(),
        kind: kindSchema,
        step: z.string(),
        branchKey: z.string().nullable(),
    }),
)

/** One node a traced run went through. */
export type AgentGraphWireStep = z.infer<typeof traceSchema>[number]

/** Parses the trace of a run; null when the text is not what the contract says. */
export const parseAgentGraphTrace = (text: string): ReadonlyArray<AgentGraphWireStep> | null => {
    try {
        const parsed = traceSchema.safeParse(JSON.parse(text))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

/** The document of a graph as the back end writes it, with every key it adds kept on the way back. */
export type AgentGraphWireDocument = z.infer<typeof documentSchema>
/** One node of the document. */
export type AgentGraphWireNode = z.infer<typeof nodeSchema>
/** One branch of a condition node. */
export type AgentGraphWireBranch = z.infer<typeof branchSchema>
/** Who is asked, for how long, and what happens after. */
export type AgentGraphWireApprover = z.infer<typeof approverSchema>
/** The rule behind a node or a branch. */
export type AgentGraphWireSource = z.infer<typeof sourceSchema>
/** A node as the graph draws it at a glance. */
export type AgentGraphWireCard = z.infer<typeof cardSchema>
/** One thing the checks found wrong. */
export type AgentGraphWireProblem = z.infer<typeof problemSchema>
/** One thing the setup chat still has to ask. */
export type AgentGraphWireGap = z.infer<typeof gapSchema>
/** One proposal waiting for a person. */
export type AgentGraphWireProposal = z.infer<typeof proposalSchema>
/** One fact a condition may be written on. */
export type AgentGraphWireFact = z.infer<typeof factSchema>

/** The six JSON texts of `agentGraph`, as they arrive. */
export interface AgentGraphWireTexts {
    readonly draftJson: string
    readonly cardsJson: string
    readonly gapsJson: string
    readonly problemsJson: string
    readonly proposalsJson: string
    readonly factsJson: string
}

/** The graph after its texts were parsed; the one place the wire is read. */
export interface AgentGraphWire {
    readonly document: AgentGraphWireDocument
    readonly cards: ReadonlyArray<AgentGraphWireCard>
    readonly gaps: ReadonlyArray<AgentGraphWireGap>
    readonly problems: ReadonlyArray<AgentGraphWireProblem>
    readonly proposals: ReadonlyArray<AgentGraphWireProposal>
    readonly facts: ReadonlyArray<AgentGraphWireFact>
}

/** Parses the six texts of the graph with their schemas; null when any of them is not what the contract says. */
export const parseAgentGraphWire = (texts: AgentGraphWireTexts): AgentGraphWire | null => {
    const read = <T extends z.ZodType>(schema: T, text: string): z.infer<T> | null => {
        try {
            const parsed = schema.safeParse(JSON.parse(text))
            return parsed.success ? parsed.data : null
        } catch {
            return null
        }
    }
    const document = read(documentSchema, texts.draftJson)
    const cards = read(z.array(cardSchema), texts.cardsJson)
    const gaps = read(z.array(gapSchema), texts.gapsJson)
    const problems = read(z.array(problemSchema), texts.problemsJson)
    const proposals = read(z.array(proposalSchema), texts.proposalsJson)
    const facts = read(z.array(factSchema), texts.factsJson)
    if (document === null || cards === null || gaps === null || problems === null || proposals === null) return null
    if (facts === null) return null
    return { document, cards, gaps, problems, proposals, facts }
}
