import { INSTALLED } from "@modules/domain/installed-plugins"

/**
 * The usage kinds a signed-in caller may ask the generic text doors (`requestAgentGeneration`, `POST generate-text`) for, by the usage
 * module it names. A module may only meter text under the kinds it owns; `guide` (and any other kind NIVO pays for) is never on the
 * list: the NIVO guide has its own door that builds its prompt on the be and limits each member.
 */
const OWN_KINDS = {
    brain: ["brain"],
    knowledge: ["engine"],
    office: ["owner_chat", "office_command", "relay"],
    other: ["engine"],
    setup: ["setup"],
} satisfies Readonly<Record<string, ReadonlyArray<string>>>

/** The kinds an installed module may meter: its engine work, and a customer-facing reply when its template says its agent talks to customers. */
const installedKindsOf = (module: string): ReadonlyArray<string> => {
    const server = INSTALLED.servers().find((one) => one.key === module)
    if (server === undefined) return []
    return server.template.audience === "customer" ? ["engine", "chat_reply"] : ["engine"]
}

/** Whether the module is one of the modules whose kinds this file declares itself. */
const isOwnModule = (module: string): module is keyof typeof OWN_KINDS => Object.hasOwn(OWN_KINDS, module)

/** Whether a caller of a generic text door may meter a text under this kind for this module. */
export const isRequestableKind = (module: string, kind: string): boolean =>
    (isOwnModule(module) ? OWN_KINDS[module] : installedKindsOf(module)).includes(kind)
