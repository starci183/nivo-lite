import { Injectable } from "@nestjs/common"
import { Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BookingSettingsPublicSlug,
    BookingSettingsSaved,
    SaveBookingSettingsPolicyParams,
    SaveBookingSettingsPublicPageParams,
} from "./booking-settings.contracts"
import { BookingSettingEntity } from "./persistence/entities"

@Injectable()
/** Owns booking settings persistence and joins the transaction supplied by its caller. */
export class BookingSettingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Saves booking policy while preserving the workspace's publishing values. */
    async savePolicy(
        params: SaveBookingSettingsPolicyParams,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingSettingsSaved>> {
        await manager.upsert(
            BookingSettingEntity,
            {
                workspaceId: params.workspaceId,
                cancelWindowHours: params.cancelWindowHours,
                depositPct: params.depositPct,
                lateCancelFeePct: params.lateCancelFeePct,
                noShowFeeVnd: String(params.noShowFeeVnd),
                minLeadMin: params.minLeadMin,
                maxAdvanceDays: params.maxAdvanceDays,
                slotStepMin: params.slotStepMin,
                autoConfirm: params.autoConfirm,
                handoffOrder: params.handoffOrder,
                address: params.address,
                timezone: params.timezone,
                updatedAt: new Date(params.updatedAt),
            },
            ["workspaceId"],
        )
        return [{ id: params.workspaceId }]
    }

    /** Finds a different workspace that already owns the normalized public slug. */
    async slugOwner(
        workspaceId: string,
        slug: BookingSettingsPublicSlug,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingSettingsSaved>> {
        if (slug === null) return []
        const owner = await manager.findOne(BookingSettingEntity, {
            select: { workspaceId: true },
            where: { workspaceId: Not(workspaceId), publicSlug: slug },
        })
        return owner === null ? [] : [{ id: owner.workspaceId }]
    }

    /** Saves publishing values while preserving the workspace's booking policy. */
    async savePublicPage(
        params: SaveBookingSettingsPublicPageParams,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingSettingsSaved>> {
        await manager.upsert(
            BookingSettingEntity,
            {
                workspaceId: params.workspaceId,
                publicEnabled: params.enabled,
                publicSlug: params.slug,
                publicNote: params.note,
                updatedAt: new Date(params.updatedAt),
            },
            ["workspaceId"],
        )
        return [{ id: params.workspaceId }]
    }
}
