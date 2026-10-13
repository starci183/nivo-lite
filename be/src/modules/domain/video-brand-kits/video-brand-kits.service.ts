import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { SaveVideoBrandKit } from "./video-brand-kits.contracts"
import { SAVE_WORKBENCH_BRAND } from "./persistence/video-brand-kits.sql"

@Injectable()
/** The owner of workspace video_brand_kits writes. */
export class VideoBrandKitsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Upserts a manager's normalized workspace kit. */
    async save(workspaceId: string, principalId: string, brand: SaveVideoBrandKit): Promise<void> {
        await this.entityManager.query(SAVE_WORKBENCH_BRAND, [
            workspaceId,
            brand.shopName,
            brand.primary,
            brand.secondary,
            brand.logoPath,
            brand.musicTrack,
            brand.voice,
            principalId,
        ])
    }
}
