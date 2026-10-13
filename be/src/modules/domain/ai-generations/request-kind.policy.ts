/**
 * The usage kinds a signed-in caller may ask the generic text doors (`requestAgentGeneration`, `POST generate-text`) for, by the usage
 * module it names. A module may only meter text under the kinds it owns; `guide` (and any other kind NIVO pays for) is never on the
 * list: the NIVO guide has its own door that builds its prompt on the be and limits each member.
 */
const REQUESTABLE_KINDS: Readonly<Record<string, ReadonlyArray<string>>> = {
    accounting: ["engine"],
    booking: ["engine"],
    brain: ["brain"],
    chatbot: ["engine", "chat_reply"],
    content: ["engine"],
    hiring: ["engine"],
    inventory: ["engine"],
    knowledge: ["engine"],
    leadgen: ["engine"],
    loyalty: ["engine"],
    office: ["owner_chat", "office_command", "relay"],
    other: ["engine"],
    sales: ["engine"],
    setup: ["setup"],
    shifts: ["engine"],
    video: ["engine"],
}

/** Whether a caller of a generic text door may meter a text under this kind for this module. */
export const isRequestableKind = (module: string, kind: string): boolean =>
    Object.hasOwn(REQUESTABLE_KINDS, module) && (REQUESTABLE_KINDS[module] ?? []).includes(kind)
