import { Injectable, Optional } from "@nestjs/common"
import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { McpConnectorAccessService } from "@modules/domain/mcp-tool-grants"
import type { AbilityMode, AbilityTicks, ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"
import { accountLabelOf } from "./account-label.policy"
import { ABILITY_LABELS, KIND_LABELS, PROVIDER_LABELS, labelOf } from "./messages/provider-abilities.labels"
import type { AbilityLabel } from "./messages/provider-abilities.labels"
import {
    PROVIDER_CATALOGUE,
    accountsHolding,
    cappedTicks,
    defaultAccountKindOf,
    exceedsCeiling,
    holdsTool,
    isAbilityTool,
    judgeAbility,
    providerSpecOf,
    ticksOfTemplate,
    ticksOfWish,
} from "./provider-abilities.policy"
import type { AbilityVerdict, AccountTarget, ProviderKind, ProviderSpec } from "./provider-abilities.policy"

/** The most connections of one provider a workspace is read for. */
const CONNECTIONS_MAX = 20

/** The most agents of a workspace looked through for a template. */
const AGENTS_MAX = 200

/** The status of a connection that works. */
const CONNECTED = "connected"

/** One ability as the console draws it. */
export interface AbilityView {
    /** The ability id. */
    readonly id: string
    /** Its name in business words. */
    readonly label: AbilityLabel
    /** `read` (ticked or not) or `write` (ticked `auto` or `ask`). */
    readonly scope: "read" | "write"
    /** The tools it holds. */
    readonly tools: ReadonlyArray<string>
}

/** One connected account of a provider: the thing an agent is attached to. */
export interface AccountView {
    /** The connection. */
    readonly connectionId: string
    /** The provider it is an account of. */
    readonly provider: string
    /** The name of the connection (the account it reaches). */
    readonly label: string
    /** True when the connection works: only then can an agent be attached to it. */
    readonly connected: boolean
    /** True when it is the workspace's default account of its kind (the account a payment QR is drawn on). */
    readonly isDefault: boolean
}

/** One provider as the console draws it: its abilities once, and the workspace's accounts of it. */
export interface ProviderView {
    /** The provider key. */
    readonly provider: string
    /** Its name. */
    readonly label: AbilityLabel
    /** Its kind (a display category, and the key of a module's defaults). */
    readonly kind: ProviderKind
    /** The name of its kind. */
    readonly kindLabel: AbilityLabel
    /** True when the workspace holds at least one working account of it. */
    readonly connected: boolean
    /** Its abilities; none means no agent can be attached to an account of it yet. */
    readonly abilities: ReadonlyArray<AbilityView>
    /** The workspace's accounts of it, oldest first. */
    readonly accounts: ReadonlyArray<AccountView>
}

/** The rights of a workspace's agents: the providers with their abilities and accounts, and every attachment. */
export interface ProviderBoard {
    /** Every provider of the catalogue. */
    readonly providers: ReadonlyArray<ProviderView>
    /** Every attachment of the workspace. */
    readonly attachments: ReadonlyArray<ProviderAttachmentView>
}

/** One attachment to store: an account and the abilities ticked on it. */
export interface ProposedAttachment {
    /** The connected account. */
    readonly connectionId: string
    /** The provider of that account. */
    readonly provider: string
    /** The abilities ticked. */
    readonly abilities: AbilityTicks
}

/**
 * One line of a module's proposal for a fresh agent: a connected account with the abilities the module's defaults tick on it, or a
 * provider the module names that the workspace has not connected (no account, no ability: it is only named).
 */
export interface TemplateProposal {
    /** The provider. */
    readonly provider: string
    /** The connected account, or null for a provider that is not connected. */
    readonly connectionId: string | null
    /** The name of the account, or null. */
    readonly accountLabel: string | null
    /** True for a working account. */
    readonly connected: boolean
    /** The abilities ticked; none on a provider that is not connected. */
    readonly abilities: AbilityTicks
}

/** One attachment a person asks for: an account, and each ability `off`, `auto` or `ask` (an ability left out is off). */
export interface AttachmentWish {
    /** The connected account. */
    readonly connectionId: string
    /** The abilities wanted, by id. */
    readonly abilities: Readonly<Record<string, string>>
}

/** An agent a template would attach to an account, with the ticks it proposes. */
export interface TemplateCandidate {
    /** The agent. */
    readonly agentId: string
    /** Its name. */
    readonly agentName: string
    /** Its module. */
    readonly module: string
    /** The abilities the template ticks. */
    readonly abilities: AbilityTicks
}

/** Why a change of an attachment was not made. */
export type AttachmentRefusal =
    | "unknown_account"
    | "no_ability"
    | "not_connected"
    | "unknown_agent"
    | "unknown_ability"
    | "already_attached"
    | "not_attached"
    | "owner_only"
    | "no_default_ability"

/**
 * Who makes a change: the owner may tick anything; a manager may tick a write ability `ask` or `off`, never `auto` (letting an agent
 * act on an account by itself is the owner's to give). A template applied for a manager ticks its write abilities `ask`.
 */
export type RightsGiver = "owner" | "manager"

/** What a change of an attachment came to. */
export type AttachmentChangeResult = { readonly ok: true } | { readonly ok: false; readonly reason: AttachmentRefusal }

/** A change that was refused. */
type Refused = Extract<AttachmentChangeResult, { readonly ok: false }>

const refused = (reason: AttachmentRefusal): Refused => ({ ok: false, reason })

/** A template's attachments as the giver may give them: a manager's write abilities ask first, the owner's stay as the template has them. */
const capped = <T extends { readonly provider: string; readonly abilities: AbilityTicks }>(
    entries: ReadonlyArray<T>,
    giver: RightsGiver,
): ReadonlyArray<T> =>
    giver === "owner"
        ? entries
        : entries.map((entry) => {
              const spec = providerSpecOf(entry.provider)
              return spec === null ? entry : { ...entry, abilities: cappedTicks(spec, entry.abilities) }
          })

/** The default abilities a module declares for its agent, or undefined when it declares none. */
const templateOf = (moduleKey: string) =>
    MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent?.abilities

/**
 * The ticks a template gives on one account: its ticks for the provider, except that among the accounts of a provider whose tool
 * acts on a default account (payment) only the default one is ticked, the others get none.
 */
const templateTicksOn = (spec: ProviderSpec, account: AccountView, ticks: AbilityTicks): AbilityTicks =>
    takesDefault(spec) && !account.isDefault ? {} : ticks

/** True for a provider with an ability whose tool acts on the workspace's default account of the provider's kind. */
const takesDefault = (spec: ProviderSpec): boolean => spec.abilities.some((ability) => ability.account === "default")

/**
 * The default account of a kind among a workspace's accounts: the one the owner named when it still works, else the only working
 * account of the kind that can be one, else none (with several and no choice, nothing is chosen for the owner).
 */
const defaultOf = (accounts: ReadonlyArray<AccountView>, kind: ProviderKind, named: string | null): string | null => {
    const able = accounts.filter((account) => {
        const spec = providerSpecOf(account.provider)
        return account.connected && spec !== null && spec.kind === kind && takesDefault(spec)
    })
    if (named !== null && able.some((account) => account.connectionId === named)) return named
    const [only, second] = able
    return only !== undefined && second === undefined ? only.connectionId : null
}

@Injectable()
/**
 * The rights of agents on the accounts a workspace connected ("Quyền"): the one judge of a call of a provider tool and the one
 * writer of attachments. Three tiers: a KIND (messaging, payment, books) is what a module's defaults are declared by; a PROVIDER
 * declares the abilities; a CONNECTED ACCOUNT (one connection: one Zalo OA, one bank account, one sheet) is what an agent is attached
 * to and where its abilities are ticked (a write `auto` or `ask`). Connecting an account gives no agent anything. Defaults come from
 * the module's declaration and are only ever a proposal: they fill an attachment that does not exist (a fresh agent, the seed, "attach
 * by template") and never touch one the workspace holds. Webhook intake is the workspace connection's and is not judged here.
 */
export class ProviderAbilitiesService {
    constructor(
        private readonly rows: McpConnectorAccessService,
        private readonly agents: AgentDirectoryService,
        @Optional() private readonly connections?: ConnectionBindingsReadService,
    ) {}

    /**
     * What the calling agent's attachments decide about one call, or null when the tool is no provider right (see `judgeAbility`).
     * A tool that names its account is judged on that account alone: the caller gives it (`target`: the connection of the conversation
     * a send goes to), or the tool acts on the workspace's default account of a kind (a payment QR: the default receiving account),
     * which is read here; a workspace with no such default is refused `no_default_account`, never given an account chosen for it.
     */
    async judge(
        workspaceId: string,
        agentId: string,
        tool: string,
        approved: boolean,
        target: AccountTarget = {},
    ): Promise<AbilityVerdict | null> {
        if (!isAbilityTool(tool)) return null
        const rows = await this.rows.listOfAgent(workspaceId, agentId)
        const kind = target.connectionId === undefined ? defaultAccountKindOf(tool) : null
        if (kind === null) return judgeAbility(rows, tool, approved, target)
        const connectionId = await this.defaultAccountOf(workspaceId, kind)
        if (connectionId !== null) return judgeAbility(rows, tool, approved, { connectionId })
        const none = judgeAbility([], tool, approved)
        return none === null || none.kind !== "refuse" ? none : { ...none, reason: "no_default_account" }
    }

    /** The accounts on which the agent holds a ticked ability with the tool: what a read over several accounts may cover. */
    async accountsOfAgent(workspaceId: string, agentId: string, tool: string): Promise<ReadonlyArray<string>> {
        return accountsHolding(await this.rows.listOfAgent(workspaceId, agentId), tool)
    }

    /** The agents of a workspace holding a ticked ability that has any of the tools, by provider then agent. */
    async agentsHolding(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (!tools.some(isAbilityTool)) return []
        const rows = await this.rows.listOfWorkspace(workspaceId)
        return [...new Set(rows.filter((row) => tools.some((tool) => holdsTool(row, tool))).map((row) => row.agentId))]
    }

    /**
     * The tools an agent holds through its ticked abilities, each in the mode it runs in (`ask` when a tick that has it asks); a
     * channel-bound tool is left out, since only a conversation tells its account.
     */
    async heldTools(
        workspaceId: string,
        agentId: string,
    ): Promise<ReadonlyArray<{ readonly tool: string; readonly mode: AbilityMode }>> {
        const rows = await this.rows.listOfAgent(workspaceId, agentId)
        const tools = new Set(
            PROVIDER_CATALOGUE.flatMap((spec) =>
                spec.abilities.filter((ability) => ability.channels === undefined).flatMap((ability) => ability.tools),
            ),
        )
        return [...tools].flatMap((tool) => {
            const verdict = judgeAbility(rows, tool, false)
            if (verdict === null || verdict.kind === "refuse") return []
            return [{ tool, mode: verdict.kind === "approval" ? ("ask" as const) : ("auto" as const) }]
        })
    }

    /** The workspace's default account of a kind (the default receiving account for `payment`), or null when it has none. */
    async defaultAccountOf(workspaceId: string, kind: ProviderKind): Promise<string | null> {
        const [accounts, named] = await Promise.all([
            this.accountsOf(workspaceId),
            this.rows.defaultAccountOf(workspaceId, kind),
        ])
        return defaultOf(accounts, kind, named)
    }

    /**
     * Names an account the workspace's default of its kind (the owner's choice of the receiving account). Only a working account of a
     * provider whose tool acts on a default account can be one.
     */
    async setDefaultAccount(
        workspaceId: string,
        connectionId: string,
        updatedBy: string,
    ): Promise<AttachmentChangeResult> {
        const account = (await this.accountsOf(workspaceId)).find((entry) => entry.connectionId === connectionId)
        const spec = account === undefined ? null : providerSpecOf(account.provider)
        if (account === undefined || spec === null) return refused("unknown_account")
        if (!account.connected) return refused("not_connected")
        if (!takesDefault(spec)) return refused("no_default_ability")
        await this.rows.setDefaultAccount(workspaceId, spec.kind, connectionId, updatedBy)
        return { ok: true }
    }

    /** Every provider with its abilities and the workspace's accounts of it, and every attachment of the workspace. */
    async board(workspaceId: string): Promise<ProviderBoard> {
        const [accounts, attachments] = await Promise.all([
            this.markedAccountsOf(workspaceId),
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

    /**
     * What a fresh agent of a module would be attached to in this workspace: every working account of a provider the module's
     * declaration names (by kind or by key) on which the template ticks something. The owner edits it before creating; nothing is
     * written here.
     */
    async proposalOf(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<ProposedAttachment>> {
        const named = await this.templateProposal(workspaceId, moduleKey)
        return named.flatMap((entry) =>
            entry.connectionId === null || Object.keys(entry.abilities).length === 0
                ? []
                : [{ connectionId: entry.connectionId, provider: entry.provider, abilities: entry.abilities }],
        )
    }

    /**
     * Every line of a module's proposal: one per working account of each provider its declaration names, pre-ticked by the kind's
     * defaults (of the accounts of a kind that has a default account, payment, only the default one is pre-ticked: the others are
     * listed with nothing ticked, since money is received on one account), and one line with no account and NO ability for a named provider the workspace has not connected (so a dialog can say
     * "not connected yet", and no client can send it pre-ticked). The declaration's abilities for such a provider apply only once an
     * account of it is connected, through `templateCandidates` / `attachByTemplate`.
     */
    async templateProposal(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<TemplateProposal>> {
        const template = templateOf(moduleKey)
        const accounts = await this.markedAccountsOf(workspaceId)
        return PROVIDER_CATALOGUE.flatMap((spec): ReadonlyArray<TemplateProposal> => {
            const abilities = ticksOfTemplate(template, spec)
            if (abilities === null) return []
            const working = accounts.filter((account) => account.provider === spec.provider && account.connected)
            if (working.length === 0) {
                return [
                    {
                        provider: spec.provider,
                        connectionId: null,
                        accountLabel: null,
                        connected: false,
                        abilities: {},
                    },
                ]
            }
            return working.map((account) => ({
                provider: spec.provider,
                connectionId: account.connectionId,
                accountLabel: account.label,
                connected: true,
                abilities: templateTicksOn(spec, account, abilities),
            }))
        })
    }

    /**
     * Gives an agent its attachments where it holds none: the owner's wishes when given (the edited proposal of a creation), else the
     * module's proposal. An attachment the agent already holds is left exactly as it is, so a reseed or a new version of a module never
     * changes a right the workspace holds. Answers the attachments created, or the refusal of the first wish that cannot be stored
     * (nothing is written then).
     */
    async attachDefaults(
        target: { readonly workspaceId: string; readonly agentId: string; readonly moduleKey: string },
        wishes: ReadonlyArray<AttachmentWish> | null,
        updatedBy: string | null,
        giver: RightsGiver = "owner",
    ): Promise<{ readonly ok: true; readonly attached: ReadonlyArray<ProposedAttachment> } | Refused> {
        const { workspaceId, agentId } = target
        const wanted =
            wishes === null
                ? capped(await this.proposalOf(workspaceId, target.moduleKey), giver)
                : await this.wished(workspaceId, wishes, giver)
        if ("ok" in wanted) return wanted
        const made = await this.rows.insertMissing(
            wanted.map((entry) => ({ workspaceId, agentId, ...entry })),
            updatedBy,
        )
        return {
            ok: true,
            attached: made.map(({ connectionId, provider, abilities }) => ({ connectionId, provider, abilities })),
        }
    }

    /** Why the wishes cannot be stored in this workspace (the first that cannot), or null when every one can; nothing is written. */
    async wishProblem(
        workspaceId: string,
        wishes: ReadonlyArray<AttachmentWish>,
        giver: RightsGiver = "owner",
    ): Promise<AttachmentRefusal | null> {
        const wanted = await this.wished(workspaceId, wishes, giver)
        return "ok" in wanted ? wanted.reason : null
    }

    /** Attaches an agent to a working account with the abilities wanted; an agent already attached is refused (tick it instead). */
    async attach(
        target: { readonly workspaceId: string; readonly agentId: string },
        wish: AttachmentWish,
        updatedBy: string,
        giver: RightsGiver = "owner",
    ): Promise<AttachmentChangeResult> {
        const wanted = await this.wished(target.workspaceId, [wish], giver)
        if ("ok" in wanted) return wanted
        const [entry] = wanted
        if (entry === undefined) return refused("unknown_account")
        const outcome = await this.rows.attach({ ...target, ...entry }, updatedBy)
        if (outcome === "attached") return { ok: true }
        return refused(outcome === "held" ? "already_attached" : "unknown_agent")
    }

    /** Detaches an agent from an account; every tick on it goes with it. */
    async detach(workspaceId: string, agentId: string, connectionId: string): Promise<AttachmentChangeResult> {
        return (await this.rows.detach(workspaceId, agentId, connectionId)) ? { ok: true } : refused("not_attached")
    }

    /**
     * Detaches an agent from every account it is attached to: what the removal of an agent does, since a removed agent holds no
     * right. A paused agent keeps its attachments (it comes back with them). Answers how many went.
     */
    detachAgent(workspaceId: string, agentId: string): Promise<number> {
        return this.rows.detachAgent(workspaceId, agentId)
    }

    /** Ticks an ability (`auto` or `ask`; a read ability is stored `auto`), or unticks it (`off`), on an attachment that exists. */
    async setAbility(
        target: { readonly workspaceId: string; readonly agentId: string; readonly connectionId: string },
        ability: string,
        mode: string,
        updatedBy: string,
        giver: RightsGiver = "owner",
    ): Promise<AttachmentChangeResult> {
        const account = (await this.accountsOf(target.workspaceId)).find(
            (entry) => entry.connectionId === target.connectionId,
        )
        const spec = account === undefined ? null : providerSpecOf(account.provider)
        if (spec === null) return refused("unknown_account")
        const wished = ticksOfWish(spec, { [ability]: mode })
        if (!wished.ok) return refused("unknown_ability")
        if (giver !== "owner" && exceedsCeiling(spec, wished.ticks)) return refused("owner_only")
        const stored: AbilityMode | null = wished.ticks[ability] ?? null
        const outcome = await this.rows.setAbility({ ...target, ability, mode: stored, updatedBy })
        return outcome === "set" ? { ok: true } : refused("not_attached")
    }

    /**
     * The agents a template would attach to an account the workspace connected after they were created: every ACTIVE agent whose
     * module's declaration names the account's provider and that is not attached to that account yet. A removed agent is never one
     * (it is paused for good and holds no right); a paused agent is not proposed while it is paused and is again once it is resumed.
     * The connect page asks once with this list.
     */
    async templateCandidates(workspaceId: string, connectionId: string): Promise<ReadonlyArray<TemplateCandidate>> {
        const account = (await this.markedAccountsOf(workspaceId)).find((entry) => entry.connectionId === connectionId)
        const spec = account === undefined ? null : providerSpecOf(account.provider)
        if (account === undefined || spec === null) return []
        const [refs, attachments] = await Promise.all([
            this.agents.activeOf(workspaceId, AGENTS_MAX),
            this.rows.listOfWorkspace(workspaceId),
        ])
        const attached = new Set(
            attachments.filter((row) => row.connectionId === connectionId).map((row) => row.agentId),
        )
        const proposed = refs.flatMap((ref) => {
            const named = attached.has(ref.id) ? null : ticksOfTemplate(templateOf(ref.module), spec)
            const abilities = named === null ? {} : templateTicksOn(spec, account, named)
            return Object.keys(abilities).length === 0 ? [] : [{ ...ref, abilities }]
        })
        return proposed.map((entry) => ({
            agentId: entry.id,
            agentName: entry.name,
            module: entry.module,
            abilities: entry.abilities,
        }))
    }

    /**
     * Attaches the listed agents to a working account by their template: only agents the template names for its provider and that
     * are not attached to it yet (`templateCandidates`); any other id is passed over, a removed or paused agent among them, so
     * nothing is ever attached to an agent that is not working. Answers the agents attached.
     */
    async attachByTemplate(
        workspaceId: string,
        connectionId: string,
        agentIds: ReadonlyArray<string>,
        updatedBy: string,
        giver: RightsGiver = "owner",
    ): Promise<ReadonlyArray<string> | Refused> {
        const account = (await this.accountsOf(workspaceId)).find((entry) => entry.connectionId === connectionId)
        const problem = this.accountProblem(account)
        if (account === undefined || problem !== null) return refused(problem ?? "unknown_account")
        const candidates = (await this.templateCandidates(workspaceId, connectionId)).filter((entry) =>
            agentIds.includes(entry.agentId),
        )
        const made = await this.rows.insertMissing(
            capped(
                candidates.map((entry) => ({
                    provider: account.provider,
                    agentId: entry.agentId,
                    abilities: entry.abilities,
                })),
                giver,
            ).map((entry) => ({ workspaceId, connectionId, ...entry })),
            updatedBy,
        )
        return made.map((record) => record.agentId)
    }

    /**
     * The accounts of the workspace: every connection of a provider of the catalogue, oldest first within a provider; none in an app
     * that reads no connections. `isDefault` is not told here (see `markedAccountsOf`).
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
                            isDefault: false,
                        }
                    }),
                )
            }),
        )
        return held.flat()
    }

    /** The accounts with the default account of each kind marked. */
    private async markedAccountsOf(workspaceId: string): Promise<ReadonlyArray<AccountView>> {
        const accounts = await this.accountsOf(workspaceId)
        const kinds = [...new Set(PROVIDER_CATALOGUE.filter(takesDefault).map((spec) => spec.kind))]
        const defaults = await Promise.all(
            kinds.map(async (kind) => defaultOf(accounts, kind, await this.rows.defaultAccountOf(workspaceId, kind))),
        )
        return accounts.map((account) => ({ ...account, isDefault: defaults.includes(account.connectionId) }))
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
        giver: RightsGiver,
    ): Promise<ReadonlyArray<ProposedAttachment> | Refused> {
        const accounts = await this.accountsOf(workspaceId)
        const judged = wishes.map((wish): ProposedAttachment | AttachmentRefusal => {
            const account = accounts.find((entry) => entry.connectionId === wish.connectionId)
            const problem = this.accountProblem(account)
            const spec = account === undefined ? null : providerSpecOf(account.provider)
            if (account === undefined || spec === null || problem !== null) return problem ?? "unknown_account"
            const ticks = ticksOfWish(spec, wish.abilities)
            if (!ticks.ok) return "unknown_ability"
            if (giver !== "owner" && exceedsCeiling(spec, ticks.ticks)) return "owner_only"
            return { connectionId: wish.connectionId, provider: account.provider, abilities: ticks.ticks }
        })
        const problem = judged.find((entry): entry is AttachmentRefusal => typeof entry === "string")
        if (problem !== undefined) return refused(problem)
        return judged.filter((entry): entry is ProposedAttachment => typeof entry !== "string")
    }
}
