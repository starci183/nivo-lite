import { Injectable, Optional } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { NodeStepRef } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { AccountAttachmentsService, type ProviderAttachmentView } from "@modules/domain/tool-grants"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { ownersOfTool, toolSpecOf } from "@modules/domain/tool-specs"
import { eachInOrder } from "@modules/platform/primitives"
import { EffectRightAuditService, type EffectRightLine } from "./effect-right-audit.service"
import { accountLabelOf } from "./account-label.policy"
import { ABILITY_LABELS, KIND_LABELS, PROVIDER_LABELS, labelOf } from "./messages/provider-abilities.labels"
import {
    PROVIDER_CATALOGUE,
    bindNodeProviders,
    holdsTool,
    isProviderTool,
    judgeAttachment,
    providerSpecOf,
    providersOfDeclaration,
    servesTool,
    unpickedOf,
    type AccountTarget,
    type AttachmentVerdict,
    type OptionalRightVerdict,
    type PickNeeded,
    type RunAccountFacts,
} from "./provider-abilities.policy"
import { providersOfTemplateAgent } from "./template-agent-providers.policy"
import { keyUnder, nodeKeysOf, type OptionalNodeProviderKey } from "./node-provider-keys.policy"
import type {
    AccountView,
    AttachmentChangeResult,
    AttachmentRefusal,
    AttachmentWish,
    ProposedAttachment,
    ProviderBoard,
    TemplateCandidate,
    TemplateProposal,
} from "./agent-accounts.contracts"
import type { RightSeen } from "./right-origin.contracts"
import { InjectNodeRequestsGate } from "./node-requests.decorators"
import { seenAtStep, type StepSeen } from "./node-rule.policy"
import { workflowStepOf, type NodeRequestsGate, type OptionalNodeRequest } from "./node-mode.policy"

/** The most connections of one provider a workspace is read for. */
const CONNECTIONS_MAX = 20

/** The most earlier calls of a run read for the accounts the run already used. */
const RUN_CALLS_MAX = 200

/** The most agents of a workspace looked through for a template. */
const AGENTS_MAX = 200

/** One account a call may act on: its provider and its connection. */
export interface BoundAccount {
    /** The provider key. */
    readonly provider: string
    /** The connection. */
    readonly connectionId: string
}

/** The run a call is made in, as far as choosing its account needs it. */
export interface RunRef {
    /** The run (its trigger's context and its earlier calls are read by this id). */
    readonly runId: string
}

/** An account a call may act on, with whether it is the agent's default account of its provider (read from its attachment). */
interface ServingAccount extends BoundAccount {
    /** True when the attachment is the agent's default of its provider. */
    readonly isDefault: boolean
}

/** The account a call is handed: its provider and its connection only. */
const plainOf = ({ provider, connectionId }: BoundAccount): BoundAccount => ({ provider, connectionId })

/** The accounts a node binds, and the first listed provider of which the agent holds several accounts and no rule picks one. */
interface NodeBinding {
    /** The bound accounts, in the node's order of providers. */
    readonly bound: ReadonlyArray<BoundAccount>
    /** The first listed provider still to pick, or null. */
    readonly unpicked: PickNeeded | null
}

/**
 * True for a tool no registry places on a provider: no core spec, no owner (a source key) and no catalogue provider (a plugin's own tool
 * or effect, a fixture's). Such a tool is served by the providers its NODE lists (nivo-frame `templates`: the node lists its providers in
 * order), never by any account outside a node: the data says nothing else about it.
 */
export const isNodePlacedTool = (tool: string): boolean =>
    toolSpecOf(tool) === null && ownersOfTool(tool).length === 0 && !isProviderTool(tool)

/** The status of a connection that works. */
const CONNECTED = "connected"

/** One send of a channel-bound effect to judge: who sends, the effect, the conversation's own account, and the turn's workflow step. */
export interface SendJudged {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent of the turn. */
    readonly agentId: string
    /** The channel-bound effect (the customer send). */
    readonly effect: string
    /** The conversation's provider and its own connected account. */
    readonly target: AccountTarget
    /** The workflow step the node host named on the turn; absent for a turn outside a node run. */
    readonly step?: StepSeen | undefined
    /** The run of the turn, for the audit line of the verdict; absent when the caller knows none. */
    readonly runId?: string | undefined
    /** The conversation the send goes to, for the audit line of the verdict; absent when the caller knows none. */
    readonly conversationId?: string | undefined
}

