import { Injectable, Optional } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentAccountsService } from "@modules/domain/tools"
import {
    InjectProviderTriggerCoreDeciders,
    InjectProviderTriggerReceivers,
    ProviderTriggersService,
    triggerDeciderOf,
    providerTriggerKeyOf,
    triggersOf,
    type ProviderTriggerCoreDeciders,
    type ProviderTriggerDeclaration,
    type ProviderTriggerReceivers,
    type TriggerSwitchView,
} from "@modules/domain/provider-triggers"
import type { ProviderRegistryReads } from "@modules/domain/workbench-door"
import { eachInOrder } from "@modules/platform/primitives"
import { rightsOf, sampleParamsOf, triggerConfigsOf } from "./provider-registry.policy"

/** The most agents the rights list of one account names. */
const AGENTS_MAX = 100

@Injectable()
/**
 * THE REGISTRY READS of an account of any provider: `config` (the trigger switches of the account, the agent that decides on each
 * and whether the owner may bind one) and `rights` (per agent of the workspace: attached or not, each tool ability with its tick and
 * mode, and its part in each trigger a workflow of it registered on). Nothing here decides a right: it joins what the rights board,
 * the trigger switches and the routing already hold, for a person to look at.
 */
export class ProviderRegistryReadsService implements ProviderRegistryReads {
    constructor(
        private readonly abilities: AgentAccountsService,
        @Optional() private readonly triggers?: ProviderTriggersService,
        @Optional() @InjectProviderTriggerReceivers() private readonly receivers?: ProviderTriggerReceivers,
        @Optional() @InjectProviderTriggerCoreDeciders() private readonly coreDeciders?: ProviderTriggerCoreDeciders,
        @Optional() private readonly agents?: AgentDirectoryService,
    ) {}

    /** The trigger configuration of one account; null when the workspace has no such account of the provider. */
    async configOf(workspaceId: string, provider: string, connectionId: string): Promise<object | null> {
        const account = await this.accountOf(workspaceId, provider, connectionId)
        if (account === null) return null
        const declared = triggersOf(provider)
        const switches = await this.switchesOf(workspaceId, connectionId, declared)
        return {
            connectionId,
            connected: account.connected,
            triggers: triggerConfigsOf(declared, switches, await this.coreOf(provider, connectionId, declared)),
        }
    }

    /** The rights on one account; null when the workspace has no such account of the provider. */
    async rightsOf(workspaceId: string, provider: string, connectionId: string): Promise<object | null> {
        const board = await this.abilities.board(workspaceId)
        const spec = board.providers.find((entry) => entry.provider === provider)
        if (spec?.accounts.some((account) => account.connectionId === connectionId) !== true) return null
        const declared = triggersOf(provider)
        const attached = new Set(
            board.attachments.filter((attachment) => attachment.connectionId === connectionId).map((attachment) => attachment.agentId),
        )
        const switches = await this.switchesOf(workspaceId, connectionId, declared)
        const core = await this.coreOf(provider, connectionId, declared)
        const deciders = Object.fromEntries(
            declared.map((declaration) => [
                declaration.name,
                triggerDeciderOf(
                    declaration,
                    core[declaration.name] ?? null,
                    switches.find((held) => held.name === declaration.name)?.deciderAgentId ?? null,
                ),
            ]),
        )
        const agents = (await this.agents?.activeOf(workspaceId, AGENTS_MAX)) ?? []
        const registered = new Map<string, ReadonlyArray<string>>()
        await Promise.all(
            [...attached].map(async (agentId) => {
                registered.set(agentId, await this.registeredOf(workspaceId, agentId, connectionId, declared, core))
            }),
        )
        return {
            connectionId,
            // Level 1 has no per-agent right: every member of the workspace may view a provider's reads for now.
            api: { viewers: "members" },
            agents: rightsOf({
                agents: agents.map((agent) => ({ id: agent.id, name: agent.name })),
                abilities: spec.abilities.map((ability) => ({ id: ability.id, tools: ability.tools })),
                attached,
                registered,
                deciders,
            }),
        }
    }

    private async accountOf(
        workspaceId: string,
        provider: string,
        connectionId: string,
    ): Promise<{ readonly connected: boolean } | null> {
        const board = await this.abilities.board(workspaceId)
        const account = board.providers
            .find((entry) => entry.provider === provider)
            ?.accounts.find((entry) => entry.connectionId === connectionId)
        return account === undefined ? null : { connected: account.connected }
    }

    /** The switches of the account; every declared trigger off where no trigger capability is registered. */
    private async switchesOf(
        workspaceId: string,
        connectionId: string,
        declared: ReadonlyArray<ProviderTriggerDeclaration>,
    ): Promise<ReadonlyArray<TriggerSwitchView>> {
        if (this.triggers !== undefined) return this.triggers.switchesOf(workspaceId, connectionId)
        return declared.map((declaration) => ({
            name: declaration.name,
            enabled: false,
            enabledAt: null,
            lastFiredAt: null,
            firedCount: 0,
            deciderAgentId: null,
        }))
    }

    /** The agent the provider's core path hands each trigger's events to on this account, by trigger name. */
    private async coreOf(
        provider: string,
        connectionId: string,
        declared: ReadonlyArray<ProviderTriggerDeclaration>,
    ): Promise<Readonly<Record<string, string | null>>> {
        const entries = await Promise.all(
            declared.map(async (declaration): Promise<readonly [string, string | null]> => [
                declaration.name,
                declaration.decided ? ((await this.coreDeciders?.coreDeciderOf(provider, declaration.name, connectionId)) ?? null) : null,
            ]),
        )
        return Object.fromEntries(entries)
    }

    /**
     * The triggers an attached agent takes part in: one an active workflow of it is registered on (asked with the sample wakes of
     * the trigger, exactly as a real wake is routed), and one the provider's core path hands to it.
     */
    private async registeredOf(
        workspaceId: string,
        agentId: string,
        connectionId: string,
        declared: ReadonlyArray<ProviderTriggerDeclaration>,
        core: Readonly<Record<string, string | null>>,
    ): Promise<ReadonlyArray<string>> {
        const names: Array<string> = []
        await eachInOrder(declared, async (declaration) => {
            const wakes = sampleParamsOf(declaration).map((params) => ({
                providerTrigger: providerTriggerKeyOf(declaration.provider, declaration.name),
                connectionId,
                params,
            }))
            const taken = (await this.receivers?.registered(workspaceId, agentId, wakes)) ?? []
            if (core[declaration.name] === agentId || taken.includes(true)) names.push(declaration.name)
        })
        return names
    }
}
