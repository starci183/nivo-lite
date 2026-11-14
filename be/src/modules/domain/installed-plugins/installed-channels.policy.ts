import { TRIGGER, type ProviderKey } from "@nivo-lite/agent-sdk/names"
import { ENGINE_ROAD, TRIGGERS, adaptersOf, triggerSpecOf } from "@modules/domain/trigger-specs"
import { INSTALLED } from "./installed.policy"

/** The website form's channel: the one customer channel that is no provider (the engine's own road). */
export const WEBSITE_CHANNEL = "website"

/** A channel customers write on: a connection's provider, or the website form. */
export type FrontDoorChannel = string

/** The member that names the person a customer-message event is about. */
const CONTACT_MEMBER = "contactId"

/** One trigger of a template graph: its verb and the providers it is listened through. */
interface ChannelTrigger {
    readonly verb: string
    readonly accounts?: ReadonlyArray<ProviderKey> | undefined
}

/** The part of a graph spec that names its triggers. */
interface ChannelGraphSpec {
    readonly triggers: ReadonlyArray<ChannelTrigger>
}

/** One graph of a template agent, with the triggers that start it. */
interface ChannelGraph {
    readonly spec: ChannelGraphSpec
}

/** An agent's key with the number of customer channels it answers on. */
interface ChannelCount {
    readonly key: string
    readonly count: number
}

/** More channels first. */
const byCount = (left: ChannelCount, right: ChannelCount): number => right.count - left.count

/** The part of a template agent the channel facts are read from: its module key, its providers and the triggers of its graphs. */
export interface ChannelAgent {
    /** The agent's module key. */
    readonly key: string
    /** The providers the agent works with. */
    readonly accounts: ReadonlyArray<string>
    /** Its graphs, each with the triggers that start it. */
    readonly graphs: ReadonlyArray<ChannelGraph>
}

/**
 * The channels one trigger of a graph listens for customers on, from the trigger registry: a verb that carries a MESSAGE about a contact is
 * a customer-message verb, and the providers it is listened through (`accounts`, else the verb's own road) are its channels. Any other
 * verb (a bank credit, a mail, a timer, a workflow call, a team chat line) gives none.
 */
export const channelsOfTrigger = (
    verb: string,
    accounts: ReadonlyArray<ProviderKey> | undefined,
): ReadonlyArray<string> => {
    const spec = triggerSpecOf(verb)
    if (spec?.payload !== "message" || !spec.subject.includes(CONTACT_MEMBER)) return []
    return adaptersOf(spec.verb, accounts).map((adapter) =>
        adapter.provider === ENGINE_ROAD ? WEBSITE_CHANNEL : adapter.provider,
    )
}

/** The channels the graphs of a template agent wake on a customer message of (the agent is the front door of each). */
export const inboundChannelsOf = (agent: ChannelAgent): ReadonlySet<string> =>
    new Set(
        agent.graphs.flatMap((graph) =>
            graph.spec.triggers.flatMap((trigger) => channelsOfTrigger(trigger.verb, trigger.accounts)),
        ),
    )

/** The providers a customer writes on, as the trigger registry's customer-message verbs declare them (the website road is no provider). */
export const customerChannelProviders = (): ReadonlySet<string> =>
    new Set(
        Object.values(TRIGGERS).flatMap((spec) =>
            spec.payload === "message" && spec.subject.includes(CONTACT_MEMBER)
                ? spec.adapters.flatMap((adapter) => (adapter.provider === ENGINE_ROAD ? [] : [adapter.provider]))
                : [],
        ),
    )

/** The providers that feed bank credits, as the registry's payment verb declares its adapters. */
export const bankFeedProviders = (): ReadonlySet<string> =>
    new Set((triggerSpecOf(TRIGGER.paymentCreditReceived)?.adapters ?? []).map((adapter) => adapter.provider))

/**
 * The modules whose template agent is a front door for the channel, best first. Candidates are the template agents (as the installation
 * lists them: the plugins in array order, each plugin's agents in its own order) with a graph that wakes on a customer message of the
 * channel. The order: a module of a PRIVATE plugin before a public one (the caller passes only modules the workspace may hold, so a
 * private plugin's template that is listed here is open to this enterprise workspace and owns its channels), then the installation's order.
 */
export const frontDoorModulesOf = (
    channel: FrontDoorChannel,
    agents: ReadonlyArray<ChannelAgent>,
    isPrivate: (module: string) => boolean,
): ReadonlyArray<string> => {
    const answering = agents.filter((agent) => inboundChannelsOf(agent).has(channel)).map((agent) => agent.key)
    return [...answering.filter((module) => isPrivate(module)), ...answering.filter((module) => !isPrivate(module))]
}

/** The front-door modules of a channel in THIS installation, best first (the rule of `frontDoorModulesOf`; private-plugin modules first). */
export const installedFrontDoorsOf = (channel: FrontDoorChannel): ReadonlyArray<string> =>
    frontDoorModulesOf(
        channel,
        INSTALLED.templateAgents(),
        (module) => INSTALLED.pluginOfModule(module)?.visibility === "private",
    )

/**
 * The modules whose template agent is a front door of the customer CHAT, best first: the template agents that answer a customer on at
 * least one provider channel (the channels a conversation is held on; the website form is a form, not a chat). A module of a PRIVATE
 * plugin comes before a public one; within each group the one that answers more of those channels comes first, then the installation's order.
 */
export const chatFrontDoorModulesOf = (
    agents: ReadonlyArray<ChannelAgent>,
    isPrivate: (module: string) => boolean,
): ReadonlyArray<string> => {
    const providers = customerChannelProviders()
    const answering = agents
        .map((agent) => ({
            key: agent.key,
            count: [...inboundChannelsOf(agent)].filter((c) => providers.has(c)).length,
        }))
        .filter((agent) => agent.count > 0)
    return [
        ...answering.filter((agent) => isPrivate(agent.key)).toSorted(byCount),
        ...answering.filter((agent) => !isPrivate(agent.key)).toSorted(byCount),
    ].map((agent) => agent.key)
}

/** The customer-chat front-door modules in THIS installation, best first (the rule of `chatFrontDoorModulesOf`). */
export const installedChatFrontDoors = (): ReadonlyArray<string> =>
    chatFrontDoorModulesOf(
        INSTALLED.templateAgents(),
        (module) => INSTALLED.pluginOfModule(module)?.visibility === "private",
    )
