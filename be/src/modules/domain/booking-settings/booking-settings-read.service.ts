import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalBookingSetting, OptionalPublishedSetting } from "./booking-settings-read.contracts"
import { BookingSettingEntity } from "./persistence/entities"

@Injectable()
/** Booking settings reads for the capabilities that plan the calendar and publish the page. */
export class BookingSettingsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The settings a workspace saved, or none when it never saved any. */
    of(workspaceId: string): Promise<OptionalBookingSetting> {
        return this.entityManager.findOneBy(BookingSettingEntity, { workspaceId })
    }

    /** The workspace whose public page is on under a slug, with what the page shows; none when no page is on under it. */
    publishedBy(slug: string): Promise<OptionalPublishedSetting> {
        return this.entityManager.findOne(BookingSettingEntity, {
            select: { workspaceId: true, publicNote: true, address: true, timezone: true },
            where: { publicSlug: slug, publicEnabled: true },
        })
    }
}