/** The agent of a workspace that an attachment change is for. */
export interface AgentTarget {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}

/** The agent of a workspace and the module whose template's providers are attached. */
export interface AgentModuleTarget extends AgentTarget {
    /** The module. */
    readonly moduleKey: string
}

/** The owner's wishes for an attachment set, or null when the module's own proposal is meant. */
export type AttachmentWishes = ReadonlyArray<AttachmentWish> | null

/** The member who made a change, or null when the system did. */
export type UpdatedBy = string | null

/** The attachments created when an agent was given its defaults. */
export interface DefaultsAttached {
    /** Always true: the attachments were stored. */
    readonly ok: true
    /** The attachments created. */
    readonly attached: ReadonlyArray<ProposedAttachment>
}

/** The answer of giving an agent its defaults: the attachments created, or the refusal of the first wish that cannot be stored. */
export type DefaultsResult = DefaultsAttached | Refused

/** Why the wishes cannot be stored, or null when every one can. */
export type WishProblem = AttachmentRefusal | null

/** The ids of the agents a template attached, or the refusal. */
export type TemplateAttachResult = ReadonlyArray<string> | Refused

/**
 * Where a send was asked from: the node's step, or the engine's own (its line on a stop, or a turn the host named no step for). The engine's
 * line names no node: it is never the node's call.
 */
const sendSeenOf = (engineLine: boolean, step: StepSeen | undefined): RightSeen => {
    if (engineLine || step === undefined) return { origin: engineLine ? "engine_line" : "engine_job" }
    return seenAtStep("node", step)
}

/** A change that was refused. */
export type Refused = Extract<AttachmentChangeResult, { readonly ok: false }>

const refused = (reason: AttachmentRefusal): Refused => ({ ok: false, reason })

/**
 * The providers a fresh agent of a module is attached to (nivo-frame `rights`): the ones its TEMPLATE agent lists (`providersOfTemplateAgent`)
 * when the module ships one, else the ones its old declaration names (`providersOfDeclaration`). THE ONE reader of a module's default
 * providers: attaching gives these, and the pre-install review shows these. No tick and no mode: a call's mode is its node's.
 */
export const moduleProvidersOf = (moduleKey: string): ReadonlyArray<string> => {
    const agent = INSTALLED.templateAgentOf(moduleKey)
    return agent === null ? providersOfDeclaration(INSTALLED.abilityDefaultsOf(moduleKey)) : providersOfTemplateAgent(agent)
}

@Injectable()
/**
 * The ACCOUNTS of agents (nivo-frame `rights`): the one reader and writer of the attachments of agents to the accounts a workspace
 * connected, and the one judge of whether a call of a provider tool reaches an account. A hard right is two things only: the agent's
 * ATTACHMENTS (detach = the kill switch) and each node's declared mode. A provider SERVES tools (the catalogue, information); an agent is
 * attached to a CONNECTED ACCOUNT (one connection); connecting an account gives no agent anything. A module's template only proposes
 * attachments that do not exist (a fresh agent, the seed, "attach by template") and never touches one the workspace holds. Webhook intake is
 * the workspace connection's and is not judged here.
 */
export class AgentAccountsService {
    constructor(
        private readonly rows: AccountAttachmentsService,
        private readonly agents: AgentDirectoryService,
        @Optional() private readonly connections?: ConnectionBindingsReadService,
        @Optional() @InjectNodeRequestsGate() private readonly nodeRequests: NodeRequestsGate | null = null,
        @Optional() private readonly effectAudit?: EffectRightAuditService,
        @Optional() private readonly callLog?: ToolCallLogService,
        @Optional() private readonly runs?: AgentRunsService,
    ) {}

    /**
     * Files the verdict of an EFFECT in the audit (`EffectRightAuditService`): called where such a verdict is produced, by the channel
     * send's seam here and by the node tool door for every other effect a provider serves. Without the audit in the app nothing is written.
     */
    async effectJudged(line: EffectRightLine): Promise<void> {
        await this.effectAudit?.record(line)
    }

