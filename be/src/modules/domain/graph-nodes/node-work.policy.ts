import type { WorkScope } from "@modules/platform/logging"
import type { NodeWorkKind } from "./graph-nodes.contracts"

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/**
 * The record a chat turn's calls are booked to: the person's message it answers, `message:<room>/<message>`, read from the node's
 * input (`roomId`, `messageId`, as the team chat's node takes them); null when the input names either not.
 */
const chatMessageRefOf = (input: unknown): string | null => {
    if (typeof input !== "object" || input === null) return null
    const roomId = textOf(Reflect.get(input, "roomId"))
    const messageId = textOf(Reflect.get(input, "messageId"))
    return roomId === null || messageId === null ? null : `message:${roomId}/${messageId}`
}

/**
 * The work a node's model calls are booked to: the step of the run step key (`<run id>:<step key>`, both engines; an undo's or a
 * test's key without a run part is the step itself) and the agent of the turn. A node whose step blocks-core declares as a chat turn
 * (`NodeModel.work`, the team chat's answer to a person) is booked as `chat_turn` to the message it answers, its step kept.
 */
export const nodeWorkOf = (key: string, agentId: string, work?: NodeWorkKind, input?: unknown): WorkScope => {
    const colon = key.indexOf(":")
    const stepKey = colon < 0 ? key : key.slice(colon + 1)
    const step = stepKey === "" ? null : stepKey
    if (work === "chat_turn") return { kind: "chat_turn", ref: chatMessageRefOf(input), stepKey: step, agentId }
    return { kind: "node", stepKey: step, agentId }
}
