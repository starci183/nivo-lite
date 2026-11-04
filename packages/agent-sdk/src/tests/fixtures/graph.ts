import type { BranchApprover, Condition, GraphBranch, GraphDocument, GraphNode } from "../../template/graph.types"

/** The fact the graphs of the specs decide on. */
export const AMOUNT_FACT: string = "supplier_payment.amount_vnd"

/** A term on the amount. */
export const amountIs = (op: "lt" | "lte" | "gt" | "gte" | "eq", value: number): Condition => ({
    fact: AMOUNT_FACT,
    op,
    value,
})

/** An approver of managers, with a wait of four hours. */
export const approverOf = (over: Partial<BranchApprover> = {}): BranchApprover => ({
    group: { roles: ["manager"], rooms: [], members: ["dinh"] },
    policy: "any",
    timeoutMinutes: 240,
    onTimeout: { kind: "agent_owner" },
    ...over,
})

/** A branch that runs alone below five million. */
export const branchOf = (over: Partial<GraphBranch> = {}): GraphBranch => ({
    key: "small",
    when: amountIs("lt", 5_000_000),
    then: "auto",
    next: "act",
    approver: null,
    sources: [],
    ...over,
})

/** A node with every answer filled. */
export const nodeOf = (over: Partial<GraphNode> = {}): GraphNode => ({
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
    ...over,
})

/** The three branches of the owner example: under 5tr alone, up to 20tr a manager, above it a named person. */
export const OWNER_BRANCHES: ReadonlyArray<GraphBranch> = [
    branchOf(),
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

/** A whole graph: a trigger, a decide node over the amount, an approval, the act and the end. */
export const graphOf = (branches: ReadonlyArray<GraphBranch> = OWNER_BRANCHES): GraphDocument => ({
    nodes: [
        nodeOf({
            key: "start",
            kind: "trigger",
            step: "customer_message",
            title: "A request arrives",
            next: ["decide"],
        }),
        nodeOf({
            key: "decide",
            kind: "condition",
            step: "evaluate",
            title: "Check the approval level",
            next: [],
            decide: { intent: "pay_supplier", facts: [AMOUNT_FACT], branches },
        }),
        nodeOf({ key: "act", action: "pay_supplier", next: ["end"] }),
        nodeOf({
            key: "ask",
            kind: "output",
            step: "approval",
            doneBy: "person",
            approver: approverOf(),
            next: ["act"],
        }),
        nodeOf({ key: "end", kind: "output", step: "stop", title: "Done", next: [] }),
    ],
    rights: [],
})