    /**
     * The key nodes name each of the agent's OpenAPI accounts by (the source its pinned document serves), read only when there is one;
     * undefined when there is none or no reader of connections is bound (each account then goes by its own provider).
     */
    private async nodeKeys(
        workspaceId: string,
        rows: ReadonlyArray<ProviderAttachmentView>,
    ): Promise<ReadonlyMap<string, OptionalNodeProviderKey> | undefined> {
        if (!rows.some((row) => row.provider === OPENAPI_PROVIDER)) return undefined
        return nodeKeysOf(workspaceId, rows, this.connections)
    }

    /** The reader of a step's pinned node request; null when no reader is bound or it cannot be read (the mode then refuses). */
    private readRequest(workspaceId: string, agentId: string): (step: NodeStepRef) => Promise<OptionalNodeRequest> {
        return (step) =>
            this.nodeRequests === null ? Promise.resolve(null) : this.nodeRequests.requestOf(workspaceId, agentId, step)
    }

    /**
     * THE KILL SWITCH of one call of a provider tool: the agent's attached account of a provider serving the tool (`allow`, with the
     * account), or `not_attached`; null when no provider serves the tool (or a provider-bound tool names no provider). A call naming its
     * account (the one the ToolRunner handed) counts only an attachment to that very account. No mode is read here.
     */
    async attachmentOf(
        workspaceId: string,
        agentId: string,
        tool: string,
        target: AccountTarget = {},
    ): Promise<AttachmentVerdict | null> {
        if (!isProviderTool(tool)) return null
        return judgeAttachment(await this.rows.listOfAgent(workspaceId, agentId), tool, target)
    }

    /**
     * The right of a turn's agent to a channel-bound effect (the customer send) on the conversation's own account: the one seam of the
     * channel's executor. It is the attachment to that very account (the kill switch), filed in the audit with the step that asked. The
     * node's mode is NOT read here: the tool door asked it at the call, before the executor ran (rights rule 11), so a send that reaches
     * the executor is an `auto` one or an approved one.
     */
    async judgeSend(send: SendJudged): Promise<OptionalRightVerdict> {
        return this.sendJudged(send, sendSeenOf(false, send.step))
    }

    /**
     * The right of the ENGINE's own line to the customer on a stop (its holding line): the engine's own call, sent as the agent that speaks
     * in the conversation, which must be attached to the conversation's account; once attached it runs (no node mode asks it).
     */
    async judgeEngineLine(send: SendJudged): Promise<OptionalRightVerdict> {
        return this.sendJudged(send, sendSeenOf(true, send.step))
    }

    /** One send judged (attached to the account) and filed in the audit, as seen from where it was asked. */
    private async sendJudged(send: SendJudged, seen: RightSeen): Promise<OptionalRightVerdict> {
        const { workspaceId, agentId, effect, target } = send
        const verdict = await this.attachmentOf(workspaceId, agentId, effect, target)
        if (verdict !== null) {
            await this.effectJudged({
                workspaceId,
                agentId,
                effect,
                verdict,
                seen,
                runId: send.runId,
                conversationId: send.conversationId,
            })
        }
        return verdict
    }

    /**
     * The accounts one call of the tool may act on, in order (the ToolRunner hands the first and falls back along the rest): at a
     * workflow step, for each provider the step's node lists, IN THE NODE'S ORDER, the agent's attached account of it serving the tool
     * (`bindNodeProviders`: one account per provider; of several, none: never a guess, the node names one); outside a step, every
     * attached account serving the tool, in the store's order. Of several attached accounts of one provider, the order `pickAccountOf`
     * names one: the account the RUN's trigger came in on, an account the run already used, then the agent's default account of the
     * provider (`run` names the run; without it only the default can be read).
     */
    async boundAccountsOf(
        workspaceId: string,
        agentId: string,
        tool: string,
        seen?: RightSeen,
        run?: RunRef,
    ): Promise<ReadonlyArray<BoundAccount>> {
        const step = workflowStepOf(seen)
        // A tool no registry places is served only by the providers a node lists: none outside a step.
        const placed = isNodePlacedTool(tool)
        if (placed && step === null) return []
        const named = await this.servingOf(workspaceId, agentId, tool, placed)
        if (step === null) return named.map(plainOf)
        return (await this.bindingOf(workspaceId, agentId, step, named, run)).bound
    }

