import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { baseGraphOf } from "@modules/domain/agent-graphs"
import {
    AgentTemplatesError,
    AgentTemplatesErrorCode,
    AgentTemplateVersionsService,
    TemplateRecordsService,
} from "@modules/domain/agent-templates"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { ModulesService, type ModuleDefinition } from "@modules/domain/modules"
import { AdminAccessService } from "@modules/domain/platform-admin"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Principal } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import {
    hashOfPackage,
    previewPackage,
    TEMPLATE_KEY_PATTERN,
    type AgentTemplatePackage,
    type PackageDraft,
    type TemplateVersionView,
} from "@nivo-lite/agent-sdk/template"
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
        private readonly versions: AgentTemplateVersionsService,
        private readonly records: TemplateRecordsService,
        private readonly listings: TemplateListingsService,
        private readonly installations: InstallationRecordsService,
        private readonly access: AdminAccessService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Packages every module of the catalogue whose seed changed, lists the new version as approved, and records the installations that have no provenance yet. */
    async sync(principal: Principal): Promise<FirstPartySyncReport> {
        this.access.requireAdmin(principal)
        const catalog = await this.modules.catalog()
        const packaged: Array<string> = []
        const unchanged: Array<string> = []
        const refused: Array<string> = []
        await eachInOrder(catalog.modules, async (module) => {
            const key = firstPartyKeyOf(module.key)
            const graph = baseGraphOf(module, {
                locale: "vi",
                say: (word, params) => this.catalog.get(word, params ?? {}, "vi"),
            })
            const latest = await this.versions.latestNumber(key)
            const same = latest > 0 ? previewPackage(graph, this.draftOf(module, latest)).package : null
            const stored = latest > 0 ? await this.versions.find(key, latest) : null
            if (same !== null && stored?.hash === same.hash) {
                unchanged.push(key)
                return
            }
            const made = previewPackage(graph, this.draftOf(module, latest + 1))
            if (made.package === null) {
                refused.push(key)
                return
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
        })
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
    private adoptMissing(): Promise<number> {
        return this.adoptAfter("00000000-0000-0000-0000-000000000000", 0)
    }

    private async adoptAfter(after: string, adopted: number): Promise<number> {
        const page = await this.installations.page(after, PAGE)
        const last = page.at(-1)
        if (last === undefined) return adopted
        return this.adoptAfter(last.id, adopted + (await this.adoptPage(page)))
    }

    /** Records the installations of one page that no install row names yet and whose first-party package exists. */
    private async adoptPage(page: ReadonlyArray<InstallationRecord>): Promise<number> {
        const knownIds = await this.records.installedAmong(page.map((installation) => installation.id))
        const keys = [...new Set(page.map((installation) => firstPartyKeyOf(installation.moduleKey)))]
        const existing = await Promise.all(
            keys.map(async (key) => ((await this.versions.find(key, 1)) === null ? [] : [key])),
        )
        const packaged = new Set(existing.flat())
        const missing = page.filter(
            (installation) => !knownIds.has(installation.id) && packaged.has(firstPartyKeyOf(installation.moduleKey)),
        )
        await eachInOrder(missing, (installation) => this.adopt(installation))
        return missing.length
    }

    private adopt(installation: InstallationRecord): Promise<void> {
        return this.records.adopt(installation, firstPartyKeyOf(installation.moduleKey))
    }

    /** The draft of a module's package: no setting is offered, since its seed names no approver wait (no rule-derived branch, 2026-11-13). */
    private draftOf(module: ModuleDefinition, version: number): PackageDraft {
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
            parameters: [],
            bindings: [],
            starterKnowledge: [],
            persona: { soul: "", likeness: null },
            forbidden: [],
        }
    }
}
