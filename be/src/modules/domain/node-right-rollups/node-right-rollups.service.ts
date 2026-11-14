import { Injectable, Optional } from "@nestjs/common"
import {
    AgentRightsStandingService,
    AgentStepTitlesService,
    AgentWorkflowsAdminService,
} from "@modules/domain/agent-graphs"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import {
    OPENAPI_PROVIDER,
    accountFactsOf,
    installedDeclarationsOf,
    pinnedReadingOf,
} from "@modules/domain/openapi-tools"
import { ProviderOfferService, type ProviderOffer } from "@modules/domain/provider-offer"
import { ProviderTriggerStatesService } from "@modules/domain/provider-triggers"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { NodeRightRollupsError, NodeRightRollupsErrorCode } from "./errors/node-right-rollups.error"
import type {
    AgentNodeRights,
    ProviderRightHolders,
    MaybeTemplateVersion,
    RollupActor,
    TemplateNodeRequests,
} from "./node-right-rollups.contracts"
import {
    agentRightsOf,
    providerHoldersOf,
    templateRequestsOf,
    type ClosedOperation,
    type TriggerDecider,
} from "./node-right-rollups.policy"

/** The most connected accounts one page names. */
const ACCOUNT_LIMIT = 200

@Injectable()
/**
 * THE ROLL-UPS of what nodes call, for any member of the workspace, read-only information derived from the node tools: what each
 * running workflow node calls on its agent's attached accounts and in which declared mode, and, for one connected account, which agent,
 * workflow and step calls each operation of its provider. A third read says what a TEMPLATE's nodes ask for before anything is installed.
 * Every step is named with the title its installed node declares. Nothing here calls a provider, and nothing here changes a right.
 */
export class NodeRightRollupsService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly rights: AgentRightsStandingService,
        private readonly offers: ProviderOfferService,
        private readonly access: AccountAttachmentsService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly agents: AgentDirectoryService,
        private readonly templates: AgentWorkflowsAdminService,
        private readonly titles: AgentStepTitlesService,
        @Optional() private readonly triggers?: ProviderTriggerStatesService,
    ) {}

    /**
     * What the nodes of a template version (the newest when none is named) ask for on accounts: node, account kind, operation and the
     * node's declared mode. The review of a create-agent dialog, before anything is installed. Any member; a template of a private
     * plugin closed to the workspace is the not-found of an unknown one.
     */
    async templateRequests(
        actor: RollupActor,
        templateId: string,
        version: MaybeTemplateVersion,
    ): Promise<TemplateNodeRequests> {
        const open = await this.templates.template(actor, { templateId })
        const at = version ?? open.latestVersion
        const graph = INSTALLED.templateOf(templateId)?.versions.find((entry) => entry.version === at)?.graph
        if (graph === undefined) {
            const params = { templateId, version: String(at) }
            throw new NodeRightRollupsError({ code: NodeRightRollupsErrorCode.TemplateVersionNotFound, params })
        }
        return templateRequestsOf(templateId, at, graph)
    }

    /** The rights page of one agent: its attached accounts, what each offers a node, and what its running nodes ask for. */
    async agentRights(actor: RollupActor, agentId: string): Promise<AgentNodeRights> {
        const { workspaceId, principalId } = actor
        await this.members.require(principalId, workspaceId)
        const [known] = await this.agents.identitiesOf(workspaceId, [agentId])
        if (known === undefined) {
            throw new NodeRightRollupsError({ code: NodeRightRollupsErrorCode.AgentNotFound, params: { agentId } })
        }
        const attachments = await this.access.listOfAgent(workspaceId, agentId)
        const connectionIds = attachments.map((attachment) => attachment.connectionId)
        const [standing, facts, offered] = await Promise.all([
            this.rights.standingOf(workspaceId),
            this.bindings.factsOf(connectionIds, ACCOUNT_LIMIT),
            Promise.all(connectionIds.map((connectionId) => this.offers.offerOf(actor, connectionId))),
        ])
        return agentRightsOf({
            agentId,
            attachments,
            names: new Map(facts.map((fact) => [fact.id, fact.name])),
            offers: new Map(offered.map((offer): readonly [string, ProviderOffer] => [offer.connectionId, offer])),
            standing: standing.filter((workflow) => workflow.agentId === agentId),
            stepTitleOf: (step) => this.titles.titleOf(step),
        })
    }

    /** The rights tab of one connected account: every right of its provider with who holds it; refused for an account of no such id. */
    async providerHolders(actor: RollupActor, connectionId: string): Promise<ProviderRightHolders> {
        const { workspaceId } = actor
        const offer = await this.offers.offerOf(actor, connectionId)
        const [standing, attachments, closed, deciders] = await Promise.all([
            this.rights.standingOf(workspaceId),
            this.access.listOfWorkspace(workspaceId),
            this.closedOf(workspaceId, offer),
            this.decidersOf(actor, connectionId),
        ])
        const attached = attachments.filter((row) => row.connectionId === connectionId).map((row) => row.agentId)
        const named = [
            ...new Set([
                ...standing.map((workflow) => workflow.agentId),
                ...attached,
                ...deciders.flatMap((entry) => entry.agentId ?? []),
            ]),
        ]
        const identities = await this.agents.identitiesOf(workspaceId, named)
        return providerHoldersOf({
            offer,
            closed,
            standing,
            agentNames: new Map(identities.map((identity) => [identity.id, identity.name])),
            attached: new Set(attached),
            deciders,
            stepTitleOf: (step) => this.titles.titleOf(step),
        })
    }

    /** The decider each trigger of the account is bound to; none in an app with no trigger switches. */
    private async decidersOf(actor: RollupActor, connectionId: string): Promise<ReadonlyArray<TriggerDecider>> {
        const states = (await this.triggers?.statesOf(actor, connectionId)) ?? []
        return states.map((state) => ({ name: state.name, agentId: state.deciderAgentId }))
    }

    /**
     * The operations of the account's PINNED document that no installed plugin declares as a tool, for an account of the OpenAPI
     * provider: listed as not open, since no agent can be given them. Read from what the connection stores.
     */
    private async closedOf(workspaceId: string, offer: ProviderOffer): Promise<ReadonlyArray<ClosedOperation>> {
        if (offer.provider !== OPENAPI_PROVIDER) return []
        const record = await this.bindings.recordOf(workspaceId, offer.connectionId)
        const facts = record === null ? null : accountFactsOf(record.meta)
        const document = record === null ? null : pinnedReadingOf(record.meta)
        if (facts === null || document === null) return []
        const declared = new Set(installedDeclarationsOf(facts.connector).map((declaration) => declaration.tool))
        return [...document.operations.values()]
            .filter((operation) => !declared.has(operation.toolId))
            .map((operation) => ({
                operationId: operation.operationId,
                method: operation.method,
                path: operation.path,
            }))
    }
}
