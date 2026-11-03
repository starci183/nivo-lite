import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentTemplateInstallerService, TemplateLicenseEntity } from "@modules/domain/agent-templates"
import type { InstalledTemplate, ParameterValues } from "@nivo/agent-sdk/template"
import type { PayableOrder } from "@modules/domain/billing"
import { CreditsService } from "@modules/domain/credits"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { Locale } from "@modules/platform/i18n"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateListingsService } from "./template-listings.service"

/** What a buyer takes to install a listing. */
export interface InstallListingRequest {
    /** The workspace of the buyer. */
    readonly workspaceId: string
    /** The listing. */
    readonly listingId: string
    /** The values of the parameters. */
    readonly values: ParameterValues
    /** The label of the agent, or null. */
    readonly name: string | null
    /** The language. */
    readonly locale: Locale
}

@Injectable()
/**
 * What a workspace does to take a listing: a free one installs at once, a paid one first needs an order (a transfer through SePay
 * like any other order of the product), and the license a settled order writes is what the install then rests on.
 */
export class TemplatePurchasesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly listings: TemplateListingsService,
        private readonly installer: AgentTemplateInstallerService,
        private readonly credits: CreditsService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The order to pay for a paid listing; a free listing has none. */
    async order(userId: string, workspaceId: string, listingId: string): Promise<PayableOrder> {
        const { row } = await this.listings.approved(listingId)
        if (row.priceVnd === 0) throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.NothingToPay })
        return this.credits.agentTemplate(userId, {
            workspaceId,
            listingId,
            templateKey: row.templateKey,
            version: row.version,
            amountVnd: row.priceVnd,
        })
    }

    /** Installs an approved listing as a new agent in shadow mode; a paid one needs a settled order of this workspace that is not used yet. */
    async install(userId: string, request: InstallListingRequest): Promise<InstalledTemplate> {
        await this.members.require(userId, request.workspaceId, ["owner"])
        const { row } = await this.listings.approved(request.listingId)
        const licenseId =
            row.priceVnd === 0 ? null : await this.paidLicense(request.workspaceId, row.templateKey, row.id)
        return this.installer.install(userId, {
            workspaceId: request.workspaceId,
            key: row.templateKey,
            version: row.version,
            values: request.values,
            name: request.name,
            locale: request.locale,
            access: { kind: "licensed", license: row.priceVnd === 0 ? "free" : "paid", listingId: row.id, licenseId },
        })
    }

    private async paidLicense(workspaceId: string, templateKey: string, listingId: string): Promise<string> {
        const license = await this.entityManager.findOne(TemplateLicenseEntity, {
            where: { workspaceId, templateKey, listingId, kind: "paid", status: "active", installationId: IsNull() },
            order: { createdAt: "ASC" },
        })
        if (license === null || license.installationId !== null) {
            throw new TemplateMarketplaceError({ code: TemplateMarketplaceErrorCode.PaymentRequired })
        }
        return license.id
    }
}
