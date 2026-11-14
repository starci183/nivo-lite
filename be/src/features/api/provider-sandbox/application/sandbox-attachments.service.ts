import { Injectable } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { ProviderTriggerStatesService } from "@modules/domain/provider-triggers"
import { ProviderSandboxAccountsService, type OpenedSandbox } from "@modules/domain/provider-sandbox"
import { ToolsConsoleService, ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import { eachInOrder } from "@modules/platform/primitives"
import type { SandboxAccountView } from "./provider-sandbox.contracts"

/** What one agent got on an account so far: its attachment (always) and whether its grant is bound (once it is). */
interface Made {
    /** The agent. */
    readonly agentId: string
    /** True once the agent's grant on the account is bound. */
    bound: boolean
}

/** Runs one step of the take-back: a step that fails must not hide the failure that made the take-back necessary. */
const attempt = async (step: () => Promise<void>): Promise<void> => {
    try {
        await step()
    } catch {
        // The original failure is the one the owner sees; what could not be taken back is unreachable once the account is removed.
    }
}

/** The existing refusal of an attachment, typed (`unknown_agent`, `not_attached`). */
const refusedAttachment = (reason: "unknown_agent" | "not_attached"): ToolsError =>
    new ToolsError({ code: ToolsErrorCode.AttachmentRefused, params: { reason } })

@Injectable()
/**
 * Gives a sandbox account to agents in ONE owner action, through the roads the owner would walk by hand and no other: attach the agent
 * (`ToolsConsoleService.attachProvider`), bind its grant where the agent may be bound to that provider
 * (`ConnectionGrantsService.setGrant`, so inbound lines start a run) and turn the provider's triggers on for the account
 * (`ProviderTriggerStatesService.setEnabled`: a sandbox account is a test account, so they are on). Those services each own their
 * transaction and take no shared one, so the steps run in order and a failure takes back what this call made (grants unbound,
 * attachments detached, a just-opened account removed), then rethrows the failure itself. Trigger switches turned on are left on: they
 * are the last step, and a switch of an account no agent holds delivers to nobody.
 */
export class SandboxAttachmentsService {
    constructor(
        private readonly accounts: ProviderSandboxAccountsService,
        private readonly tools: ToolsConsoleService,
        private readonly grants: ConnectionGrantsService,
        private readonly triggers: ProviderTriggerStatesService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /**
     * Opens a sandbox account and attaches it to each agent of `attachTo` (none when empty): all the agents are checked first (an agent
     * unknown or of another workspace refuses with the attachment's `unknown_agent` before anything is made); if a step fails after the
     * account exists, everything made is taken back and the account is removed.
     */
    async open(
        actor: ConnectionActor,
        input: { readonly provider: string; readonly name: string; readonly attachTo: ReadonlyArray<string> },
    ): Promise<OpenedSandbox> {
        await this.accounts.assertManager(actor)
        const agentIds = [...new Set(input.attachTo)]
        await this.requireKnown(actor.workspaceId, agentIds)
        const opened = await this.accounts.open(actor, { provider: input.provider, name: input.name })
        if (agentIds.length === 0) return opened
        const done: Array<Made> = []
        try {
            const bindable = await this.bindableOf(actor, input.provider)
            await eachInOrder(agentIds, (agentId) => this.give(actor, opened.id, agentId, bindable, done))
            await this.switchOn(actor, opened.id)
        } catch (failure) {
            await this.takeBack(actor, opened.id, done)
            await attempt(() => this.accounts.discard(actor, opened.id))
            throw failure
        }
        return opened
    }

    /** Attaches an agent to an existing sandbox account (attach, bind, triggers on); a failure takes back what this call made. */
    async attach(actor: ConnectionActor, connectionId: string, agentId: string): Promise<SandboxAccountView> {
        const account = await this.accounts.account(actor, connectionId)
        await this.requireKnown(actor.workspaceId, [agentId])
        const done: Array<Made> = []
        try {
            await this.give(actor, connectionId, agentId, await this.bindableOf(actor, account.provider), done)
            await this.switchOn(actor, connectionId)
        } catch (failure) {
            await this.takeBack(actor, connectionId, done)
            throw failure
        }
        return this.viewOf(actor, connectionId)
    }

    /**
     * Detaches an agent from a sandbox account: its grant is unbound where bound, then the attachment is removed. The account's
     * trigger switches stay as they are (other agents may hold it). An agent not attached is refused `not_attached` before anything
     * changes; if the detach itself fails after the unbinding, the binding is put back.
     */
    async detach(actor: ConnectionActor, connectionId: string, agentId: string): Promise<SandboxAccountView> {
        await this.accounts.account(actor, connectionId)
        const board = await this.tools.providerBoard(actor)
        if (!board.attachments.some((row) => row.connectionId === connectionId && row.agentId === agentId)) {
            throw refusedAttachment("not_attached")
        }
        const entry = (await this.grants.board(actor)).find((one) => one.connection.id === connectionId)
        const bound = entry?.grants.some((grant) => grant.agentId === agentId) === true
        if (bound) await this.grants.setGrant(actor, connectionId, agentId, false)
        try {
            await this.tools.detachProvider(actor, agentId, connectionId)
        } catch (failure) {
            if (bound) await attempt(() => this.grants.setGrant(actor, connectionId, agentId, true))
            throw failure
        }
        return this.viewOf(actor, connectionId)
    }

    /** The workspace's sandbox accounts, each with the agents it is attached to. */
    async list(actor: ConnectionActor): Promise<ReadonlyArray<SandboxAccountView>> {
        return this.viewsOf(actor, await this.accounts.accounts(actor))
    }

    /** One sandbox account with the agents it is attached to. */
    private async viewOf(actor: ConnectionActor, connectionId: string): Promise<SandboxAccountView> {
        const found = (await this.accounts.accounts(actor)).filter((record) => record.id === connectionId)
        const [view] = await this.viewsOf(actor, found)
        if (view === undefined) throw refusedAttachment("not_attached")
        return view
    }

    /** The accounts with their agents: one read of the attachments, one of the agents' names. */
    private async viewsOf(actor: ConnectionActor, records: ReadonlyArray<ConnectionRecord>): Promise<ReadonlyArray<SandboxAccountView>> {
        if (records.length === 0) return []
        const ids = new Set(records.map((record) => record.id))
        const attachments = (await this.tools.providerBoard(actor)).attachments.filter((row) => ids.has(row.connectionId))
        const cards = await this.agents.cardsOf(actor.workspaceId, [...new Set(attachments.map((row) => row.agentId))])
        const names = new Map(cards.map((card) => [card.id, card.name]))
        return records.map((account) => ({
            account,
            agents: attachments
                .filter((row) => row.connectionId === account.id)
                .map((row) => ({ id: row.agentId, label: names.get(row.agentId) ?? row.agentId })),
        }))
    }

    /** One agent's share of an account: attached, then bound where it may be bound to the provider. */
    private async give(
        actor: ConnectionActor,
        connectionId: string,
        agentId: string,
        bindable: ReadonlySet<string>,
        done: Array<Made>,
    ): Promise<void> {
        await this.tools.attachProvider(actor, agentId, { connectionId })
        const made: Made = { agentId, bound: false }
        done.push(made)
        if (!bindable.has(agentId)) return
        await this.grants.setGrant(actor, connectionId, agentId, true)
        made.bound = true
    }

    /** Takes back what was made, latest first: the bindings, then the attachments. */
    private async takeBack(actor: ConnectionActor, connectionId: string, done: ReadonlyArray<Made>): Promise<void> {
        await eachInOrder([...done].reverse(), async (made) => {
            if (made.bound) await attempt(() => this.grants.setGrant(actor, connectionId, made.agentId, false))
            await attempt(() => this.tools.detachProvider(actor, made.agentId, connectionId))
        })
    }

    /** Turns on every trigger the account's provider declares that is still off (a sandbox account is a test account). */
    private async switchOn(actor: ConnectionActor, connectionId: string): Promise<void> {
        const states = await this.triggers.statesOf(actor, connectionId)
        await eachInOrder(
            states.filter((state) => !state.enabled),
            async (state) => {
                await this.triggers.setEnabled(actor, { connectionId, trigger: state.name, enabled: true, catchUp: false })
            },
        )
    }

    /** The agents of the workspace that may be bound to an account of the provider. */
    private async bindableOf(actor: ConnectionActor, provider: string): Promise<ReadonlySet<string>> {
        const found = await this.grants.bindableAgents(actor.principalId, actor.workspaceId, provider)
        return new Set(found.map((one) => one.agentId))
    }

    /** Refuses with `unknown_agent` when one of the agents is not an agent of the workspace. */
    private async requireKnown(workspaceId: string, agentIds: ReadonlyArray<string>): Promise<void> {
        const known = new Set((await this.agents.cardsOf(workspaceId, agentIds)).map((card) => card.id))
        if (agentIds.some((agentId) => !known.has(agentId))) throw refusedAttachment("unknown_agent")
    }
}
