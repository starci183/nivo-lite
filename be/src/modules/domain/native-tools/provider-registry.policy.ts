import {
    type ProviderTriggerDeclaration,
    type TriggerSwitchView,
    triggerDeciderOf,
} from "@modules/domain/provider-triggers"

/** One trigger of an account as the Config tab draws it: its switch, and who decides on its events. */
export interface TriggerConfig extends TriggerSwitchView {
    /** Whether one agent decides on its events; false means nobody is bound and the decider controls are not drawn. */
    readonly decided: boolean
    /** The agent the provider's own core path hands the events to, or null: while it is set the owner cannot bind another. */
    readonly coreDeciderAgentId: string | null
    /** The agent that decides now (the core agent, else the bound one), or null when nobody does. */
    readonly decidingAgentId: string | null
    /** Whether a switch that is turned on again can catch up on what it missed (the provider recovers missed events). */
    readonly canCatchUp: boolean
}

/** The Config rows of an account's triggers: each switch joined with its declaration and the core decider of the account. */
export const triggerConfigsOf = (
    declared: ReadonlyArray<ProviderTriggerDeclaration>,
    switches: ReadonlyArray<TriggerSwitchView>,
    coreDeciders: Readonly<Record<string, string | null>>,
): ReadonlyArray<TriggerConfig> =>
    declared.flatMap((declaration): ReadonlyArray<TriggerConfig> => {
        const held = switches.find((entry) => entry.name === declaration.name)
        if (held === undefined) return []
        const core = coreDeciders[declaration.name] ?? null
        return [
            {
                ...held,
                decided: declaration.decided,
                coreDeciderAgentId: core,
                decidingAgentId: triggerDeciderOf(declaration, core, held.deciderAgentId),
                canCatchUp: declaration.recovery !== "none",
            },
        ]
    })

/** What one agent holds on an account, for the rights list. */
export interface AgentRights {
    /** The agent. */
    readonly agentId: string
    /** Its name. */
    readonly name: string
    /** Whether the account is attached to it. */
    readonly attached: boolean
    /**
     * Level 2: each group of tools the provider serves, and whether the agent may reach it on this account (it is attached: the kill
     * switch). No mode here: a call's mode is its node's.
     */
    readonly abilities: ReadonlyArray<{
        readonly id: string
        readonly tools: ReadonlyArray<string>
        readonly allowed: boolean
    }>
    /** Level 3: each trigger an active workflow of the agent is registered on, with the agent's part. */
    readonly triggers: ReadonlyArray<{ readonly name: string; readonly role: "decider" | "notice" }>
}

/** What the rights list is joined from. */
export interface RightsFacts {
    /** Every active agent of the workspace. */
    readonly agents: ReadonlyArray<{ readonly id: string; readonly name: string }>
    /** The groups of tools the account's provider serves. */
    readonly abilities: ReadonlyArray<{ readonly id: string; readonly tools: ReadonlyArray<string> }>
    /** The agents attached to the account. */
    readonly attached: ReadonlySet<string>
    /** The triggers each agent has an active workflow registered on, by agent. */
    readonly registered: ReadonlyMap<string, ReadonlyArray<string>>
    /** The agent that decides on each trigger now, by trigger name. */
    readonly deciders: Readonly<Record<string, string | null>>
}

/**
 * The rights on one account, agent by agent: the attached ones first (in the directory's order), then the others. An attached agent
 * reaches every tool the provider serves; an agent that is not attached reaches none and is woken by no trigger.
 */
export const rightsOf = (facts: RightsFacts): ReadonlyArray<AgentRights> => {
    const rows = facts.agents.map((agent): AgentRights => {
        const attached = facts.attached.has(agent.id)
        return {
            agentId: agent.id,
            name: agent.name,
            attached,
            abilities: facts.abilities.map((ability) => ({ id: ability.id, tools: ability.tools, allowed: attached })),
            triggers: attached
                ? (facts.registered.get(agent.id) ?? []).map((name) => ({
                      name,
                      role: facts.deciders[name] === agent.id ? ("decider" as const) : ("notice" as const),
                  }))
                : [],
        }
    })
    return [...rows.filter((row) => row.attached), ...rows.filter((row) => !row.attached)]
}

/**
 * The wakes that stand for "any event of this trigger" when asking whether an agent is registered on it: one per combination of its
 * filterable choices (a bank movement in, and one out), with placeholder ids, as the event's `data` (the generic scope of the one
 * pipeline that a registration's `where` reads by path, R44); a `list` trigger has one.
 */
export const sampleParamsOf = (declaration: ProviderTriggerDeclaration): ReadonlyArray<Readonly<Record<string, unknown>>> => {
    if (declaration.batching.mode === "list") return [{ eventIds: ["sample"], count: 1 }]
    const base: Readonly<Record<string, unknown>> = Object.fromEntries(
        declaration.payload.map((field) => [field.name, field.type === "integer" ? 1 : (field.of?.[0] ?? "sample")]),
    )
    const choices = declaration.payload.filter((field) => field.type === "choice" && field.filterable)
    return choices
        .reduce<ReadonlyArray<Readonly<Record<string, unknown>>>>(
            (combined, field) => combined.flatMap((params) => (field.of ?? []).map((value) => ({ ...params, [field.name]: value }))),
            [base],
        )
        .map((data) => ({ data }))
}
