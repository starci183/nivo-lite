import type { InstalledPlugin } from "@nivo-lite/agent-sdk/installation"
import type { TemplateAgent } from "@nivo-lite/agent-sdk/template"
import type { EnterpriseSeedPlace } from "@modules/domain/channel-provisioning"
import { inboundChannelsOf } from "@modules/domain/installed-plugins"
import type { AttachmentWish, TemplateProposal } from "@modules/domain/tools"

/**
 * THE ROSTER OF AN ENTERPRISE (ruling R17), read from what its plugins already declare, never from a list of the engine's: a PRIVATE
 * plugin whose `enterprises` names the enterprise brings every template agent of its modules (each with its `primary` graph and the
 * provider kinds it works with, `accounts`); the channels an agent is the front door of are the customer-message triggers of its graphs
 * (`inboundChannelsOf`). A public plugin brings nothing to an enterprise (its agents are installed by the owner, or by the NIVO seed).
 */
export const rosterOf = (
    plugins: ReadonlyArray<InstalledPlugin>,
    agents: ReadonlyArray<TemplateAgent>,
    identifier: string,
): ReadonlyArray<TemplateAgent> => {
    const modules = new Set(
        plugins
            .filter((plugin) => plugin.visibility === "private" && plugin.enterprises.includes(identifier))
            .flatMap((plugin) => plugin.modules),
    )
    return agents.filter((agent) => modules.has(agent.key))
}

/** The accounts one agent of the roster is attached to, and the provider kinds it needs that the workspace holds no usable account of. */
export interface AttachPlan {
    /** The accounts to attach (where the agent holds none). */
    readonly wishes: ReadonlyArray<AttachmentWish>
    /** The provider kinds left without an account, in the template's order: reported, never fatal. */
    readonly missing: ReadonlyArray<string>
}

/**
 * THE ATTACH RULE BY KIND: for each provider kind the agent's template lists (the module's proposal, one line per working account of the
 * kind and one empty line for a kind not connected), the LIVE working accounts of that kind; where there is none, on the local stack only,
 * its SANDBOX accounts (a sandbox account answers through the same tools, ruling R56); in production a sandbox account is never attached.
 * A kind left with no account is `missing`.
 */
export const attachPlanOf = (
    lines: ReadonlyArray<TemplateProposal>,
    isSandbox: (connectionId: string) => boolean,
    place: EnterpriseSeedPlace,
): AttachPlan => {
    const kinds = [...new Set(lines.map((line) => line.provider))]
    const wishes: Array<AttachmentWish> = []
    const missing: Array<string> = []
    for (const kind of kinds) {
        const working = lines.flatMap((line) =>
            line.provider === kind && line.connected && line.connectionId !== null ? [line.connectionId] : [],
        )
        const live = working.filter((connectionId) => !isSandbox(connectionId))
        const chosen = live.length > 0 ? live : place === "local" ? working.filter((connectionId) => isSandbox(connectionId)) : []
        if (chosen.length === 0) missing.push(kind)
        wishes.push(...chosen.map((connectionId) => ({ connectionId })))
    }
    return { wishes, missing }
}

/**
 * The front door of each customer channel the roster answers: the FIRST agent of the roster (in the plugin's order) whose graphs wake on
 * a customer message of that channel. Only the channels a customer writes on through a connection count (`channels`); the website form
 * is no connection.
 */
export const frontDoorsOf = (roster: ReadonlyArray<TemplateAgent>, channels: ReadonlySet<string>): ReadonlyMap<string, string> => {
    const doors = new Map<string, string>()
    for (const agent of roster) {
        for (const channel of inboundChannelsOf(agent)) {
            if (channels.has(channel) && !doors.has(channel)) doors.set(channel, agent.key)
        }
    }
    return doors
}
