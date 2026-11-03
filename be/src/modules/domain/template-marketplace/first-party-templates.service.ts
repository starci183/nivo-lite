import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import { baseGraphOf } from "@modules/domain/agent-graphs"
import type { SeedRule } from "@modules/domain/agent-graphs"
import {
    AgentTemplatesError,
    AgentTemplatesErrorCode,
    AgentTemplateVersionsService,
    TemplateInstallEntity,
    TemplateLicenseEntity,
} from "@modules/domain/agent-templates"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { AdminAccessService } from "@modules/domain/platform-admin"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { hashOfPackage, previewPackage, TEMPLATE_KEY_PATTERN } from "@nivo/agent-sdk/template"
import type {
    AgentTemplatePackage,
    GraphDocument,
    PackageDraft,
    ParameterBinding,
    TemplateParameter,
    TemplateVersionView,
} from "@nivo/agent-sdk/template"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateListingsService } from "./template-listings.service"
import { TemplateListingEntity } from "./persistence/entities"

/** The publisher of every first-party package: the platform itself, one fixed account no person logs in as. */
export const NIVO_PUBLISHER_ID: string = "00000000-0000-4000-8000-00000000a1b0"

/** The key of the first-party package of a built-in module. */
export const firstPartyKeyOf = (moduleKey: string): string => `nivo-${moduleKey}`

/** What a sync did. */
export interface FirstPartySyncReport {
    /** The keys that got a new version. */
    readonly packaged: ReadonlyArray<string>
    /** The keys whose latest version already says what the module seed says. */
    readonly unchanged: ReadonlyArray<string>
    /** The keys the packager refused. */
    readonly refused: ReadonlyArray<string>
    /** How many installations were recorded as installs of their first-party package. */
    readonly adopted: number
}

/** What a creator gives to start from a first-party package. */
export interface ForkRequest {
    /** The workspace the creator names, whose owner they are. */
    readonly workspaceId: string
    /** The first-party key. */
    readonly sourceKey: string
    /** The key of the derivative. */
    readonly key: string
}

/** The most installations one sync adopts in a page. */
const PAGE = 200

/** The most parameters a first-party package derives from its graph. */
const MAX_DERIVED = 20

