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

const approverSchema = z.looseObject({
    group: groupSchema,
    policy: z.enum(["any", "all", "sequential"]),
    timeoutMinutes: z.number(),
    onTimeout: onTimeoutSchema,
})

const sourceSchema = z.looseObject({
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

/** A condition tree is read as it comes; only the branch editor looks inside it, and it writes a new one. */
const branchSchema = z.looseObject({
    key: z.string(),
    when: z.unknown(),
    then: z.enum(["auto", "ask", "stop"]),
    next: z.string(),
    approver: approverSchema.nullable(),
    sources: z.array(sourceSchema),
    selfCorrected: z.boolean().optional(),
})

const nodeSchema = z.looseObject({
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

const documentSchema = z.looseObject({ nodes: z.array(nodeSchema), rights: z.array(z.unknown()) })

const cardSchema = z.object({
    id: z.string(),
    description: z.string(),
    tone: z.enum(["neutral", "accent", "success", "warning", "danger", "muted"]),
    shape: z.enum(["rect", "round", "diamond", "stadium"]),
    count: z.string(),
    isPlaceholder: z.boolean(),
})

const problemSchema = z.object({
    code: z.string(),
    nodeKey: z.string(),
    branchKey: z.string().nullable(),
    detail: z.string(),
})
const gapSchema = z.object({ code: z.string(), nodeKey: z.string(), branchKey: z.string().nullable() })

const proposalSchema = z.object({
    id: z.string(),
    kind: z.enum(["conflict", "learned", "template_update"]),
    status: z.enum(["open", "confirmed", "declined", "superseded"]),
    nodeKey: z.string().nullable(),
    branchKey: z.string().nullable(),
    widens: z.boolean(),
    evidence: z.array(z.string()),
    createdAt: z.string(),
    before: z.string().nullable().optional(),
    after: z.string().nullable().optional(),
})

const factSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["number", "string", "boolean"]),
    unit: z.enum(["vnd", "percent", "count"]).nullable(),
    allowed: z.array(z.string()),
})

const traceSchema = z.array(
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
