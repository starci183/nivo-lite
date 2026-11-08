import { Injectable } from "@nestjs/common"
import { In, IsNull, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AdoptedInstallation,
    MoveInstallInput,
    OptionalTemplateInstallView,
    OptionalTemplateLicenseView,
    PaidLicenseGrant,
    TemplateInstallView,
} from "./agent-templates.contracts"
import { TemplateInstallEntity, TemplateLicenseEntity } from "./persistence/entities"
import { insertedId } from "./policies/inserted-id.policy"

@Injectable()
/**
 * The read and write side of the license and install rows of a template, for the marketplace: it holds the rows, the marketplace
 * holds the rules of who may buy and update. A method that must share the transaction of its caller takes the manager.
 */
export class TemplateRecordsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The ids among these installations that already have an install row. */
    async installedAmong(installationIds: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
        const rows = await this.entityManager.find(TemplateInstallEntity, {
            where: { installationId: In([...installationIds]) },
            take: installationIds.length,
        })
        return new Set(rows.map((row) => row.installationId))
    }

    /** Records a built-in module installation as a free license and an install of version 1 of its first-party package. */
    async adopt(installation: AdoptedInstallation, templateKey: string): Promise<void> {
        const license = await this.entityManager.insert(TemplateLicenseEntity, {
            workspaceId: installation.workspaceId,
            templateKey,
            kind: "free",
            listingId: null,
            orderId: null,
            installationId: installation.id,
            status: "active",
        })
        const licenseId = insertedId(license.identifiers)
        await this.entityManager.insert(TemplateInstallEntity, {
            installationId: installation.id,
            workspaceId: installation.workspaceId,
            templateKey,
            version: 1,
            parameterValues: {},
            licenseId: licenseId === "" ? null : licenseId,
            installedBy: null,
        })
    }

    /** Whether a paid order already has its license, in the transaction of the caller. */
    async hasLicenseForOrder(manager: EntityManager, orderId: string): Promise<boolean> {
        return (await manager.findOne(TemplateLicenseEntity, { where: { orderId } })) !== null
    }

    /** Writes the paid license of a settled order, in the transaction of the caller. */
    async grantPaid(manager: EntityManager, grant: PaidLicenseGrant): Promise<void> {
        await manager.insert(TemplateLicenseEntity, {
            workspaceId: grant.workspaceId,
            templateKey: grant.templateKey,
            kind: "paid",
            listingId: grant.listingId,
            orderId: grant.orderId,
            installationId: null,
            status: "active",
        })
    }

    /** The oldest active paid license of the workspace for this listing that no installation runs on yet, or null. */
    unclaimedPaidLicense(
        workspaceId: string,
        templateKey: string,
        listingId: string,
    ): Promise<OptionalTemplateLicenseView> {
        return this.entityManager.findOne(TemplateLicenseEntity, {
            where: { workspaceId, templateKey, listingId, kind: "paid", status: "active", installationId: IsNull() },
            order: { createdAt: "ASC" },
        })
    }

    /** The license with this id, or null. */
    licenseById(id: string): Promise<OptionalTemplateLicenseView> {
        return this.entityManager.findOne(TemplateLicenseEntity, { where: { id } })
    }

    /** The installs of the workspace, at most `limit`. */
    installsOf(workspaceId: string, limit: number): Promise<Array<TemplateInstallView>> {
        return this.entityManager.find(TemplateInstallEntity, { where: { workspaceId }, take: limit })
    }

    /** The install of this installation in the workspace, or null. */
    installOf(workspaceId: string, installationId: string): Promise<OptionalTemplateInstallView> {
        return this.entityManager.findOne(TemplateInstallEntity, { where: { workspaceId, installationId } })
    }

    /** Moves an install to a newer version with the values it now holds. */
    async moveInstall(input: MoveInstallInput): Promise<void> {
        await this.entityManager.update(
            TemplateInstallEntity,
            { installationId: input.installationId },
            { version: input.version, parameterValues: input.parameterValues },
        )
    }
}
