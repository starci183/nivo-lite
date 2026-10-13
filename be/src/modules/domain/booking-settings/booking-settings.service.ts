import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    BookingSettingsPublicSlug,
    SaveBookingSettingsPolicyParams,
    SaveBookingSettingsPublicPageParams,
} from "./booking-settings.contracts"
import type { BookingSettingsIdRow } from "./persistence/booking-settings.rows"
import {
    SELECT_SETUP_SLUG_OWNER,
    UPSERT_SETUP_POLICY,
    UPSERT_SETUP_PUBLIC_PAGE,
} from "./persistence/booking-settings.sql"

@Injectable()
/** Owns booking settings persistence and joins the transaction supplied by its caller. */
export class BookingSettingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Saves booking policy while preserving the workspace's publishing values. */
    savePolicy(
        params: SaveBookingSettingsPolicyParams,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingSettingsIdRow>> {
        return manager.query<Array<BookingSettingsIdRow>>(UPSERT_SETUP_POLICY, [
            params.workspaceId,
            params.cancelWindowHours,
            params.depositPct,
            params.lateCancelFeePct,
            params.noShowFeeVnd,
            params.minLeadMin,
            params.maxAdvanceDays,
            params.slotStepMin,
            params.autoConfirm,
            params.handoffOrder,
            params.address,
            params.timezone,
            params.updatedAt,
        ])
    }

    /** Finds a different workspace that already owns the normalized public slug. */
    slugOwner(
        workspaceId: string,
        slug: BookingSettingsPublicSlug,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingSettingsIdRow>> {
        return manager.query<Array<BookingSettingsIdRow>>(SELECT_SETUP_SLUG_OWNER, [workspaceId, slug])
    }

    /** Saves publishing values while preserving the workspace's booking policy. */
    savePublicPage(
        params: SaveBookingSettingsPublicPageParams,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<BookingSettingsIdRow>> {
        return manager.query<Array<BookingSettingsIdRow>>(UPSERT_SETUP_PUBLIC_PAGE, [
            params.workspaceId,
            params.enabled,
            params.slug,
            params.note,
            params.updatedAt,
        ])
    }
}