    /**
     * The choice the owner still has to make for a call at a workflow step: the first provider its node lists, serving the tool, of which
     * the agent holds several attached accounts and no rule of the order picks one (`pickAccountOf`: the run's trigger, the run's earlier
     * calls, the agent's default account). Null when every listed provider binds or none has several accounts, outside a step, and when
     * the node's request cannot be read. It is what the typed `TOOLS_ACCOUNT_NEEDS_PICK` refusal names.
     */
    async pickNeeded(
        workspaceId: string,
        agentId: string,
        tool: string,
        seen?: RightSeen,
        run?: RunRef,
    ): Promise<PickNeeded | null> {
        const step = workflowStepOf(seen)
        if (step === null) return null
        const named = await this.servingOf(workspaceId, agentId, tool, isNodePlacedTool(tool))
        return (await this.bindingOf(workspaceId, agentId, step, named, run)).unpicked
    }

    /**
     * True when the call's workflow step lists at least one provider that serves the tool (nivo-frame `templates`: a tool takes an
     * account when its NODE lists providers that own it: the registry's owners or catalogue providers for a core tool, any listed provider
     * for a tool the node places, `isNodePlacedTool`). The call then acts only through an attached account of one of them, and none
     * attached is the kill switch (refused, never run on no account). False outside a step and for a node that lists none of them.
     */
    async listsProviders(workspaceId: string, agentId: string, tool: string, seen?: RightSeen): Promise<boolean> {
        const step = workflowStepOf(seen)
        if (step === null) return false
        const request = await this.readRequest(workspaceId, agentId)(step)
        const placed = isNodePlacedTool(tool)
        return (request?.accounts ?? []).some((account) => placed || servesTool(account.provider, account.provider, tool))
    }

    /**
     * The agent's attached accounts serving the tool, each under the provider key nodes name it by; for a tool the node places
     * (`isNodePlacedTool`), every attached account (the node's list of providers narrows it).
     */
    private async servingOf(
        workspaceId: string,
        agentId: string,
        tool: string,
        placed: boolean,
    ): Promise<ReadonlyArray<ServingAccount>> {
        const rows = await this.rows.listOfAgent(workspaceId, agentId)
        const keys = await this.nodeKeys(workspaceId, rows)
        return rows.flatMap((row) => {
            const provider = keyUnder(row, keys)
            return provider !== null && (placed || servesTool(provider, row.provider, tool))
                ? [{ provider, connectionId: row.connectionId, isDefault: row.isDefault === true }]
                : []
        })
    }

    /**
     * The attached accounts a step's node binds, in the node's order of providers (none when its request cannot be read), and the first
     * listed provider still to pick. Of several attached accounts of one provider the order `pickAccountOf` names one (never a guess):
     * the run's trigger, the run's earlier calls, the agent's default account of the provider. The run's facts are read only when a
     * listed provider has several accounts, so the single-account path reads nothing more than before.
     */
    private async bindingOf(
        workspaceId: string,
        agentId: string,
        step: NodeStepRef,
        named: ReadonlyArray<ServingAccount>,
        run: RunRef | undefined,
    ): Promise<NodeBinding> {
        const request = await this.readRequest(workspaceId, agentId)(step)
        if (request === null) return { bound: [], unpicked: null }
        const providers = request.accounts.map((account) => account.provider)
        const several = providers.some((provider) => named.filter((account) => account.provider === provider).length > 1)
        const facts = several && run !== undefined ? await this.runFactsOf(workspaceId, run) : undefined
        const defaultOf = (provider: string): string | null =>
            named.find((account) => account.provider === provider && account.isDefault)?.connectionId ?? null
        return {
            bound: bindNodeProviders(providers, named, defaultOf, facts).map(plainOf),
            unpicked: unpickedOf(providers, named, defaultOf, facts)[0] ?? null,
        }
    }

    /**
     * What the run tells about its accounts, from what the engine already records: the account its triggering event came in on (the
     * `connectionId` of the run's stored trigger context) and the accounts its earlier `ok` calls acted on (the tool call log of the
     * run, the most recent first). A reader that is not bound tells nothing.
     */
    private async runFactsOf(workspaceId: string, run: RunRef): Promise<RunAccountFacts> {
        const [started, used] = await Promise.all([
            this.runs?.runOf(workspaceId, run.runId) ?? Promise.resolve(null),
            this.callLog?.connectionsUsedByRun(workspaceId, run.runId, RUN_CALLS_MAX) ?? Promise.resolve([]),
        ])
        const trigger = started?.context.connectionId
        return { triggerConnectionId: typeof trigger === "string" && trigger !== "" ? trigger : null, usedConnectionIds: used }
    }

