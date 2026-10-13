import { AUTOMATION_ROUTES, CONSOLE_ROUTES } from "@/modules/routes"

/** What the workspace has, for the requirements of a module. */
interface RequirementFacts {
    readonly providers: ReadonlyArray<string>
    readonly chatAgents: number
    readonly staff: number
    readonly members: number
}

/** One requirement of a module the workspace does not meet yet. Soft: it never blocks installing or applying. */
export interface UnmetRequirement {
    /** The message key (in `moduleSetup`) of the name of what is missing; empty when the raw key is the name. */
    readonly messageKey: string
    readonly key: string
    readonly href: string
}

const CHAT_PROVIDERS = ["telegram", "zalo_oa"]
const KNOWN_CONNECTIONS = ["google", "smtp", "webhook", "telegram", "zalo_oa"]

/** What each capability a module declares needs, and where the owner fixes it. A capability the platform itself provides is always met. */
const CAPABILITY: Readonly<
    Record<
        string,
        {
            readonly met: (providers: ReadonlySet<string>, chat: number, staff: number) => boolean
            readonly href: string
        }
    >
> = {
    customer_chat: {
        met: (providers, chat) => chat > 0 || CHAT_PROVIDERS.some((provider) => providers.has(provider)),
        href: AUTOMATION_ROUTES.connections,
    },
    customer_messaging: {
        met: (providers, chat) => chat > 0 || CHAT_PROVIDERS.some((provider) => providers.has(provider)),
        href: AUTOMATION_ROUTES.connections,
    },
    email: { met: (providers) => providers.has("smtp"), href: AUTOMATION_ROUTES.connectEmail },
    calendar: { met: (providers) => providers.has("google"), href: AUTOMATION_ROUTES.connections },
    staff_directory: { met: (_providers, _chat, staff) => staff > 0, href: CONSOLE_ROUTES.team },
    social_publish: { met: () => true, href: AUTOMATION_ROUTES.connections },
    video_render: { met: () => true, href: AUTOMATION_ROUTES.connections },
}

/** What a module declares it needs: capabilities and connections. */
interface ModuleRequires {
    readonly capabilities: ReadonlyArray<string>
    readonly connections: ReadonlyArray<string>
}

/** The requirements of a module (`requires.capabilities`, `requires.connections`) that the workspace does not meet yet. */
export const unmetRequirementsOf = (
    requires: ModuleRequires,
    facts: RequirementFacts,
): ReadonlyArray<UnmetRequirement> => {
    const providers = new Set(facts.providers)
    const staff = facts.staff + Math.max(0, facts.members - 1)
    const capabilities = requires.capabilities.flatMap((key): Array<UnmetRequirement> => {
        const def = CAPABILITY[key]
        return def !== undefined && !def.met(providers, facts.chatAgents, staff)
            ? [{ messageKey: `req_${key}`, key, href: def.href }]
            : []
    })
    const connections = requires.connections
        .filter((key) => !providers.has(key))
        .map((key) => ({
            messageKey: KNOWN_CONNECTIONS.includes(key) ? `req_conn_${key}` : "",
            key,
            href: AUTOMATION_ROUTES.connections,
        }))
    return [...capabilities, ...connections]
}
