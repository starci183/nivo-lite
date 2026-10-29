import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AutomationMarks,
    GuidelineBrand,
    OptionalStoredGuidelineBrand,
    TickWorkspace,
} from "./content-settings.contracts"
import { ContentSettingsEntity } from "./persistence/entities"

@Injectable()
/** The `content_settings` rows: which automations a workspace switched on and the marks that keep a repeated tick from doing anything twice. */
export class ContentSettingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The next page of workspaces with an automation on, after the last id seen; `only` limits the scan to one workspace. */
    async tickWorkspaces(after: string, size: number, only?: string): Promise<Array<TickWorkspace>> {
        const rows = await this.entityManager
            .createQueryBuilder(ContentSettingsEntity, "settings")
            .select(["settings.workspaceId", "settings.automations", "settings.marks"])
            .where("(:only::uuid IS NULL OR settings.workspaceId = :only) AND settings.workspaceId > :after")
            .andWhere(
                "((settings.automations ->> 'today_reminder') = 'true' OR (settings.automations ->> 'offer_draft') = 'true' OR (settings.automations ->> 'weekly_summary') = 'true')",
            )
            .setParameters({ only: only ?? null, after })
            .orderBy("settings.workspaceId", "ASC")
            .limit(size)
            .getMany()
        return rows.map((row) => ({ workspaceId: row.workspaceId, automations: row.automations, marks: row.marks }))
    }

    /** Merges marks into the settings of a workspace. */
    async mergeMarks(workspaceId: string, marks: AutomationMarks): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ContentSettingsEntity, "cs")
            .update()
            .set({ marks: () => "jsonb_concat(marks, CAST(:marks AS jsonb))" })
            .where({ workspaceId })
            .setParameter("marks", JSON.stringify(marks))
            .execute()
    }

    /** Writes the guideline brand the owner confirmed (palette, fonts, tone, imagery, voice, avoid). */
    async saveGuidelineBrand(workspaceId: string, brand: GuidelineBrand): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ContentSettingsEntity, "cs")
            .insert()
            .values({
                workspaceId,
                brandColors: () => ":colors::jsonb",
                brandFonts: [...brand.fonts],
                brandTone: brand.tone,
                brandImagery: [...brand.imagery],
                brandSource: brand.source,
                brandVoice: brand.voice,
                avoid: brand.avoid,
            })
            .setParameter("colors", JSON.stringify(brand.colors))
            .orUpdate(
                ["brand_colors", "brand_fonts", "brand_tone", "brand_imagery", "brand_source", "brand_voice", "avoid"],
                ["workspace_id"],
            )
            .execute()
    }

    /** The guideline brand of a workspace, or null when it has no settings. */
    async guidelineBrandOf(workspaceId: string): Promise<OptionalStoredGuidelineBrand> {
        const row = await this.entityManager.findOne(ContentSettingsEntity, {
            select: { brandColors: true, brandFonts: true, brandTone: true, brandImagery: true, avoid: true },
            where: { workspaceId },
        })
        if (row === null) return null
        return {
            colors: row.brandColors,
            fonts: row.brandFonts,
            tone: row.brandTone,
            imagery: row.brandImagery,
            avoid: row.avoid,
        }
    }
}