    /**
     * The accounts a read over several accounts may cover: the agent's attached accounts serving the tool, narrowed at a workflow step to
     * the providers its node lists (in its order).
     */
    async accountsOfAgent(
        workspaceId: string,
        agentId: string,
        tool: string,
        seen?: RightSeen,
    ): Promise<ReadonlyArray<string>> {
        const step = workflowStepOf(seen)
        const placed = isNodePlacedTool(tool)
        if (placed && step === null) return []
        const named = await this.servingOf(workspaceId, agentId, tool, placed)
        if (step === null) return named.map((row) => row.connectionId)
        const request = await this.readRequest(workspaceId, agentId)(step)
        const listed = request?.accounts.map((account) => account.provider) ?? []
        return listed.flatMap((provider) => named.filter((row) => row.provider === provider).map((row) => row.connectionId))
    }

    /** The agents of a workspace attached to an account of a provider serving any of the tools, by provider then agent. */
    async agentsHolding(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (!tools.some((tool) => isProviderTool(tool))) return []
        const rows = await this.rows.listOfWorkspace(workspaceId)
        return [...new Set(rows.filter((row) => tools.some((tool) => holdsTool(row, tool))).map((row) => row.agentId))]
    }

    /** Every provider with the tools it serves and the workspace's accounts of it, and every attachment of the workspace. */
    async board(workspaceId: string): Promise<ProviderBoard> {
        const [accounts, attachments] = await Promise.all([
            this.accountsOf(workspaceId),
            this.rows.listOfWorkspace(workspaceId),
        ])
        return {
            providers: PROVIDER_CATALOGUE.map((spec) => {
                const own = accounts.filter((account) => account.provider === spec.provider)
                return {
                    provider: spec.provider,
                    label: labelOf(PROVIDER_LABELS, spec.provider),
                    kind: spec.kind,
                    kindLabel: labelOf(KIND_LABELS, spec.kind),
                    connected: own.some((account) => account.connected),
                    abilities: spec.abilities.map((ability) => ({
                        id: ability.id,
                        label: labelOf(ABILITY_LABELS[spec.provider], ability.id),
                        scope: ability.scope,
                        tools: ability.tools,
                    })),
                    accounts: own,
                }
            }),
            attachments,
        }
    }

