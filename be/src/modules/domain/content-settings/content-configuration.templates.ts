import type { ContentPillarDraft } from "@modules/domain/content-pillars"
import type { ContentCadenceDraft } from "@modules/domain/content-cadence"
import type { MessageCatalog } from "@modules/platform/i18n"

/** The locale keys and planning weight of a suggested content theme. */
interface ContentPillarPresetTemplate {
    /** The localized theme name key. */
    readonly nameKey: string
    /** The localized writing guidance key. */
    readonly descriptionKey: string
    /** The desired balance across themes. */
    readonly weight: number
}

/** Suggested themes used only when the workspace has none. */
const CONTENT_PILLAR_PRESET_TEMPLATES: ReadonlyArray<ContentPillarPresetTemplate> = [
    {
        nameKey: "content.preset.0.name",
        descriptionKey: "content.preset.0.description",
        weight: 3,
    },
    {
        nameKey: "content.preset.1.name",
        descriptionKey: "content.preset.1.description",
        weight: 3,
    },
    {
        nameKey: "content.preset.2.name",
        descriptionKey: "content.preset.2.description",
        weight: 2,
    },
    {
        nameKey: "content.preset.3.name",
        descriptionKey: "content.preset.3.description",
        weight: 1,
    },
    {
        nameKey: "content.preset.4.name",
        descriptionKey: "content.preset.4.description",
        weight: 1,
    },
]

/** Resolves the original Vietnamese starter themes from their locale catalog. */
export const contentPillarPresets = (catalog: MessageCatalog): Array<ContentPillarDraft> =>
    CONTENT_PILLAR_PRESET_TEMPLATES.map((preset) => ({
        name: catalog.get(preset.nameKey, {}, "vi"),
        description: catalog.get(preset.descriptionKey, {}, "vi"),
        weight: preset.weight,
        active: true,
    }))

/** Suggested posting rhythms that replace the manager's cadence. */
export const CONTENT_CADENCE_PRESETS: ReadonlyArray<ContentCadenceDraft> = [
    {
        channel: "facebook",
        postsPerWeek: 3,
        days: [2, 4, 6],
        time: "19:30",
    },
    {
        channel: "zalo",
        postsPerWeek: 1,
        days: [3],
        time: "10:00",
    },
]
