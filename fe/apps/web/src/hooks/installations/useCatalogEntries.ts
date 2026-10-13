import { useLocale } from "next-intl"
import { MODULE_CATEGORIES, MODULE_KEYS, MODULE_REGISTRY, pickCopy, pickCopyList } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { AGENT_STATUS_TONE, agentHref, agentStatusOf, foldText, instancesOf } from "@/modules/installations"
import type { DataSlot } from "@/modules/types"
import { useInstallations } from "./useInstallations"

/** One agent of the catalogue in the reader language, with whether (and how) it is installed. */
interface CatalogEntry {
    readonly key: ModuleKey
    readonly categoryKey: string
    /** The name, description and points folded for matching, in both languages. */
    readonly searchText: string
    readonly installed: boolean
    readonly isEarly: boolean
    readonly name: string
    readonly description: string
    readonly points: ReadonlyArray<string>
    readonly mascot: string
    readonly status: ReturnType<typeof agentStatusOf>
    readonly statusTone: (typeof AGENT_STATUS_TONE)[keyof typeof AGENT_STATUS_TONE]
    /** Where an installed agent opens; null when it is not installed. */
    readonly openHref: string | null
}

/** The catalogue of agents with the install state of the active workspace, and its categories. */
export const useCatalogEntries = (): {
    readonly entries: ReadonlyArray<CatalogEntry>
    readonly categories: ReadonlyArray<{ readonly key: string; readonly label: string }>
    readonly slot: DataSlot<ReadonlyArray<unknown>>
} => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { slot, installations } = useInstallations()
    const entries = MODULE_KEYS.map((key): CatalogEntry => {
        const def = MODULE_REGISTRY[key]
        const installation = installations === undefined ? undefined : instancesOf(installations, key)[0]
        const status = agentStatusOf(installation)
        const category = MODULE_CATEGORIES.find((entry) => entry.key === def.category)
        return {
            key,
            categoryKey: def.category,
            installed: installation !== undefined,
            isEarly: def.status === "early",
            searchText: foldText(
                [
                    def.name.vi,
                    def.name.en,
                    def.shortName.vi,
                    def.shortName.en,
                    def.description.vi,
                    def.description.en,
                    ...def.points.vi,
                    ...def.points.en,
                    category?.label.vi ?? "",
                    category?.label.en ?? "",
                ].join(" "),
            ),
            name: pickCopy(def.name, locale),
            description: pickCopy(def.description, locale),
            points: pickCopyList(def.points, locale),
            mascot: def.mascot,
            status,
            statusTone: AGENT_STATUS_TONE[status],
            openHref: installation === undefined ? null : agentHref(key, null),
        }
    })
    const categories = MODULE_CATEGORIES.map((category) => ({
        key: category.key,
        label: pickCopy(category.label, locale),
    }))
    return { entries, categories, slot }
}