/** The rule a module gives its action before any workspace sets its own: what the catalogue says, asking the owner. */
const defaultRuleOf = (action: ModuleDefinition["authorityActions"][number]): SeedRule => ({
    action: action.action,
    mode: action.mode,
    unit: "vnd",
    limit_vnd: action.limitVnd,
    auto_max: null,
    ask_max: null,
    approver_roles: ["owner"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 240,
})

/** The settings a built-in module offers its buyer: the wait of every approver its seed names, with today's wait as the default. */
const parametersOf = (
    graph: GraphDocument,
): { readonly parameters: ReadonlyArray<TemplateParameter>; readonly bindings: ReadonlyArray<ParameterBinding> } => {
    const waits = graph.nodes
        .flatMap((node) => (node.decide?.branches ?? []).map((branch) => ({ node: node.key, branch })))
        .flatMap(({ node, branch }) =>
            branch.approver === null ? [] : [{ node, key: branch.key, minutes: branch.approver.timeoutMinutes }],
        )
        .slice(0, MAX_DERIVED)
    return {
        bindings: waits.map((wait): ParameterBinding => ({
            parameter: `${wait.node}_${wait.key}_wait`,
            target: "branch_timeout",
            nodeKey: wait.node,
            branchKey: wait.key,
        })),
        parameters: waits.map((wait): TemplateParameter => ({
            key: `${wait.node}_${wait.key}_wait`,
            kind: "number",
            label: { vi: `${wait.node} / ${wait.key}`, en: `${wait.node} / ${wait.key}` },
            hint: null,
            min: 1,
            max: 10_080,
            required: false,
            default: wait.minutes,
        })),
    }
}

@Injectable()
/**
 * The built-in modules of the catalogue as first-party packages of the one mechanism: each is built from the seed graph of the module
 * and listed as approved by the platform, so built-in and creator agents install, update and customise the same way. Installations that
 * already run are recorded as installs of the package, and nothing about their graph changes. A creator can start from a first-party
 * package, keep its provenance, and list the derivative.
 */
export class FirstPartyTemplatesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly modules: ModulesService,
        private readonly automation: AutomationTemplatesService,
        private readonly versions: AgentTemplateVersionsService,
        private readonly listings: TemplateListingsService,
        private readonly installations: InstallationRecordsService,
        private readonly access: AdminAccessService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Packages every module of the catalogue whose seed changed, lists the new version as approved, and records the installations that have no provenance yet. */
    async sync(principal: Principal): Promise<FirstPartySyncReport> {
        this.access.requireAdmin(principal)
        const catalog = await this.modules.catalog()
        const templates = await this.automation.listTemplates()
        const packaged: Array<string> = []
        const unchanged: Array<string> = []
        const refused: Array<string> = []
        for (const module of catalog.modules) {
            const key = firstPartyKeyOf(module.key)
            const graph = baseGraphOf(
                module,
                templates.filter((template) => template.moduleKey === module.key),
                module.authorityActions.map((action) => defaultRuleOf(action)),
                { locale: "vi", say: (word, params) => this.catalog.get(word, params ?? {}, "vi") },
            )
            const latest = await this.versions.latestNumber(key)
            const same = latest > 0 ? previewPackage(graph, this.draftOf(module, graph, latest)).package : null
            const stored = latest > 0 ? await this.versions.find(key, latest) : null
            if (same !== null && stored?.hash === same.hash) {
                unchanged.push(key)
                continue
            }
            const made = previewPackage(graph, this.draftOf(module, graph, latest + 1))
            if (made.package === null) {
                refused.push(key)
                continue
            }
            await this.versions.save({
                package: made.package,
                creatorAccountId: NIVO_PUBLISHER_ID,
                sourceWorkspaceId: null,
                changelog: `Seed of the ${module.key} module`,
                breaking: false,
                firstParty: true,
            })
            await this.entityManager.insert(TemplateListingEntity, {
                templateKey: key,
                version: latest + 1,
                status: "approved",
                priceVnd: 0,
                revenueSharePct: 0,
                checks: [],
                reviewNote: "First-party package of the catalogue",
                firstParty: true,
                submittedBy: null,
            })
            packaged.push(key)
        }
        return { packaged, unchanged, refused, adopted: await this.adoptMissing() }
    }

    /** Starts a template of the caller from a first-party package: the same process and parameters, its own key, the provenance of every branch kept. */
    async fork(userId: string, request: ForkRequest): Promise<TemplateVersionView> {
        const member = await this.members.require(userId, request.workspaceId, ["owner"])
        if (!TEMPLATE_KEY_PATTERN.test(request.key)) {
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.ForkNotAllowed })
        }
        const source = await this.versions.templateOf(request.sourceKey)
        const latest = await this.listings.latestApproved(request.sourceKey)
        if (source?.firstParty !== true || latest === 0) {
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.ForkNotAllowed })
        }
        if ((await this.versions.templateOf(request.key)) !== null) {
            throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.KeyTaken })
        }
        const stored = await this.versions.require(request.sourceKey, latest)
        const origin = stored.package
        const body: Omit<AgentTemplatePackage, "hash"> = {
            format: origin.format,
            baseModule: origin.baseModule,
            requiresPlugins: origin.requiresPlugins,
            listing: origin.listing,
            parameters: origin.parameters,
            bindings: origin.bindings,
            proposedRights: origin.proposedRights,
            requiredProviders: origin.requiredProviders,
            requiredAuthorityActions: origin.requiredAuthorityActions,
            starterKnowledge: origin.starterKnowledge,
            persona: origin.persona,
            key: request.key,
            version: 1,
            publisher: { creatorId: userId, displayName: member.displayName },
            graph: {
                ...origin.graph,
                nodes: origin.graph.nodes.map((node) => ({
                    ...node,
                    sources: [...node.sources, { kind: "template" as const, key: request.key, version: 1 }].slice(-10),
                    ...(node.decide === undefined
                        ? {}
                        : {
                              decide: {
                                  ...node.decide,
                                  branches: node.decide.branches.map((branch) => ({
                                      ...branch,
                                      sources: [
                                          ...branch.sources,
                                          { kind: "template" as const, key: request.key, version: 1 },
                                      ].slice(-10),
                                  })),
                              },
                          }),
                })),
            },
        }
        return this.versions.save({
            package: { ...body, hash: hashOfPackage(body) },
            creatorAccountId: userId,
            sourceWorkspaceId: null,
            changelog: `Forked from ${request.sourceKey} version ${latest}`,
            breaking: false,
            forkedFrom: request.sourceKey,
        })
    }

    /** Records each installation of a built-in module that has no provenance as an install of version 1 of its first-party package; its graph is not touched. */
    private async adoptMissing(): Promise<number> {
        let adopted = 0
        let after = "00000000-0000-0000-0000-000000000000"
        for (;;) {
            const page = await this.installations.page(after, PAGE)
            if (page.length === 0) return adopted
            for (const installation of page) {
                after = installation.id
                const key = firstPartyKeyOf(installation.moduleKey)
                const known = await this.entityManager.findOne(TemplateInstallEntity, {
                    where: { installationId: installation.id },
                })
                if (known !== null || (await this.versions.find(key, 1)) === null) continue
                const license = await this.entityManager.insert(TemplateLicenseEntity, {
                    workspaceId: installation.workspaceId,
                    templateKey: key,
                    kind: "free",
                    listingId: null,
                    orderId: null,
                    installationId: installation.id,
                    status: "active",
                })
                await this.entityManager.insert(TemplateInstallEntity, {
                    installationId: installation.id,
                    workspaceId: installation.workspaceId,
                    templateKey: key,
                    version: 1,
                    parameterValues: {},
                    licenseId:
                        license.identifiers[0]?.["id"] === undefined ? null : String(license.identifiers[0]["id"]),
                    installedBy: null,
                })
                adopted += 1
            }
        }
    }

    private draftOf(module: ModuleDefinition, graph: GraphDocument, version: number): PackageDraft {
        const derived = parametersOf(graph)
        return {
            key: firstPartyKeyOf(module.key),
            version,
            publisher: { creatorId: NIVO_PUBLISHER_ID, displayName: "Nivo" },
            baseModule: module.key,
            requiresPlugins: [],
            listing: {
                name: module.name,
                summary: module.description,
                points: module.points.vi.map((vi, index) => ({ vi, en: module.points.en[index] ?? vi })),
                category: module.category,
            },
            parameters: derived.parameters,
            bindings: derived.bindings,
            starterKnowledge: [],
            persona: { soul: "", likeness: null },
            forbidden: [],
        }
    }
}
