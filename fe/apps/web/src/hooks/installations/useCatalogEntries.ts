"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { MODULE_KEYS, MODULE_REGISTRY, pickCopy, pickCopyList } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type { AgentLifecycle, SetupProgress } from "@/modules/installations"
import {
    installationPersonName,
    agentHref,
    agentLifecycleOf,
    agentListHref,
    agentLifecycleTone,
    foldText,
    instancesOf,
} from "@/modules/installations"
import type { DataSlot } from "@/modules/types"
import { useInstallations } from "./useInstallations"
import { useInstanceChannels } from "./useInstanceChannels"

/** One role of the catalogue in the reader language, with whether an agent of it is installed. */
export interface CatalogRole {
    readonly key: ModuleKey
    readonly categoryKey: string
    /** The name, description and points folded for matching, in both languages. */
    readonly searchText: string
    /** At least one agent of this role is installed. */
    readonly installed: boolean
    /** How many agents of this role are installed. */
    readonly installedCount: number
    /** Where another agent of an installed role that runs several is added by name; null when the card installs instead. */
    readonly addHref: string | null
    readonly isEarly: boolean
    readonly name: string
    readonly description: string
    readonly points: ReadonlyArray<string>
    readonly mascot: string
    /** Where the installed agent of this role opens; null when none is installed. */
    readonly openHref: string | null
}

/** One installed agent as a person of the team. */
interface InstalledAgent {
    readonly id: string
    readonly name: string
    /** The seed of the generated avatar. */
    readonly seed: string
    readonly avatarUrl: string | null
    readonly roleName: string
    readonly lifecycle: AgentLifecycle
    readonly tone: ReturnType<typeof agentLifecycleTone>
    readonly href: string
    /** The names of the channels its agent is bound to; empty when none. */
    readonly channels: ReadonlyArray<string>
    /** The required setup gates confirmed, of all of them. */
    readonly setupProgress: SetupProgress
}

type ModuleCatalog = ReturnType<typeof useModuleCatalog>

/** The category filter entries in the reader language; blank labels while the catalogue loads so the filter keeps its shape. */
const categoriesOf = (
    catalog: ModuleCatalog,
    locale: "vi" | "en",
): ReadonlyArray<{ readonly key: string; readonly label: string }> =>
    catalog.slot.isLoading === true
        ? Array.from(new Set(MODULE_KEYS.map((key) => MODULE_REGISTRY[key].category))).map((key) => ({
              key,
              label: "",
          }))
        : catalog.categories.map((category) => ({
              key: category.key,
              label: pickCopy(category.label, locale),
          }))

/** The installed agents, the roles still to add (a single-instance role that is installed does not repeat), and the categories. */
export const useCatalogEntries = (): {
    readonly agents: ReadonlyArray<InstalledAgent>
    readonly roles: ReadonlyArray<CatalogRole>
    readonly categories: ReadonlyArray<{ readonly key: string; readonly label: string }>
    readonly slot: DataSlot<boolean>
    readonly reload: () => void
} => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { slot: installationsSlot, installations, reload: reloadInstallations } = useInstallations()
    const catalog = useModuleCatalog()
    const channelsOf = useInstanceChannels()
    const roles = MODULE_KEYS.flatMap((key): ReadonlyArray<CatalogRole> => {
        const def = MODULE_REGISTRY[key]
        const copy = catalog.modules[key]
        const instances = installations === undefined ? [] : instancesOf(installations, key)
        const installation = instances[0]
        if (installation !== undefined && !def.multiInstance) return []
        const category = catalog.categories.find((entry) => entry.key === def.category)
        return [
            {
                key,
                categoryKey: def.category,
                installed: installation !== undefined,
                installedCount: instances.length,
                addHref: installation !== undefined && def.multiInstance ? agentListHref(key) : null,
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
                openHref: installation === undefined ? null : agentHref(key, installation.id),
            },
        ]
    })
    const agents = (installations ?? []).map((installation): InstalledAgent => {
        const copy = catalog.modules[installation.moduleKey]
        const lifecycle = agentLifecycleOf(installation)
        return {
            id: installation.id,
            name: installationPersonName(installation),
            seed: installation.agentId ?? installation.id,
            avatarUrl: installation.agentAvatarUrl,
            roleName: copy === undefined ? "" : pickCopy(copy.name, locale),
            lifecycle,
            tone: agentLifecycleTone(lifecycle),
            href: agentHref(installation.moduleKey, installation.id),
            channels: channelsOf(installation.agentId),
            setupProgress: installation.setupProgress,
        }
    })
    const categories = categoriesOf(catalog, locale)
    const slot: DataSlot<boolean> = {
        isLoading: installationsSlot.isLoading === true || catalog.slot.isLoading === true,
        isError: installationsSlot.isError === true || catalog.slot.isError === true,
        isForbidden: installationsSlot.isForbidden === true || catalog.slot.isForbidden === true,
        items: catalog.slot.items === undefined || installationsSlot.items === undefined ? undefined : true,
    }
    return {
        agents,
        roles,
        categories,
        slot,
        reload: () => {
            reloadInstallations()
            catalog.reload()
        },
    }
}
