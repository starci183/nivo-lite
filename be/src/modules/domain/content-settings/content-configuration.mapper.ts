import type { ContentAutomationMark, ContentBrandSettings } from "./content-configuration.contracts"
import type { ContentBrandRow } from "./persistence/content-configuration.rows"

/** Maps brand fields and supplies defaults for an unsaved workspace. */
export const toContentBrandSettings = (workspaceId: string, row?: ContentBrandRow): ContentBrandSettings => ({
    workspaceId,
    brandVoice: row?.brand_voice ?? "",
    avoid: row?.avoid ?? "",
    cta: row?.cta ?? "",
    hashtags: row?.hashtags ?? [],
    automations: {
        today_reminder: row?.automations.today_reminder === true,
        offer_draft: row?.automations.offer_draft === true,
        weekly_summary: row?.automations.weekly_summary === true,
    },
    marks: Object.fromEntries(
        Object.entries(row?.marks ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    ),
})

/** Pure list representation of automation dedupe marks for the public contract. */
export class ContentAutomationMarksMapper {
    /** The recorded automation marks. */
    readonly marks: Array<ContentAutomationMark>

    constructor(settings: ContentBrandSettings) {
        this.marks = Object.entries(settings.marks).map(([key, value]) => ({ key, value }))
    }
}
