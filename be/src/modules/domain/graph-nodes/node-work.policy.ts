import type { WorkScope } from "@modules/platform/logging"

/**
 * The work a node's model calls are booked to: the step of the run step key (`<run id>:<step key>`, both engines; an undo's or a
 * test's key without a run part is the step itself) and the agent of the turn.
 */
export const nodeWorkOf = (key: string, agentId: string): WorkScope => {
    const colon = key.indexOf(":")
    const stepKey = colon < 0 ? key : key.slice(colon + 1)
    return { kind: "node", stepKey: stepKey === "" ? null : stepKey, agentId }
}
