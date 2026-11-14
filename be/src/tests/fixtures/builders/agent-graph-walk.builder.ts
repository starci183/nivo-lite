import { AMOUNT_FACT, approverOf, graphOf, nodeOf } from "./agent-graph.builder"

/** The action the walks are about, and a fact of a second condition. */
export const PAY = "pay_supplier"
export const URGENT = "supplier_payment.urgent"

/** A node of a walk. */
export type Node = ReturnType<typeof nodeOf>
type Document = ReturnType<typeof graphOf>

/** A node that cites no rule, so it is held only by what the spec gives it. */
export const stepOf = (key: string, step: Node["step"], next: ReadonlyArray<string>, extra: Partial<Node> = {}): Node =>
    nodeOf({
        key,
        kind: step === "stop" || step === "write" || step === "reply" || step === "approval" ? "output" : "execute",
        step,
        sources: [],
        next,
        ...extra,
    })

/** The nodes the walks are made of. */
export const TRIGGER: Node = stepOf("start", "customer_message", ["decide"], { kind: "trigger" })
export const ACT: Node = stepOf("act", "write", [], { action: PAY })
export const ASK: Node = stepOf("ask", "approval", ["act"], { doneBy: "person", approver: approverOf() })
export const STOP: Node = stepOf("stop", "stop", [])

/** A graph of exactly these nodes. */
export const documentOf = (...nodes: ReadonlyArray<Node>): Document => ({ nodes })

type AmountShape = {
    "supplier_payment.amount_vnd": number
}

/** The facts of a walk that read an amount. */
export const AMOUNT: AmountShape = { [AMOUNT_FACT]: 7_200_000 }
