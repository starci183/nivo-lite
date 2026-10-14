import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { MODULE_KEYS, MODULE_REGISTRY, pickCopy, pickCopyList } from "@/modules/catalog"
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
    readonly slot: DataSlot<boolean>
    readonly reload: () => void
} => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { slot: installationsSlot, installations, reload: reloadInstallations } = useInstallations()
    const catalog = useModuleCatalog()
    const entries = MODULE_KEYS.map((key): CatalogEntry => {
        const def = MODULE_REGISTRY[key]
        const copy = catalog.modules[key]
        const installation = installations === undefined ? undefined : instancesOf(installations, key)[0]
        const status = agentStatusOf(installation)
        const category = catalog.categories.find((entry) => entry.key === def.category)
        return {
            key,
            categoryKey: def.category,
            installed: installation !== undefined,
            isEarly: def.status === "early",
            searchText: foldText(
                [
                    copy?.name.vi ?? "",
                    copy?.name.en ?? "",
                    copy?.shortName.vi ?? "",
                    copy?.shortName.en ?? "",
                    copy?.description.vi ?? "",
                    copy?.description.en ?? "",
                    ...(copy?.points.vi ?? []),
                    ...(copy?.points.en ?? []),
                    category?.label.vi ?? "",
                    category?.label.en ?? "",
                ].join(" "),
            ),
            name: copy === undefined ? "" : pickCopy(copy.name, locale),
            description: copy === undefined ? "" : pickCopy(copy.description, locale),
            points: copy === undefined ? [] : pickCopyList(copy.points, locale),
            mascot: def.mascot,
            status,
            statusTone: AGENT_STATUS_TONE[status],
            openHref: installation === undefined ? null : agentHref(key, null),
        }
    })
    const categories =
        catalog.slot.isLoading === true
            ? Array.from(new Set(MODULE_KEYS.map((key) => MODULE_REGISTRY[key].category))).map((key) => ({
                  key,
                  label: "",
              }))
            : catalog.categories.map((category) => ({
                  key: category.key,
                  label: pickCopy(category.label, locale),
              }))
    const slot: DataSlot<boolean> = {
        isLoading: installationsSlot.isLoading === true || catalog.slot.isLoading === true,
        isError: installationsSlot.isError === true || catalog.slot.isError === true,
        isForbidden: installationsSlot.isForbidden === true || catalog.slot.isForbidden === true,
        items: catalog.slot.items === undefined || installationsSlot.items === undefined ? undefined : true,
    }
    return {
        entries,
        categories,
        slot,
        reload: () => {
            reloadInstallations()
            catalog.reload()
        },
    }
}
