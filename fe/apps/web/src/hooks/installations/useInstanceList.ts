"use client"

import { useLocale } from "next-intl"
import { useEffect } from "react"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { loadingSlot, slotOfReads } from "@/hooks/slot"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import {
    agentHref,
    agentLifecycleOf,
    agentLifecycleTone,
    nextInstanceName,
    type Installation,
    type AgentLifecycle,
    type InstallationConnectionNeed,
} from "@/modules/installations"
import { useInstanceChannels } from "./useInstanceChannels"
import { useTypeRoute } from "./useTypeRoute"
import type { TypeRouteMode } from "./installations.shared"
import type { DataSlot } from "@/modules/types"

/** The view `useInstanceList` returns. */
export interface InstanceListView {
    slot: DataSlot<readonly Installation[]>
    typeName: string
    typeShort: string
    typeDescription: string
    isCopyReady: boolean
    isMulti: boolean
    names: string[]
    defaultName: string
    rows: {
        id: string
        name: string
        channels: readonly string[]
        activeVersion: number | null
        lifecycle: AgentLifecycle
        statusTone: "success" | "neutral" | "warning" | "accent"
        connectionNeeds: readonly InstallationConnectionNeed[]
        openHref: string
    }[]
}

/** The instances of one agent type for the list screen, with the names of the type in the reader language. */
export const useInstanceList = (module: ModuleKey, query: string, mode: TypeRouteMode): InstanceListView => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const route = useTypeRoute(module, "setup", query, mode)
    const channelsOf = useInstanceChannels()
    const def = MODULE_REGISTRY[module]
    const catalog = useModuleCatalog()
    const copy = catalog.modules[module]
    const typeShort = copy === undefined ? "" : pickCopy(copy.shortName, locale)
    const instances = route.instances
    const names = instances.map((instance) => instance.name)
    useEffect(() => {
        if (copy === undefined) return
        const previousTitle = document.title
        const title = pickCopy(copy.name, locale)
        document.title = title
        return () => {
            if (document.title === title) document.title = previousTitle
        }
    }, [copy, locale])
    return {
        slot: route.isLeaving
            ? loadingSlot<typeof instances>()
            : slotOfReads([route.read, catalog.read], () => instances),
        typeName: copy === undefined ? "" : pickCopy(copy.name, locale),
        typeShort,
        typeDescription: copy === undefined ? "" : pickCopy(copy.description, locale),
        isCopyReady: copy !== undefined,
        isMulti: def.multiInstance,
        names,
        defaultName: copy === undefined ? "" : nextInstanceName(typeShort, names),
        rows: instances.map((instance) => {
            const lifecycle = agentLifecycleOf(instance)
            return {
                id: instance.id,
                name: instance.name,
                channels: channelsOf(instance.agentId),
                activeVersion: instance.activeVersion,
                lifecycle,
                statusTone: agentLifecycleTone(lifecycle),
                connectionNeeds: instance.connectionNeeds,
                openHref: agentHref(module, instance.id),
            }
        }),
    }
}
