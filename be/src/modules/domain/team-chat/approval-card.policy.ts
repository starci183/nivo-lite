import type { ApproverGroup } from "@modules/domain/authority-rules"

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

/** The input of the declared job that posts the approval card of a request to the team chat: ids, the action and the amount. */
export interface ApprovalCardInput {
    /** The request: the decision every card of it stands for. */
    readonly decisionId: string
    /** The agent that asked, or null. */
    readonly agentId: string | null
    /** The action asked about. */
    readonly action: string
    /** The amount of the action, or null. */
    readonly amount: number | null
    /** What the amount is counted in. */
    readonly unit: string
    /** The team chat rooms the rule names. */
    readonly roomIds: ReadonlyArray<string>
    /** The seats the rule names one by one. */
    readonly approverSeatIds: ReadonlyArray<string>
}

/** The request that was opened, as far as its card cares. */
export interface OpenedForCard {
    /** The request id. */
    readonly id: string
    /** The action. */
    readonly action: string
    /** The amount, or null. */
    readonly amount: number | null
    /** The unit. */
    readonly unit: string
    /** The agent that asked, or null. */
    readonly requestedByAgentId: string | null
}

/** A stored approver group as the group it is, or null when it is not one (a request of a rule stores none). */
export const groupOf = (stored: unknown): ApproverGroup | null => {
    if (typeof stored !== "object" || stored === null) return null
    const roles: unknown = Reflect.get(stored, "roles")
    const rooms: unknown = Reflect.get(stored, "rooms")
    const members: unknown = Reflect.get(stored, "members")
    const texts = (value: unknown): value is ReadonlyArray<string> =>
        Array.isArray(value) && value.every((item) => typeof item === "string")
    return texts(roles) && texts(rooms) && texts(members)
        ? {
              roles: roles.filter(
                  (role): role is ApproverGroup["roles"][number] =>
                      role === "owner" || role === "manager" || role === "staff",
              ),
              rooms,
              members,
          }
        : null
}

/**
 * What the card of a request is made of: the rooms its rule names (a room is a team chat room id; anything else a rule may still carry
 * is not a room and is left out) and the seats it names one by one. The people the grants resolved are not all asked in a room: only the
 * rule's own rooms and named members hear of the request there.
 */
export const approvalCardOf = (opened: OpenedForCard, group: ApproverGroup): ApprovalCardInput => ({
    decisionId: opened.id,
    agentId: opened.requestedByAgentId,
    action: opened.action,
    amount: opened.amount,
    unit: opened.unit,
    roomIds: group.rooms.filter((room) => UUID.test(room)),
    approverSeatIds: group.members.filter((seat) => UUID.test(seat)),
})
