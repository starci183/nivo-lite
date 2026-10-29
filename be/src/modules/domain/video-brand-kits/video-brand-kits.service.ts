import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { GuidelineVideoBrand, KitIdentity, SaveVideoBrandKit } from "./video-brand-kits.contracts"
import { VideoBrandKitEntity } from "./persistence/entities"

@Injectable()
/** The owner of workspace video_brand_kits writes. */
export class VideoBrandKitsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Upserts a manager's normalized workspace kit. */
    async save(workspaceId: string, principalId: string, brand: SaveVideoBrandKit): Promise<void> {
        const colors = {
            ...(brand.primary === null ? {} : { primaryColor: brand.primary }),
            ...(brand.secondary === null ? {} : { secondaryColor: brand.secondary }),
        }
        await this.entityManager
            .createQueryBuilder(VideoBrandKitEntity, "v")
            .insert()
            .values({
                workspaceId,
                shopName: brand.shopName,
                ...colors,
                logoPath: brand.logoPath,
                musicTrack: brand.musicTrack,
                voice: brand.voice,
                updatedBy: principalId,
            })
            .orUpdate(
                [
                    "shop_name",
                    ...(brand.primary === null ? [] : ["primary_color"]),
                    ...(brand.secondary === null ? [] : ["secondary_color"]),
                    "logo_path",
                    "music_track",
                    "voice",
                    "updated_by",
                ],
                ["workspace_id"],
            )
            .execute()
    }

    /** Writes the colors (and name, when given) of a confirmed guideline brand; the other fields stay. */
    async saveGuidelineColors(workspaceId: string, principalId: string, brand: GuidelineVideoBrand): Promise<void> {
        const shopName = brand.shopName.slice(0, 60)
        await this.entityManager
            .createQueryBuilder(VideoBrandKitEntity, "v")
            .insert()
            .values({
                workspaceId,
                primaryColor: brand.primary,
                secondaryColor: brand.secondary,
                shopName,
                updatedBy: principalId,
                updatedAt: () => "now()",
            })
            .orUpdate(
                [
                    "primary_color",
                    "secondary_color",
                    ...(shopName === "" ? [] : ["shop_name"]),
                    "updated_by",
                    "updated_at",
                ],
                ["workspace_id"],
            )
            .execute()
    }

    /** The logo path and shop name of the workspace kit; empty when it has none. */
    async identityOf(workspaceId: string): Promise<KitIdentity> {
        const kit = await this.entityManager.findOne(VideoBrandKitEntity, {
            select: { logoPath: true, shopName: true },
            where: { workspaceId },
        })
        return { logoPath: kit?.logoPath ?? null, shopName: kit?.shopName ?? "" }
    }
}
