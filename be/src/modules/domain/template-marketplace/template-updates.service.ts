import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentGraphPublishService, AgentGraphsService, graphDocumentSchema } from "@modules/domain/agent-graphs"
import {
    AgentTemplateVersionsService,
    TemplateInstallEntity,
    TemplateLicenseEntity,
} from "@modules/domain/agent-templates"
import { applyUnits, instantiate, resolveValues, updateUnits } from "@nivo/agent-sdk/template"
import type { UpdateOffer } from "@nivo/agent-sdk/template"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateListingsService } from "./template-listings.service"

/** The most installations a workspace lists offers for. */
const LIST_MAX = 100

@Injectable()
/**
 * A newer version of a template offered to an installation, merged three ways by branch: what the creator changed and the buyer never
 * touched is an upgrade, what both changed stays the buyer until they take it, and what the creator added or dropped is theirs to
 * accept or leave. Nothing is applied but the units the owner names, the result goes through the same publish as any change (so the
 * ceiling of the buyer and the owner for a widening still hold), and a version marked breaking is never taken for the buyer.
 */
export class TemplateUpdatesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly versions: AgentTemplateVersionsService,
        private readonly listings: TemplateListingsService,
        private readonly graphs: AgentGraphsService,
        private readonly publish: AgentGraphPublishService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The offers for every installation of the workspace that has a newer version; any member may read. */
    async offers(userId: string, workspaceId: string): Promise<ReadonlyArray<UpdateOffer>> {
        await this.members.require(userId, workspaceId)
        const installs = await this.entityManager.find(TemplateInstallEntity, {
            where: { workspaceId },
            take: LIST_MAX,
        })
        const offers = await Promise.all(installs.map((install) => this.offerOf(install)))
        return offers.flatMap((offer) => (offer === null ? [] : [offer]))
    }

    /** The offer for one installation, or null when it is up to date. */
    async offer(userId: string, workspaceId: string, installationId: string): Promise<UpdateOffer | null> {
        await this.members.require(userId, workspaceId)
        return this.offerOf(await this.requireInstall(workspaceId, installationId))
    }

    /**
     * Takes the named units of the newer version into the graph that decides, as a version of kind template. The install moves to the
     * newer version only when every unit has been taken, so a unit left alone stays on offer.
     */
    async accept(
        userId: string,
        workspaceId: string,
        installationId: string,
        unitIds: ReadonlyArray<string>,
    ): Promise<UpdateOffer | null> {
        const member = await this.members.require(userId, workspaceId, ["owner", "manager"])
        const install = await this.requireInstall(workspaceId, installationId)
        const merged = await this.mergeOf(install)
        if (merged === null)
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.UpdateUnavailable })
        const known = new Set(merged.units.map((unit) => unit.id))
        if (unitIds.length === 0 || unitIds.some((id) => !known.has(id))) {
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.UpdateUnavailable })
        }
        const state = await this.graphs.stateOfAgent(workspaceId, merged.agentId)
        if (state?.active == null)
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.UpdateUnavailable })
        const document = graphDocumentSchema.safeParse(applyUnits(state.active, merged.next, merged.units, unitIds))
        if (!document.success)
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.UpdateUnavailable })
        const by = { memberId: await this.members.idOf(userId, workspaceId), role: member.role }
        await this.publish.publishTemplate(workspaceId, merged.agentId, document.data, by)
        if (merged.units.every((unit) => unitIds.includes(unit.id))) {
            await this.entityManager.update(
                TemplateInstallEntity,
                { installationId },
                { version: merged.offered, parameterValues: merged.values },
            )
        }
        return this.offerOf(await this.requireInstall(workspaceId, installationId))
    }

    private async offerOf(install: TemplateInstallEntity): Promise<UpdateOffer | null> {
        const merged = await this.mergeOf(install)
        if (merged === null) return null
        const stored = await this.versions.require(install.templateKey, merged.offered)
        return {
            installationId: install.installationId,
            key: install.templateKey,
            installed: install.version,
            offered: merged.offered,
            breaking: stored.breaking,
            changelog: stored.changelog,
            units: merged.units,
        }
    }

    /** The newest version this install may take, the three graphs and the units between them; null when there is nothing to offer. */
    private async mergeOf(install: TemplateInstallEntity) {
        const license =
            install.licenseId === null
                ? null
                : await this.entityManager.findOne(TemplateLicenseEntity, { where: { id: install.licenseId } })
        if (license === null || license.status !== "active") return null
        const offered =
            license.kind === "private"
                ? await this.versions.latestNumber(install.templateKey)
                : await this.listings.latestApproved(install.templateKey)
        if (offered <= install.version) return null
        const [installed, newer] = await Promise.all([
            this.versions.require(install.templateKey, install.version),
            this.versions.require(install.templateKey, offered),
        ])
        const values = resolveValues(newer.package.parameters, install.parameterValues).values
        const installation = await this.agentOf(install)
        const state = installation === null ? null : await this.graphs.stateOfAgent(install.workspaceId, installation)
        if (installation === null || state?.active == null) return null
        const base = instantiate(
            installed.package,
            resolveValues(installed.package.parameters, install.parameterValues).values,
        )
        const next = instantiate(newer.package, values)
        const units = updateUnits({ base, current: state.active, next })
        return units.length === 0 ? null : { agentId: installation, offered, next, units, values }
    }

    private async agentOf(install: TemplateInstallEntity): Promise<string | null> {
        const state = await this.graphs.stateOfInstallation(install.installationId)
        return state?.agentId ?? null
    }

    private async requireInstall(workspaceId: string, installationId: string): Promise<TemplateInstallEntity> {
        const row = await this.entityManager.findOne(TemplateInstallEntity, { where: { workspaceId, installationId } })
        if (row === null) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NotATemplateInstall })
        return row
    }
}
