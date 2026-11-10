import { Injectable, Optional } from "@nestjs/common"
import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { McpConnectorAccessService } from "@modules/domain/mcp-tool-grants"
import type { AbilityMode, AbilityTicks, ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"
import { ABILITY_LABELS, KIND_LABELS, PROVIDER_LABELS, labelOf } from "./messages/provider-abilities.labels"
import type { AbilityLabel } from "./messages/provider-abilities.labels"
import {
    PROVIDER_CATALOGUE,
    holdsTool,
    isAbilityTool,
    judgeAbility,
    providerSpecOf,
    ticksOfTemplate,
    ticksOfWish,
} from "./provider-abilities.policy"
import type { AbilityVerdict, ProviderKind, ProviderSpec } from "./provider-abilities.policy"

/** The most connections of one provider looked at to say whether it is connected. */
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

/** One provider as the console draws it. */
export interface ProviderView {
    /** The provider key. */
    readonly provider: string
    /** Its name. */
    readonly label: AbilityLabel
    /** Its kind (a display category). */
    readonly kind: ProviderKind
    /** The name of its kind. */
    readonly kindLabel: AbilityLabel
    /** True when the workspace holds a working connection of it. */
    readonly connected: boolean
    /** Its abilities; none means no agent can be attached to it yet. */
    readonly abilities: ReadonlyArray<AbilityView>
}

/** The rights of a workspace's agents on its providers: the providers with their abilities, and every attachment. */
export interface ProviderBoard {
    /** Every provider of the catalogue. */
    readonly providers: ReadonlyArray<ProviderView>
    /** Every attachment of the workspace. */
    readonly attachments: ReadonlyArray<ProviderAttachmentView>
}

/** One attachment a template proposes, or a person asks for: a provider and the abilities ticked. */
export interface ProposedAttachment {
    /** The provider. */
    readonly provider: string
    /** The abilities ticked. */
    readonly abilities: AbilityTicks
}

/** One attachment a person asks for: each ability `off`, `auto` or `ask`; an ability left out is off. */
export interface AttachmentWish {
    /** The provider. */
    readonly provider: string
    /** The abilities wanted, by id. */
    readonly abilities: Readonly<Record<string, string>>
}

/** An agent a template would attach to a provider, with the ticks it proposes. */
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
    | "unknown_provider"
    | "no_ability"
    | "not_connected"
    | "unknown_agent"
    | "unknown_ability"
    | "already_attached"
    | "not_attached"

/** What a change of an attachment came to. */
export type AttachmentChangeResult = { readonly ok: true } | { readonly ok: false; readonly reason: AttachmentRefusal }

const refused = (reason: AttachmentRefusal): AttachmentChangeResult => ({ ok: false, reason })

const viewOf = (spec: ProviderSpec, connected: boolean): ProviderView => ({
    provider: spec.provider,
    label: labelOf(PROVIDER_LABELS, spec.provider),
    kind: spec.kind,
    kindLabel: labelOf(KIND_LABELS, spec.kind),
    connected,
    abilities: spec.abilities.map((ability) => ({
        id: ability.id,
        label: labelOf(ABILITY_LABELS[spec.provider], ability.id),
        scope: ability.scope,
        tools: ability.tools,
    })),
})

/** The default abilities a module declares for its agent, or undefined when it declares none. */
const templateOf = (moduleKey: string) =>
    MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent?.abilities

@Injectable()
/**
 * The rights of agents on the providers a workspace connected ("Quyền"): the one judge of a call of a provider tool and the one
 * writer of attachments. A provider is connected once for the workspace, which gives no agent anything; an agent is attached to any
 * number of providers, and on each the owner ticks abilities (a write `auto` or `ask`). Defaults come from the module's declaration and
 * are only ever a proposal: they fill an attachment that does not exist (a fresh agent, the seed, "attach by template") and never touch
 * one the workspace holds. Webhook intake is the workspace connection's and is not judged here.
 */
export class ProviderAbilitiesService {
    constructor(
        private readonly rows: McpConnectorAccessService,
        private readonly agents: AgentDirectoryService,
        @Optional() private readonly connections?: ConnectionBindingsReadService,
    ) {}

    /**
     * What the calling agent's attachments decide about one call, or null when the tool is no provider right (see `judgeAbility`). A
     * channel-bound tool is judged only with the provider its executor read from the conversation.
     */
    async judge(
        workspaceId: string,
        agentId: string,
        tool: string,
        approved: boolean,
        provider?: string,
    ): Promise<AbilityVerdict | null> {
        if (!isAbilityTool(tool)) return null
        return judgeAbility(await this.rows.listOfAgent(workspaceId, agentId), tool, approved, provider)
    }

    /** The agents of a workspace holding a ticked ability that has any of the tools, by provider then agent. */
    async agentsHolding(workspaceId: string, tools: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (!tools.some(isAbilityTool)) return []
        const rows = await this.rows.listOfWorkspace(workspaceId)
        return [...new Set(rows.filter((row) => tools.some((tool) => holdsTool(row, tool))).map((row) => row.agentId))]
    }

    /**
     * The tools an agent holds through its ticked abilities, each in the mode it runs in (`ask` when a tick that has it asks); a
     * channel-bound tool is left out, since only a conversation tells its provider.
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

    /** The providers of the catalogue the workspace holds a working connection of; none in an app that reads no connections. */
    async connectedProviders(workspaceId: string): Promise<ReadonlyArray<string>> {
        const { connections } = this
        if (connections === undefined) return []
        const held = await Promise.all(
            PROVIDER_CATALOGUE.map(async (spec) => {
                const found = await connections.ofProvider(workspaceId, spec.provider, CONNECTIONS_MAX)
                return found.some((connection) => connection.status === CONNECTED) ? [spec.provider] : []
            }),
        )
        return held.flat()
    }

    /** Every provider with its abilities and whether it is connected, and every attachment of the workspace. */
    async board(workspaceId: string): Promise<ProviderBoard> {
        const [connected, attachments] = await Promise.all([
            this.connectedProviders(workspaceId),
            this.rows.listOfWorkspace(workspaceId),
        ])
        return {
            providers: PROVIDER_CATALOGUE.map((spec) => viewOf(spec, connected.includes(spec.provider))),
            attachments,
        }
    }

    /**
     * What a fresh agent of a module would be attached to in this workspace: every connected provider the module's declaration names
     * (by kind or by key), with the abilities it ticks. The owner edits it before creating; nothing is written here.
     */
    async proposalOf(workspaceId: string, moduleKey: string): Promise<ReadonlyArray<ProposedAttachment>> {
        const template = templateOf(moduleKey)
        const connected = await this.connectedProviders(workspaceId)
        return PROVIDER_CATALOGUE.flatMap((spec) => {
            const abilities = connected.includes(spec.provider) ? ticksOfTemplate(template, spec) : null
            return abilities === null ? [] : [{ provider: spec.provider, abilities }]
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
    ): Promise<{ readonly ok: true; readonly attached: ReadonlyArray<ProposedAttachment> } | Extract<AttachmentChangeResult, { ok: false }>> {
        const { workspaceId, agentId } = target
        const wanted = wishes === null ? await this.proposalOf(workspaceId, target.moduleKey) : await this.wished(workspaceId, wishes)
        if ("ok" in wanted) return wanted
        const made = await this.rows.insertMissing(
            wanted.map((entry) => ({ workspaceId, agentId, provider: entry.provider, abilities: entry.abilities })),
            updatedBy,
        )
        return { ok: true, attached: made.map((record) => ({ provider: record.provider, abilities: record.abilities })) }
    }

    /** Attaches an agent to a connected provider with the abilities wanted; an agent already attached is refused (tick it instead). */
    async attach(
        target: { readonly workspaceId: string; readonly agentId: string },
        wish: AttachmentWish,
        updatedBy: string,
    ): Promise<AttachmentChangeResult> {
        const wanted = await this.wished(target.workspaceId, [wish])
        if ("ok" in wanted) return wanted
        const [entry] = wanted
        if (entry === undefined) return refused("unknown_provider")
        const outcome = await this.rows.attach({ ...target, provider: entry.provider, abilities: entry.abilities }, updatedBy)
        if (outcome === "attached") return { ok: true }
        return refused(outcome === "held" ? "already_attached" : "unknown_agent")
    }

    /** Detaches an agent from a provider; every tick on it goes with it. */
    async detach(workspaceId: string, agentId: string, provider: string): Promise<AttachmentChangeResult> {
        return (await this.rows.detach(workspaceId, agentId, provider)) ? { ok: true } : refused("not_attached")
    }

    /** Ticks an ability (`auto` or `ask`; a read ability is stored `auto`), or unticks it (`off`), on an attachment that exists. */
    async setAbility(
        target: { readonly workspaceId: string; readonly agentId: string; readonly provider: string },
        ability: string,
        mode: string,
        updatedBy: string,
    ): Promise<AttachmentChangeResult> {
        const spec = providerSpecOf(target.provider)
        if (spec === null) return refused("unknown_provider")
        const wished = ticksOfWish(spec, { [ability]: mode })
        if (!wished.ok) return refused("unknown_ability")
        const stored: AbilityMode | null = wished.ticks[ability] ?? null
        const outcome = await this.rows.setAbility({ ...target, ability, mode: stored, updatedBy })
        return outcome === "set" ? { ok: true } : refused("not_attached")
    }

    /**
     * The agents a template would attach to a provider the workspace connected after they were created: every agent whose module's
     * declaration names the provider and that is not attached to it yet. The connect page asks once with this list.
     */
    async templateCandidates(workspaceId: string, provider: string): Promise<ReadonlyArray<TemplateCandidate>> {
        const spec = providerSpecOf(provider)
        if (spec === null) return []
        const [refs, attachments] = await Promise.all([
            this.agents.moduleRefsOf(workspaceId, AGENTS_MAX),
            this.rows.listOfWorkspace(workspaceId),
        ])
        const attached = new Set(attachments.filter((row) => row.provider === provider).map((row) => row.agentId))
        const proposed = refs.flatMap((ref) => {
            const abilities = attached.has(ref.id) ? null : ticksOfTemplate(templateOf(ref.module), spec)
            return abilities === null ? [] : [{ ...ref, abilities }]
        })
        const cards = await this.agents.cardsOf(
            workspaceId,
            proposed.map((entry) => entry.id),
        )
        const names = new Map(cards.map((card) => [card.id, card.name]))
        return proposed.flatMap((entry) => {
            const agentName = names.get(entry.id)
            return agentName === undefined
                ? []
                : [{ agentId: entry.id, agentName, module: entry.module, abilities: entry.abilities }]
        })
    }

    /**
     * Attaches the listed agents to a connected provider by their template: only agents the template names for it and that are not
     * attached yet (`templateCandidates`); any other id is passed over. Answers the agents attached.
     */
    async attachByTemplate(
        workspaceId: string,
        provider: string,
        agentIds: ReadonlyArray<string>,
        updatedBy: string,
    ): Promise<ReadonlyArray<string> | Extract<AttachmentChangeResult, { ok: false }>> {
        const problem = await this.providerProblem(workspaceId, provider)
        if (problem !== null) return { ok: false, reason: problem }
        const candidates = (await this.templateCandidates(workspaceId, provider)).filter((entry) =>
            agentIds.includes(entry.agentId),
        )
        const made = await this.rows.insertMissing(
            candidates.map((entry) => ({ workspaceId, agentId: entry.agentId, provider, abilities: entry.abilities })),
            updatedBy,
        )
        return made.map((record) => record.agentId)
    }

    /** Why no agent can be attached to the provider in this workspace, or null when one can. */
    private async providerProblem(workspaceId: string, provider: string): Promise<AttachmentRefusal | null> {
        const spec = providerSpecOf(provider)
        if (spec === null) return "unknown_provider"
        if (spec.abilities.length === 0) return "no_ability"
        return (await this.connectedProviders(workspaceId)).includes(provider) ? null : "not_connected"
    }

    /** The wishes as attachments to store, or the refusal of the first that cannot be. */
    private async wished(
        workspaceId: string,
        wishes: ReadonlyArray<AttachmentWish>,
    ): Promise<ReadonlyArray<ProposedAttachment> | Extract<AttachmentChangeResult, { ok: false }>> {
        const connected = await this.connectedProviders(workspaceId)
        const judged = wishes.map((wish): ProposedAttachment | AttachmentRefusal => {
            const spec = providerSpecOf(wish.provider)
            if (spec === null) return "unknown_provider"
            if (spec.abilities.length === 0) return "no_ability"
            if (!connected.includes(wish.provider)) return "not_connected"
            const ticks = ticksOfWish(spec, wish.abilities)
            return ticks.ok ? { provider: wish.provider, abilities: ticks.ticks } : "unknown_ability"
        })
        const problem = judged.find((entry): entry is AttachmentRefusal => typeof entry === "string")
        if (problem !== undefined) return { ok: false, reason: problem }
        return judged.filter((entry): entry is ProposedAttachment => typeof entry !== "string")
    }
}
