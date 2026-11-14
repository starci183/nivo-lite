import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import {
    AgentGraphPublishService,
    AgentGraphSeedService,
    AgentWorkflowInstallService,
    graphDocumentSchema,
} from "@modules/domain/agent-graphs"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModuleInstallService, ModulesService } from "@modules/domain/modules"
import { PublicDocumentsService } from "@modules/domain/public-documents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Locale } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentTemplatesError, AgentTemplatesErrorCode } from "./errors/agent-templates.error"
import { AgentTemplateVersionsService } from "./agent-template-versions.service"
import type { InstalledTemplate } from "./agent-templates.contracts"
import { TemplateInstallEntity, TemplateLicenseEntity } from "./persistence/entities"
import { insertedId } from "./policies/inserted-id.policy"
import { valuesOf } from "./policies/parameter-values.policy"
import { instantiate, resolveValues, type ParameterValues } from "@nivo-lite/agent-sdk/template"

/** How the buyer came to hold the right to run the template. */
export type InstallAccess =
    | { readonly kind: "private" }
    | {
          readonly kind: "licensed"
          /** Free or paid. */
          readonly license: "free" | "paid"
          /** The approved listing. */
          readonly listingId: string
          /** The license a payment already wrote, or null for a free listing. */
          readonly licenseId: string | null
      }

/** What installing a template takes. */
export interface InstallTemplateRequest {
    /** The workspace of the buyer. */
    readonly workspaceId: string
    /** The key. */
    readonly key: string
    /** The version. */
    readonly version: number
    /** The values the buyer gave. */
    readonly values: ParameterValues
    /** The label of the agent, or null for the next free one. */
    readonly name: string | null
    /** The language of the names. */
    readonly locale: Locale
    /** How the buyer holds the right. */
    readonly access: InstallAccess
}

/** What a creator takes to install a template of their own account: the values are what the form gave, read in the domain. */
export interface ImportTemplateRequest {
    /** The workspace of the buyer. */
    readonly workspaceId: string
    /** The key. */
    readonly templateKey: string
    /** The version. */
    readonly version: number
    /** The values the buyer gave. */
    readonly values: object
    /** The label of the agent, when the buyer gave one. */
    readonly name?: string | undefined
    /** The language of the names. */
    readonly locale: Locale
}

@Injectable()
/**
 * Installs a template into a workspace. Only the owner of the buyer workspace does. It makes the agent through the same install as any
 * module, fills the graph with the values of the buyer, publishes it as a version of kind template under every check of the buyer
 * (the ceiling of its authority rules, the grants of its approvers; the package grants no data right), and leaves the agent in
 * shadow mode until the owner turns the graph on. The public documents of the package come in as drafts the buyer approves again.
 * Each step is its own commit, so a refusal in the middle leaves a working agent on its seed and no license.
 */
export class AgentTemplateInstallerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly versions: AgentTemplateVersionsService,
        private readonly members: WorkspaceMembersService,
        private readonly modules: ModulesService,
        private readonly moduleInstall: ModuleInstallService,
        private readonly installations: InstallationRecordsService,
        private readonly seed: AgentGraphSeedService,
        private readonly publish: AgentGraphPublishService,
        private readonly documents: PublicDocumentsService,
        @Optional() private readonly workflows?: AgentWorkflowInstallService,
    ) {}

    /** Installs a template of the caller's own account as a new agent in this workspace, in shadow mode. */
    importOwn(userId: string, request: ImportTemplateRequest): Promise<InstalledTemplate> {
        return this.install(userId, {
            workspaceId: request.workspaceId,
            key: request.templateKey,
            version: request.version,
            values: valuesOf(request.values),
            name: request.name ?? null,
            locale: request.locale,
            access: { kind: "private" },
        })
    }

    /** Installs one version of a template as a new agent. */
    async install(userId: string, request: InstallTemplateRequest): Promise<InstalledTemplate> {
        const member = await this.members.require(userId, request.workspaceId, ["owner"])
        const stored = await this.versions.require(request.key, request.version)
        if (request.access.kind === "private" && stored.creatorAccountId !== userId) {
            throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.NotYours })
        }
        const pkg = stored.package
        const resolved = resolveValues(pkg.parameters, request.values)
        if (resolved.problems.length > 0) {
            throw new AgentTemplatesError({
                code: AgentTemplatesErrorCode.ValuesRefused,
                params: { count: resolved.problems.length },
            })
        }
        const module = await this.modules.find(pkg.baseModule)
        const present = await this.installations.firstOfModule(request.workspaceId, module.key)
        if (present !== null && !module.multiInstance) {
            throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.BaseAgentExists })
        }
        const made = await this.moduleInstall.install(userId, {
            workspaceId: request.workspaceId,
            moduleKey: module.key,
            locale: request.locale,
            newInstance: present !== null,
            name: request.name,
        })
        if (made.agentId === null) throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.BaseAgentExists })
        await this.seed.ensureFor(made.installationId, request.locale)
        const by = { memberId: await this.members.idOf(userId, request.workspaceId), role: member.role }
        const filled = graphDocumentSchema.safeParse(instantiate(pkg, resolved.values))
        if (!filled.success) throw new AgentTemplatesError({ code: AgentTemplatesErrorCode.ValuesRefused })
        // The agent was made in this call: what the template asks on accounts beyond what is agreed waits for the owner.
        await this.publish.publishTemplate(request.workspaceId, made.agentId, filled.data, by, [], "wait")
        await this.publish.setMode(request.workspaceId, made.agentId, "shadow", by)
        // The workflows the base module's plugin ships, made the way the stack seed makes a seeded shop's.
        await this.workflows?.install({
            workspaceId: request.workspaceId,
            agentId: made.agentId,
            installationId: made.installationId,
            moduleKey: module.key,
        })
        await eachInOrder(pkg.starterKnowledge, (document) =>
            this.documents.write(userId, request.workspaceId, { title: document.title, body: document.body }),
        )
        const licenseId = await this.recordInstall(userId, request, made.installationId, resolved.values)
        return {
            installationId: made.installationId,
            agentId: made.agentId,
            key: pkg.key,
            version: pkg.version,
            licenseId,
        }
    }

    private recordInstall(
        userId: string,
        request: InstallTemplateRequest,
        installationId: string,
        values: ParameterValues,
    ): Promise<string> {
        return this.entityManager.transaction(async (tx) => {
            const licenseId = await this.licenseOf(tx, request, installationId)
            await tx.insert(TemplateInstallEntity, {
                installationId,
                workspaceId: request.workspaceId,
                templateKey: request.key,
                version: request.version,
                parameterValues: { ...values },
                licenseId,
                installedBy: userId,
            })
            return licenseId
        })
    }

    private async licenseOf(
        tx: EntityManager,
        request: InstallTemplateRequest,
        installationId: string,
    ): Promise<string> {
        const { access } = request
        if (access.kind === "licensed" && access.licenseId !== null) {
            await tx.update(
                TemplateLicenseEntity,
                { id: access.licenseId, workspaceId: request.workspaceId },
                { installationId },
            )
            return access.licenseId
        }
        const inserted = await tx.insert(TemplateLicenseEntity, {
            workspaceId: request.workspaceId,
            templateKey: request.key,
            kind: access.kind === "private" ? "private" : access.license,
            listingId: access.kind === "private" ? null : access.listingId,
            orderId: null,
            installationId,
            status: "active",
        })
        return insertedId(inserted.identifiers)
    }
}
