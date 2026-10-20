import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { GuidelineVideoBrand, KitIdentity, KitIdentityRow, SaveVideoBrandKit } from "./video-brand-kits.contracts"
import { SAVE_GUIDELINE_COLORS, SAVE_WORKBENCH_BRAND, SELECT_KIT_LOGO } from "./persistence/video-brand-kits.sql"

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

    /** Writes the colors (and name, when given) of a confirmed guideline brand; the other fields stay. */
    async saveGuidelineColors(workspaceId: string, principalId: string, brand: GuidelineVideoBrand): Promise<void> {
        await this.entityManager.query(SAVE_GUIDELINE_COLORS, [
            workspaceId,
            brand.primary,
            brand.secondary,
            brand.shopName.slice(0, 60),
            principalId,
        ])
    }

    /** The logo path and shop name of the workspace kit; empty when it has none. */
    async identityOf(workspaceId: string): Promise<KitIdentity> {
        const [row] = await this.entityManager.query<Array<KitIdentityRow>>(SELECT_KIT_LOGO, [workspaceId])
        return { logoPath: row?.logo_path ?? null, shopName: row?.shop_name ?? "" }
    }
}
