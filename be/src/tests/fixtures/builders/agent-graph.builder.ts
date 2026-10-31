import { builder } from "@starci/jest-preset"
import { agentGraphsEntities } from "@modules/domain/agent-graphs"
/** The people a request can go to. */
interface Group {
    readonly roles: ReadonlyArray<"owner" | "manager" | "staff">
    readonly rooms: ReadonlyArray<string>
    readonly members: ReadonlyArray<string>
}
/** What happens when nobody answers in time. */
type Timeout = { readonly kind: "backup"; readonly group: Group } | { readonly kind: "agent_owner" | "stop" | "unset" }
/** Who is asked, how and for how long. */
interface Approver {
    readonly group: Group
    readonly policy: "any" | "all" | "sequential"
    readonly timeoutMinutes: number
    readonly onTimeout: Timeout
}
/** A closed condition tree, as far as the specs build one. */
type Term =
    | { readonly all: ReadonlyArray<Term> }
    | { readonly any: ReadonlyArray<Term> }
    | {
          readonly fact: string
          readonly op: "lt" | "lte" | "gt" | "gte" | "eq" | "neq"
          readonly value: number | string | boolean
      }
    | { readonly fact: string; readonly op: "in"; readonly value: ReadonlyArray<string> }
    | { readonly fact: string; readonly op: "known" }
/** One branch of a decide point. */
interface Branch {
    readonly key: string
    readonly when: Term | "else"
    readonly then: "auto" | "ask" | "stop"
    readonly next: string
    readonly approver: Approver | null
    readonly sources: ReadonlyArray<
        | { readonly kind: "brain"; readonly factId: string; readonly passage: string; readonly valueHash: string }
        | { readonly kind: "template"; readonly key: string; readonly version: number }
        | { readonly kind: "chat"; readonly messageId: string; readonly quote: string }
        | { readonly kind: "learned"; readonly proposalId: string }
        | { readonly kind: "owner"; readonly memberId: string }
        | { readonly kind: "rule"; readonly action: string }
    >
    readonly selfCorrected?: boolean | undefined
}
/** One node of a graph, as the owner reads it. */
interface Node {
    readonly key: string
    readonly kind: "trigger" | "condition" | "execute" | "output"
    readonly step:
        | "customer_message"
        | "tag"
        | "event"
        | "schedule"
        | "read_context"
        | "evaluate"
        | "call"
        | "reply"
        | "approval"
        | "write"
        | "stop"
    readonly title: string
    readonly doneBy: "agent" | "nivo" | "person"
    readonly knows: ReadonlyArray<{
        readonly kind: "brain_fact" | "brain_passage" | "dossier" | "lesson" | "record"
        readonly ref: string
        readonly label: string
    }>
    readonly does: string
    readonly uses: ReadonlyArray<{
        readonly provider: "brain" | "drive" | "sepay" | "zalo" | "telegram" | "office" | "mcp"
        readonly tool: string | null
        readonly scope: "read" | "write"
        readonly label: string
        readonly placeholder?: boolean | undefined
    }>
    readonly reads: ReadonlyArray<{ readonly fact: string; readonly label: string; readonly place: string }>
    readonly writes: ReadonlyArray<{ readonly fact: string; readonly label: string; readonly place: string }>
    readonly approver: Approver | null
    readonly sources: Branch["sources"]
    readonly none: ReadonlyArray<"knows" | "uses" | "reads" | "writes" | "sources">
    readonly next: ReadonlyArray<string>
    readonly decide?:
        | { readonly intent: string; readonly facts: ReadonlyArray<string>; readonly branches: ReadonlyArray<Branch> }
        | undefined
    readonly action?: string | undefined
    readonly pipeline?: string | undefined
}
/** The whole graph of one agent. */
interface GraphDocument {
    readonly nodes: ReadonlyArray<Node>
    readonly rights: ReadonlyArray<{
        readonly kind: "brain" | "customers" | "documents" | "payments" | "channels" | "invoices"
        readonly scope: "conversation" | "workspace"
        readonly hide: ReadonlyArray<string>
        readonly mask: ReadonlyArray<string>
    }>
}
type GraphMode = "shadow" | "enforced"

const [GraphEntity, VersionEntity, , ProposalEntity, DecisionEntity] = agentGraphsEntities

/** The fact the specs of the action graph decide on: the amount of a supplier payment, counted in dong. */
export const AMOUNT_FACT = "supplier_payment.amount_vnd"

