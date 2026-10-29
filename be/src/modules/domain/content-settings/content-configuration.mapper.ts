import type { ContentAutomationMark, ContentBrandSettings } from "./content-configuration.contracts"

/** The switches as stored: any value, of which only an exact true counts. */
export interface StoredSwitches {
    /** The reminder of what is due today. */
    readonly today_reminder?: unknown
    /** The ideas for new offers. */
    readonly offer_draft?: unknown
    /** The summary of last week. */
    readonly weekly_summary?: unknown
}

/** The stored brand fields the mapper reads; a settings entity satisfies it, and the switches and marks are read as stored. */
export interface StoredContentBrand {
    /** The brand voice. */
    readonly brandVoice: string
    /** What drafts avoid. */
    readonly avoid: string
    /** The call to action. */
    readonly cta: string
    /** The hashtags. */
    readonly hashtags: ReadonlyArray<string>
    /** The stored switches; only an exact true counts. */
    readonly automations: StoredSwitches
    /** The stored marks; only string values count. */
    readonly marks: object
}

/** Maps brand fields and supplies defaults for an unsaved workspace. */
export const toContentBrandSettings = (workspaceId: string, row?: StoredContentBrand): ContentBrandSettings => ({
    workspaceId,
    brandVoice: row?.brandVoice ?? "",
    avoid: row?.avoid ?? "",
    cta: row?.cta ?? "",
    hashtags: [...(row?.hashtags ?? [])],
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
