import { Injectable } from "@nestjs/common"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import type { GraphDocument } from "@modules/domain/agent-graphs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { AgentTemplatesError, AgentTemplatesErrorCode } from "./errors/agent-templates.error"
import { AgentTemplateVersionsService } from "./agent-template-versions.service"
import type {
    PackageDraft,
    PackagePreview,
    ParameterBinding,
    RequiredPlugin,
    StarterKnowledge,
    TemplateListingText,
    TemplateParameter,
    TemplatePersona,
    TemplateVersionView,
    TemplateView,
} from "./agent-templates.contracts"
import { canonicalJson, previewPackage } from "@nivo-lite/agent-sdk/template"

/** What the creator gives to package one version of an agent. */
export interface PackageRequest {
    /** The workspace of the creator. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The frozen graph version to package. */
    readonly graphVersionId: string
    /** The key of the template. */
    readonly key: string
    /** The card. */
    readonly listing: TemplateListingText
    /** The settings of the buyer. */
    readonly parameters: ReadonlyArray<TemplateParameter>
    /** Where they land. */
    readonly bindings: ReadonlyArray<ParameterBinding>
    /** The published public documents to start the buyer with. */
    readonly starterDocumentIds: ReadonlyArray<string>
    /** The voice and the person. */
    readonly persona: TemplatePersona
    /** The plug-ins the graph needs. */
    readonly requiresPlugins: ReadonlyArray<RequiredPlugin>
    /** What changed. */
    readonly changelog: string
    /** True when the buyer must read it before taking it. */
    readonly breaking: boolean
}

/** The template sources of a graph that name a key other than the one being packaged. */
const foreignKeysOf = (graph: GraphDocument, own: string): ReadonlyArray<string> => [
    ...new Set(
        graph.nodes.flatMap((node) =>
            [...node.sources, ...(node.decide?.branches.flatMap((branch) => branch.sources) ?? [])].flatMap((source) =>
                source.kind === "template" && source.key !== own ? [source.key] : [],
            ),
        ),
    ),
]

@Injectable()
/**
 * Packages the process of an agent. Only the owner of the creator workspace packages, from a frozen published version, by the allowlist
 * packager; a version that holds branches of a template someone else made is refused, so a bought process is not resold as a new one.
 * The public documents come only from the published ones the creator names, never from the internal Brain.
 */
export class AgentTemplatesService {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly installations: InstallationRecordsService,
        private readonly members: WorkspaceMembersService,
        private readonly documents: PublicDocumentsService,
        private readonly versions: AgentTemplateVersionsService,
    ) {}

    /** What packaging a version would keep and leave out, writing nothing. */
    async preview(userId: string, request: PackageRequest): Promise<PackagePreview> {
        const prepared = await this.prepare(userId, request)
        return previewPackage(prepared.graph, prepared.draft)
    }

    /** Packages a version and saves it for good. Refused, writing nothing, when the preview has a problem. */
    async packageVersion(userId: string, request: PackageRequest): Promise<TemplateVersionView> {
        const prepared = await this.prepare(userId, request)
        const foreign = foreignKeysOf(prepared.graph, request.key)
        for (const key of foreign) {
            const owner = await this.versions.templateOf(key)
            if (owner?.creatorAccountId !== userId && owner?.firstParty !== true) {
                throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.ForeignTemplate, params: { key } })
            }
        }
        const preview = previewPackage(prepared.graph, prepared.draft)
        if (preview.package === null) {
            throw new AgentTemplatesError({
                code: AgentTemplatesErrorCode.PackageRefused,
                params: { count: preview.problems.length },
            })
        }
        return this.versions.save({
            package: preview.package,
            creatorAccountId: userId,
            sourceWorkspaceId: request.workspaceId,
            changelog: request.changelog,
            breaking: request.breaking,
        })
    }

    /** The templates of the caller's account. */
    mine(userId: string): Promise<ReadonlyArray<TemplateView>> {
        return this.versions.listOf(userId)
    }

    /** The package of one version of a template of the caller's account as a file: canonical JSON that reads back to the same hash. */
    async exportFile(userId: string, key: string, version: number): Promise<string> {
        const stored = await this.versions.require(key, version)
        if (stored.creatorAccountId !== userId)
            throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.NotYours })
        return canonicalJson(stored.package)
    }

    private async prepare(
        userId: string,
        request: PackageRequest,
    ): Promise<{ readonly graph: GraphDocument; readonly draft: PackageDraft }> {
        const member = await this.members.require(userId, request.workspaceId, ["owner"])
        const state = await this.graphs.stateOfAgent(request.workspaceId, request.agentId)
        if (state === null) throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.GraphVersionNotFound })
        const installation = await this.installations.findById(state.installationId)
        if (installation === null) throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.GraphVersionNotFound })
        const frozen = await this.frozen(request)
        const existing = await this.versions.templateOf(request.key)
        if (existing !== null && existing.creatorAccountId !== userId) {
            throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.KeyTaken })
        }
        const published = await this.documents.list(userId, request.workspaceId)
        const starter: ReadonlyArray<StarterKnowledge> = published.flatMap((document) =>
            request.starterDocumentIds.includes(document.id) &&
            document.status === "published" &&
            document.publishedBody !== null
                ? [{ title: document.title, body: document.publishedBody }]
                : [],
        )
        return {
            graph: frozen,
            draft: {
                key: request.key,
                version: (await this.versions.latestNumber(request.key)) + 1,
                publisher: { creatorId: userId, displayName: member.displayName },
                baseModule: installation.moduleKey,
                requiresPlugins: request.requiresPlugins,
                listing: request.listing,
                parameters: request.parameters,
                bindings: request.bindings,
                starterKnowledge: starter,
                persona: request.persona,
                forbidden: [request.workspaceId, request.agentId, state.installationId, request.graphVersionId, userId],
            },
        }
    }

    private async frozen(request: PackageRequest): Promise<GraphDocument> {
        try {
            return (await this.graphs.versionAt(request.workspaceId, request.agentId, request.graphVersionId)).document
        } catch (cause) {
            throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.GraphVersionNotFound, cause })
        }
    }
}