/** The registry of the specs: the amount, a supplier kind with allowed values, and a flag. */
export const FACTS = {
    [AMOUNT_FACT]: { key: AMOUNT_FACT, type: "number", unit: "vnd", labelKey: "fact.amount" },
    "supplier_payment.kind": {
        key: "supplier_payment.kind",
        type: "string",
        unit: null,
        allowed: ["rent", "stock"],
        labelKey: "fact.kind",
    },
    "supplier_payment.urgent": { key: "supplier_payment.urgent", type: "boolean", unit: null, labelKey: "fact.urgent" },
} as const

/** A catalog lookup that answers the key with its parameters, so a spec reads which sentence a policy asked for. */
export const say = (key: string, params?: Readonly<Record<string, string | number>>): string =>
    key === "agentGraphs.unit.million" ? "tr" : `${key}${params === undefined ? "" : JSON.stringify(params)}`

/** The approver of a branch: a manager group, asked as a group, with a day to answer and the owner of the agent after. */
export const approverOf = builder<Approver>({
    group: { roles: ["manager"], rooms: [], members: ["dinh"] },
    policy: "any",
    timeoutMinutes: 240,
    onTimeout: { kind: "agent_owner" },
})

/** One term of a condition on the amount. */
export const amountIs = (op: "lt" | "lte" | "gt" | "gte" | "eq", value: number): Term => ({
    fact: AMOUNT_FACT,
    op,
    value,
})

/** A branch that runs alone below five million. */
export const branchOf = builder<Branch>({
    key: "small",
    when: amountIs("lt", 5_000_000),
    then: "auto",
    next: "act",
    approver: null,
    sources: [],
})

/** A node with every answer filled, so a spec breaks only the one it is about. */
export const nodeOf = builder<Node>({
    key: "act",
    kind: "output",
    step: "write",
    title: "Record the payment",
    doneBy: "nivo",
    knows: [{ kind: "record", ref: "r", label: "The payment" }],
    does: "Records the supplier payment in the ledger.",
    uses: [],
    reads: [{ fact: AMOUNT_FACT, label: "Amount", place: "The statement" }],
    writes: [{ fact: "ledger.line", label: "A line", place: "The ledger" }],
    approver: null,
    sources: [{ kind: "rule", action: "pay_supplier" }],
    none: ["uses"],
    next: ["end"],
})

/** The end node every flow of the specs reaches. */
export const END: Node = nodeOf({ key: "end", kind: "output", step: "stop", title: "Done", next: [] })

/** A decide node over the amount. */
export const decideOf = (branches: ReadonlyArray<Branch>): Node =>
    nodeOf({
        key: "decide",
        kind: "condition",
        step: "evaluate",
        title: "Check the approval level",
        next: [],
        decide: { intent: "pay_supplier", facts: [AMOUNT_FACT], branches },
    })

/** The trigger every whole graph of the specs starts at. */
export const TRIGGER: Node = nodeOf({
    key: "start",
    kind: "trigger",
    step: "customer_message",
    title: "A request arrives",
    next: ["decide"],
})

/** A graph that is whole: a trigger, a condition whose branches lead on, and an output at the end of each path. Only what a branch leads to is drawn. */
export const graphOf = (branches: ReadonlyArray<Branch>): GraphDocument => {
    const leads = new Set(branches.map((branch) => branch.next))
    const act = leads.has("act") || leads.has("ask")
    return {
        nodes: [
            TRIGGER,
            decideOf(branches),
            ...(act ? [nodeOf({ key: "act", action: "pay_supplier", next: ["end"] })] : []),
            ...(leads.has("ask")
                ? [
                      nodeOf({
                          key: "ask",
                          kind: "output",
                          step: "approval",
                          doneBy: "person",
                          approver: approverOf(),
                          next: ["act"],
                      }),
                  ]
                : []),
            ...(leads.has("stop") ? [nodeOf({ key: "stop", kind: "output", step: "stop", next: [] })] : []),
            ...(act ? [END] : []),
        ],
        rights: [],
    }
}

/** The three branches of the owner example: under 5tr alone, up to 20tr Dinh, above it Mr Nam. */
export const OWNER_EXAMPLE: ReadonlyArray<Branch> = [
    branchOf({ key: "small", when: amountIs("lt", 5_000_000), then: "auto", next: "act" }),
    branchOf({
        key: "middle",
        when: { all: [amountIs("gte", 5_000_000), amountIs("lt", 20_000_000)] },
        then: "ask",
        next: "ask",
        approver: approverOf(),
    }),
    branchOf({
        key: "else",
        when: "else",
        then: "ask",
        next: "ask",
        approver: approverOf({ group: { roles: [], rooms: [], members: ["nam"] } }),
    }),
]