    /** What a fresh agent of a module would be attached to in this workspace: every working account of a provider its template lists. */
    async proposalOf(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<ProposedAttachment>> {
        const named = await this.templateProposal(workspaceId, moduleKey)
        return named.flatMap((entry) =>
            entry.connectionId === null ? [] : [{ connectionId: entry.connectionId, provider: entry.provider }],
        )
    }

    /**
     * Every line of a module's proposal, in catalogue order: one per working account of each provider its template lists
     * (`moduleProvidersOf`), and one line with no account for a listed provider the workspace has not connected (so a dialog can say "not
     * connected yet"). Nothing is written.
     */
    async templateProposal(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<TemplateProposal>> {
        const listed = new Set(moduleProvidersOf(moduleKey))
        const accounts = await this.servedAccountsOf(workspaceId, moduleKey, await this.accountsOf(workspaceId))
        return PROVIDER_CATALOGUE.filter((spec) => listed.has(spec.provider)).flatMap((spec): ReadonlyArray<TemplateProposal> => {
            const working = accounts.filter((account) => account.provider === spec.provider && account.connected)
            if (working.length === 0) {
                return [{ provider: spec.provider, connectionId: null, accountLabel: null, connected: false }]
            }
            return working.map((account) => ({
                provider: spec.provider,
                connectionId: account.connectionId,
                accountLabel: account.label,
                connected: true,
            }))
        })
    }

    /**
     * Gives an agent its attachments where it holds none: the owner's wishes when given (the edited proposal of a creation), else the
     * module's proposal. An attachment the agent already holds is left exactly as it is. Answers the attachments created, or the refusal of
     * the first wish that cannot be stored (nothing is written then).
     */
    async attachDefaults(target: AgentModuleTarget, wishes: AttachmentWishes, updatedBy: UpdatedBy): Promise<DefaultsResult> {
        const { workspaceId, agentId } = target
        const wanted =
            wishes === null ? await this.proposalOf(workspaceId, target.moduleKey) : await this.wished(workspaceId, wishes)
        if ("ok" in wanted) return wanted
        const made = await this.rows.insertMissing(
            wanted.map((entry) => ({ workspaceId, agentId, ...entry })),
            updatedBy,
        )
        return { ok: true, attached: made.map(({ connectionId, provider }) => ({ connectionId, provider })) }
    }

    /** Why the wishes cannot be stored in this workspace (the first that cannot), or null when every one can; nothing is written. */
    async wishProblem(workspaceId: string, wishes: ReadonlyArray<AttachmentWish>): Promise<WishProblem> {
        const wanted = await this.wished(workspaceId, wishes)
        return "ok" in wanted ? wanted.reason : null
    }

    /** Attaches an agent to a working account; an agent already attached is refused. */
    async attach(target: AgentTarget, wish: AttachmentWish, updatedBy: string): Promise<AttachmentChangeResult> {
        const wanted = await this.wished(target.workspaceId, [wish])
        if ("ok" in wanted) return wanted
        const [entry] = wanted
        if (entry === undefined) return refused("unknown_account")
        const outcome = await this.rows.attach({ ...target, ...entry }, updatedBy)
        if (outcome !== "attached") return refused(outcome === "held" ? "already_attached" : "unknown_agent")
        return { ok: true }
    }

    /** Detaches an agent from an account: the KILL SWITCH (no account, the tool is unavailable to the agent). */
    async detach(workspaceId: string, agentId: string, connectionId: string): Promise<AttachmentChangeResult> {
        if (!(await this.rows.detach(workspaceId, agentId, connectionId))) return refused("not_attached")
        return { ok: true }
    }

    /**
     * Makes the agent's attachment to an account the agent's DEFAULT account of its provider: what a step's call uses when the agent holds
     * several accounts of the provider and neither the run's trigger nor the run's earlier calls name one. The default it replaces
     * loses the flag (at most one per agent and provider). Refused `not_attached` when the agent holds no attachment to the account;
     * detaching the default clears it with its row.
     */
    async setDefault(target: AgentTarget, connectionId: string, updatedBy: string): Promise<AttachmentChangeResult> {
        const outcome = await this.rows.setDefault(target.workspaceId, target.agentId, connectionId, updatedBy)
        return outcome === "set" ? { ok: true } : refused("not_attached")
    }

    /**
     * Detaches an agent from every account it is attached to: what the removal of an agent does, since a removed agent holds no
     * right. A paused agent keeps its attachments (it comes back with them). Answers how many went.
     */
    async detachAgent(workspaceId: string, agentId: string): Promise<number> {
        return this.rows.detachAgent(workspaceId, agentId)
    }

    /**
     * The agents a template would attach to an account the workspace connected after they were created: every ACTIVE agent whose
     * module's template lists the account's provider (and is served by it) and that is not attached to that account yet. A removed or
     * paused agent is never one. The connect page asks once with this list.
     */
    async templateCandidates(workspaceId: string, connectionId: string): Promise<ReadonlyArray<TemplateCandidate>> {
        const account = (await this.accountsOf(workspaceId)).find((entry) => entry.connectionId === connectionId)
        const spec = account === undefined ? null : providerSpecOf(account.provider)
        if (account === undefined || spec === null) return []
        const [refs, attachments] = await Promise.all([
            this.agents.activeOf(workspaceId, AGENTS_MAX),
            this.rows.listOfWorkspace(workspaceId),
        ])
        const attached = new Set(
            attachments.filter((row) => row.connectionId === connectionId).map((row) => row.agentId),
        )
        const served = new Map<string, boolean>()
        await eachInOrder([...new Set(refs.map((ref) => ref.module))], async (module) => {
            const lists = moduleProvidersOf(module).includes(spec.provider)
            served.set(module, lists && (await this.servedAccountsOf(workspaceId, module, [account])).length > 0)
        })
        return refs
            .filter((ref) => !attached.has(ref.id) && served.get(ref.module) === true)
            .map((ref) => ({ agentId: ref.id, agentName: ref.name, module: ref.module }))
    }

    /**
     * Attaches the listed agents to a working account by their template: only agents the template names for its provider and that
     * are not attached to it yet (`templateCandidates`); any other id is passed over. Answers the agents attached.
     */
    async attachByTemplate(
        workspaceId: string,
        connectionId: string,
        agentIds: ReadonlyArray<string>,
        updatedBy: string,
    ): Promise<TemplateAttachResult> {
        const account = (await this.accountsOf(workspaceId)).find((entry) => entry.connectionId === connectionId)
        const problem = this.accountProblem(account)
        if (account === undefined || problem !== null) return refused(problem ?? "unknown_account")
        const candidates = (await this.templateCandidates(workspaceId, connectionId)).filter((entry) =>
            agentIds.includes(entry.agentId),
        )
        const made = await this.rows.insertMissing(
            candidates.map((entry) => ({ workspaceId, connectionId, provider: account.provider, agentId: entry.agentId })),
            updatedBy,
        )
        return made.map((record) => record.agentId)
    }

    /**
     * The accounts of the workspace: every connection of a provider of the catalogue, oldest first within a provider; none in an app
     * that reads no connections.
     */
    private async accountsOf(workspaceId: string): Promise<ReadonlyArray<AccountView>> {
        const { connections } = this
        if (connections === undefined) return []
        const held = await Promise.all(
            PROVIDER_CATALOGUE.map(async (spec) => {
                const found = await connections.ofProvider(workspaceId, spec.provider, CONNECTIONS_MAX)
                return Promise.all(
                    found.map(async (connection) => {
                        const record = await connections.recordOf(workspaceId, connection.id)
                        return {
                            connectionId: connection.id,
                            provider: spec.provider,
                            label: accountLabelOf(spec.provider, connection.name, record?.meta ?? {}),
                            connected: connection.status === CONNECTED,
                        }
                    }),
                )
            }),
        )
        return held.flat()
    }

    /**
     * The accounts a module's agent may be proposed: every account, except that for a module that ships a TEMPLATE agent an OpenAPI
     * account is proposed only when nodes name it by a source the agent lists (`nodeProviderKeyOf`: the source its pinned document
     * serves, `crm`); one pinned to none, or to another source, serves none of its nodes.
     */
    private async servedAccountsOf<A extends AccountView>(
        workspaceId: string,
        moduleKey: string,
        accounts: ReadonlyArray<A>,
    ): Promise<ReadonlyArray<A>> {
        const agent = INSTALLED.templateAgentOf(moduleKey)
        if (agent === null || !accounts.some((account) => account.provider === OPENAPI_PROVIDER)) return accounts
        const keys = await nodeKeysOf(workspaceId, accounts, this.connections)
        return accounts.filter((account) => {
            if (account.provider !== OPENAPI_PROVIDER) return true
            const key = keyUnder(account, keys)
            return key !== null && key !== OPENAPI_PROVIDER && agent.accounts.some((listed) => listed === key)
        })
    }

    /** Why no agent can be attached to the account, or null when one can. */
    private accountProblem(account: AccountView | undefined): AttachmentRefusal | null {
        const spec = account === undefined ? null : providerSpecOf(account.provider)
        if (account === undefined || spec === null) return "unknown_account"
        if (spec.abilities.length === 0) return "no_ability"
        return account.connected ? null : "not_connected"
    }

    /** The wishes as attachments to store, or the refusal of the first that cannot be. */
    private async wished(
        workspaceId: string,
        wishes: ReadonlyArray<AttachmentWish>,
    ): Promise<ReadonlyArray<ProposedAttachment> | Refused> {
        const accounts = await this.accountsOf(workspaceId)
        const judged = wishes.map((wish): ProposedAttachment | AttachmentRefusal => {
            const account = accounts.find((entry) => entry.connectionId === wish.connectionId)
            const problem = this.accountProblem(account)
            if (account === undefined || problem !== null) return problem ?? "unknown_account"
            return { connectionId: wish.connectionId, provider: account.provider }
        })
        const problem = judged.find((entry): entry is AttachmentRefusal => typeof entry === "string")
        if (problem !== undefined) return refused(problem)
        return judged.filter((entry): entry is ProposedAttachment => typeof entry !== "string")
    }
}
