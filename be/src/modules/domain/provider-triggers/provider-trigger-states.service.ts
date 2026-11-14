import { Injectable, Optional } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ProviderTriggersError, ProviderTriggersErrorCode } from "./errors/provider-triggers.error"
import type {
    ProviderTriggerState,
    TriggerActor,
    TriggerDeciderChange,
    TriggerSwitchChange,
} from "./provider-trigger-states.contracts"
import { REFUSAL_CODES, namedAgentsOf, triggerStatesOf } from "./provider-trigger-states.policy"
import type {
    OptionalAgentId,
    ProviderTriggerAgentNames,
    ProviderTriggerCoreDeciders,
    ProviderTriggerDeclaration,
    ProviderTriggerReceivers,
    TriggerChangeResult,
} from "./provider-triggers.contracts"
import {
    InjectProviderTriggerAgentNames,
    InjectProviderTriggerCoreDeciders,
    InjectProviderTriggerReceivers,
} from "./provider-triggers.decorators"
import { ProviderTriggersLogEvent } from "./provider-triggers.log-events"
import { triggersOf } from "./provider-triggers.policy"
import { ProviderTriggersService } from "./provider-triggers.service"

/** Who may turn a switch or bind a decider: the owner and the managers, as for every attachment of an agent to an account. */
const CHANGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** Throws the typed refusal of a change; a change that was made passes. */
const requireDone = (result: TriggerChangeResult, connectionId: string, trigger: string): void => {
    if (!result.ok) throw new ProviderTriggersError({ code: REFUSAL_CODES[result.reason], params: { connectionId, trigger } })
}

@Injectable()
/**
 * THE TRIGGER CARD OF A PROVIDER PAGE: the states of an account's triggers (switch, last fired, who decides, whether a switch may
 * catch up, and the agents a binding may lawfully name), and the two owner changes of it, turning a switch and binding the decider.
 * Any member reads; the owner or a manager changes, and each change is written to the log as an audit line. The account must be the
 * workspace's own. Nothing outside is called: every answer comes from the switches, the attachments and the core path's binding.
 */
export class ProviderTriggerStatesService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly connections: ConnectionBindingsReadService,
        private readonly triggers: ProviderTriggersService,
        @Optional() @InjectProviderTriggerReceivers() private readonly receivers: ProviderTriggerReceivers | null = null,
        @Optional()
        @InjectProviderTriggerCoreDeciders()
        private readonly coreDeciders: ProviderTriggerCoreDeciders | null = null,
        @Optional() @InjectProviderTriggerAgentNames() private readonly agents: ProviderTriggerAgentNames | null = null,
    ) {}

    /** The states of the account's triggers, one per trigger its provider declares; refused for a non-member and a foreign account. */
    async statesOf(actor: TriggerActor, connectionId: string): Promise<ReadonlyArray<ProviderTriggerState>> {
        await this.members.require(actor.principalId, actor.workspaceId)
        return this.read(actor.workspaceId, connectionId)
    }

    /**
     * Turns the trigger of an account on or off (owner or manager). Turning it on starts from now, or with `catchUp` from where it last
     * handed an event on, where the trigger can catch up. Answers the trigger's state after the change.
     */
    async setEnabled(actor: TriggerActor, change: TriggerSwitchChange): Promise<ProviderTriggerState> {
        await this.members.require(actor.principalId, actor.workspaceId, CHANGERS)
        const catchUp = change.enabled && change.catchUp
        const { connectionId, trigger, enabled } = change
        requireDone(
            await this.triggers.setEnabled(actor.workspaceId, connectionId, trigger, { enabled, catchUp }),
            connectionId,
            trigger,
        )
        this.logger.info(ProviderTriggersLogEvent.SwitchChanged, {
            workspaceId: actor.workspaceId,
            connectionId,
            trigger,
            enabled,
            catchUp,
            changedBy: actor.principalId,
        })
        return this.stateOf(actor.workspaceId, connectionId, trigger)
    }

    /** Binds the decider of an account's trigger, or unbinds it with no agent (owner or manager). Answers the trigger's state after it. */
    async bindDecider(actor: TriggerActor, change: TriggerDeciderChange): Promise<ProviderTriggerState> {
        await this.members.require(actor.principalId, actor.workspaceId, CHANGERS)
        const { connectionId, trigger } = change
        const agentId: OptionalAgentId = change.agentId ?? null
        requireDone(await this.triggers.bindDecider(actor.workspaceId, connectionId, trigger, agentId), connectionId, trigger)
        this.logger.info(ProviderTriggersLogEvent.DeciderBound, {
            workspaceId: actor.workspaceId,
            connectionId,
            trigger,
            agentId: agentId ?? "",
            changedBy: actor.principalId,
        })
        return this.stateOf(actor.workspaceId, connectionId, trigger)
    }

    /** The state of one trigger of the account after a change. */
    private async stateOf(workspaceId: string, connectionId: string, trigger: string): Promise<ProviderTriggerState> {
        const state = (await this.read(workspaceId, connectionId)).find((entry) => entry.name === trigger)
        if (state === undefined) {
            throw new ProviderTriggersError({ code: ProviderTriggersErrorCode.Undeclared, params: { connectionId, trigger } })
        }
        return state
    }

    /** The states of the account's triggers in the workspace, joined from what is stored; a foreign account is refused. */
    private async read(workspaceId: string, connectionId: string): Promise<ReadonlyArray<ProviderTriggerState>> {
        const account = await this.connections.recordOf(workspaceId, connectionId)
        if (account === null) {
            throw new ProviderTriggersError({ code: ProviderTriggersErrorCode.UnknownAccount, params: { connectionId } })
        }
        const declared = triggersOf(account.provider)
        const [switches, coreDeciders, attached] = await Promise.all([
            this.triggers.switchesOf(workspaceId, connectionId),
            this.coreOf(account.provider, connectionId, declared),
            this.attachedOf(workspaceId, connectionId, declared),
        ])
        const cards = await (this.agents?.cardsOf(workspaceId, namedAgentsOf({ switches, coreDeciders, attached })) ?? [])
        const names = new Map(cards.map((card) => [card.id, card.name]))
        return triggerStatesOf({ connectionId, declared, switches, coreDeciders, attached, names })
    }

    /** The agent the provider's core path hands each decided trigger's events to on this account, by trigger name. */
    private async coreOf(
        provider: string,
        connectionId: string,
        declared: ReadonlyArray<ProviderTriggerDeclaration>,
    ): Promise<Readonly<Record<string, OptionalAgentId>>> {
        const entries = await Promise.all(
            declared
                .filter((declaration) => declaration.decided)
                .map(async (declaration): Promise<readonly [string, OptionalAgentId]> => [
                    declaration.name,
                    (await this.coreDeciders?.coreDeciderOf(provider, declaration.name, connectionId)) ?? null,
                ]),
        )
        return Object.fromEntries(entries)
    }

    /** The agents attached to the account, read only when one of its triggers is decided (a binding may name one of them). */
    private async attachedOf(
        workspaceId: string,
        connectionId: string,
        declared: ReadonlyArray<ProviderTriggerDeclaration>,
    ): Promise<ReadonlyArray<string>> {
        if (!declared.some((declaration) => declaration.decided)) return []
        return (await this.receivers?.attachedTo(workspaceId, connectionId)) ?? []
    }
}
