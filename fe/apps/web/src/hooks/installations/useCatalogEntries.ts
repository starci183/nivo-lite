"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { MODULE_KEYS, MODULE_REGISTRY, pickCopy, pickCopyList } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import type { AgentLifecycle } from "@/modules/installations"
import {
    installationPersonName,
    agentHref,
    agentLifecycleOf,
    agentLifecycleTone,
    foldText,
    instancesOf,
} from "@/modules/installations"
import type { DataSlot } from "@/modules/types"
import { useInstallations } from "./useInstallations"

/** One role of the catalogue in the reader language, with whether an agent of it is installed. */
export interface CatalogRole {
    readonly key: ModuleKey
    readonly categoryKey: string
    /** The name, description and points folded for matching, in both languages. */
    readonly searchText: string
    /** At least one agent of this role is installed. */
    readonly installed: boolean
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
}

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
    const roles = MODULE_KEYS.flatMap((key): ReadonlyArray<CatalogRole> => {
        const def = MODULE_REGISTRY[key]
        const copy = catalog.modules[key]
        const installation = installations === undefined ? undefined : instancesOf(installations, key)[0]
        if (installation !== undefined && !def.multiInstance) return []
        const category = catalog.categories.find((entry) => entry.key === def.category)
        return [
            {
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
