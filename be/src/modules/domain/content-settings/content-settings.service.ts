import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AutomationMarks,
    GuidelineBrand,
    OptionalStoredGuidelineBrand,
    TickWorkspace,
} from "./content-settings.contracts"
import {
    MERGE_MARKS,
    SAVE_GUIDELINE_BRAND,
    SELECT_GUIDELINE_BRAND,
    SELECT_TICK_WORKSPACES,
} from "./persistence/content-settings.sql"
import type { GuidelineBrandRow, TickWorkspaceRow } from "./persistence/content-settings.rows"

@Injectable()
/** The `content_settings` rows: which automations a workspace switched on and the marks that keep a repeated tick from doing anything twice. */
export class ContentSettingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The next page of workspaces with an automation on, after the last id seen; `only` limits the scan to one workspace. */
    async tickWorkspaces(after: string, size: number, only?: string): Promise<Array<TickWorkspace>> {
        const rows = await this.entityManager.query<Array<TickWorkspaceRow>>(SELECT_TICK_WORKSPACES, [
            only ?? null,
            after,
            size,
        ])
        return rows.map((row) => ({ workspaceId: row.workspace_id, automations: row.automations, marks: row.marks }))
    }

    /** Merges marks into the settings of a workspace. */
    async mergeMarks(workspaceId: string, marks: AutomationMarks): Promise<void> {
        await this.entityManager.query(MERGE_MARKS, [workspaceId, JSON.stringify(marks)])
    }

    /** Writes the guideline brand the owner confirmed (palette, fonts, tone, imagery, voice, avoid). */
    async saveGuidelineBrand(workspaceId: string, brand: GuidelineBrand): Promise<void> {
        await this.entityManager.query(SAVE_GUIDELINE_BRAND, [
            workspaceId,
            JSON.stringify(brand.colors),
            brand.fonts,
            brand.tone,
            brand.imagery,
            brand.source,
            brand.voice,
            brand.avoid,
        ])
    }

    /** The guideline brand of a workspace, or null when it has no settings. */
    async guidelineBrandOf(workspaceId: string): Promise<OptionalStoredGuidelineBrand> {
        const [row] = await this.entityManager.query<Array<GuidelineBrandRow>>(SELECT_GUIDELINE_BRAND, [workspaceId])
        if (row === undefined) return null
        return {
            colors: row.brand_colors,
            fonts: row.brand_fonts,
            tone: row.brand_tone,
            imagery: row.brand_imagery,
            avoid: row.avoid,
        }
    }
}