/** The ceiling the rules put on one action. */
interface Ceiling {
    readonly action: string
    readonly mode: "auto" | "ask" | "never"
    readonly limitVnd: number | null
    readonly autoMax: number | null
    readonly maxMode: "ask" | "never" | null
}

const NO_CEILINGS: ReadonlyArray<Ceiling> = []
const OUTWARD: boolean = false

/** A workspace in which every approver is covered, the rule is open, every tool is granted and the agent faces nobody. */
export const contextOf = builder({
    facts: FACTS,
    ceilings: NO_CEILINGS,
    isGranted: (_tool: string): boolean => true,
    approverCovers: (_action: string, _group: object, _top: number | null): boolean => true,
    groupHasPeople: (_group: object): boolean => true,
    facesCustomers: OUTWARD,
})

/** The graph of one agent as the store reads it. */
interface State {
    readonly workspaceId: string
    readonly agentId: string
    readonly installationId: string
    readonly mode: GraphMode
    readonly draft: GraphDocument
    readonly draftRev: number
    readonly activeVersionId: string | null
    readonly active: GraphDocument | null
}

/** The graph of one agent as the store reads it: the owner example, active and decided, in shadow until a spec says otherwise. */
export const stateOf = builder<State>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    installationId: "inst-1",
    mode: "shadow",
    draft: graphOf(OWNER_EXAMPLE),
    draftRev: 1,
    activeVersionId: "version-1",
    active: graphOf(OWNER_EXAMPLE),
})

/** A graph document the product cannot read: a title longer than a node may carry. */
export const UNREADABLE_DOCUMENT: GraphDocument = { nodes: [nodeOf({ title: "x".repeat(40) })], rights: [] }

/** The instant the rows of the specs were written. */
export const ROW_TIME = new Date("2026-11-01T01:00:00.000Z")

/** The stored graph of an agent: the owner example, with version 1 active; the arguments change only what a spec is about. */
export const graphRow = (
    mode: GraphMode = "shadow",
    activeVersionId: string | null = "version-1",
    draft: GraphDocument = graphOf(OWNER_EXAMPLE),
    draftRev = 3,
): InstanceType<typeof GraphEntity> =>
    Object.assign(new GraphEntity(), {
        agentId: "agent-1",
        workspaceId: "ws-1",
        installationId: "inst-1",
        draft,
        draftRev,
        activeVersionId,
        mode,
    })

/** One stored version of the graph of an agent. */
export const versionRow = (
    version = 2,
    document: GraphDocument = graphOf(OWNER_EXAMPLE),
    id = "version-1",
    changeKind: InstanceType<typeof VersionEntity>["changeKind"] = "edit",
): InstanceType<typeof VersionEntity> =>
    Object.assign(new VersionEntity(), {
        id,
        workspaceId: "ws-1",
        agentId: "agent-1",
        version,
        document,
        documentHash: "hash",
        contextVersionId: null,
        changeKind,
        note: "Raised the bound",
        publishedBy: "member-1",
        publishedAt: ROW_TIME,
    })

/** One stored decision of a graph. */
export const decisionRow = (
    id = "decision-1",
    closedAs: InstanceType<typeof DecisionEntity>["closedAs"] = null,
    facts: InstanceType<typeof DecisionEntity>["facts"] = { [AMOUNT_FACT]: 7_200_000 },
): InstanceType<typeof DecisionEntity> =>
    Object.assign(new DecisionEntity(), {
        id,
        workspaceId: "ws-1",
        agentId: "agent-1",
        workItemId: "item-9",
        branchKey: "middle",
        closedAs,
        facts,
    })

/** One stored proposal of a graph. */
export const proposalRow = (
    overrides: Partial<InstanceType<typeof ProposalEntity>> = {},
): InstanceType<typeof ProposalEntity> =>
    Object.assign(new ProposalEntity(), {
        id: "p1",
        kind: "learned",
        status: "open",
        nodeKey: "decide",
        branchKey: "middle",
        widens: true,
        evidence: ["d0"],
        createdAt: ROW_TIME,
        ...overrides,
    })
