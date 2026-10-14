import { useLocale } from "next-intl"
import { useEffect } from "react"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { AGENT_STATUS_TONE, agentHref, agentStatusOf, nextInstanceName } from "@/modules/installations"
import { useInstanceChannels } from "./useInstanceChannels"
import { useTypeRoute } from "./useTypeRoute"
import type { TypeRouteMode } from "./installations.shared"

/** The instances of one agent type for the list screen, with the names of the type in the reader language. */
export const useInstanceList = (module: ModuleKey, query: string, mode: TypeRouteMode) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const route = useTypeRoute(module, "setup", query, mode)
    const channelsOf = useInstanceChannels()
    const def = MODULE_REGISTRY[module]
    const catalog = useModuleCatalog()
    const copy = catalog.modules[module]
    const typeShort = copy === undefined ? "" : pickCopy(copy.shortName, locale)
    const instances = route.slot.items ?? []
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
        slot: {
            isLoading: route.slot.isLoading === true || catalog.slot.isLoading === true,
            isError: route.slot.isError === true || catalog.slot.isError === true,
            isForbidden: route.slot.isForbidden === true || catalog.slot.isForbidden === true,
            items: catalog.slot.items === undefined ? undefined : route.slot.items,
        },
        typeName: copy === undefined ? "" : pickCopy(copy.name, locale),
        typeShort,
        typeDescription: copy === undefined ? "" : pickCopy(copy.description, locale),
        isCopyReady: copy !== undefined,
        isMulti: def.multiInstance,
        names,
        defaultName: copy === undefined ? "" : nextInstanceName(typeShort, names),
        rows: instances.map((instance) => {
            const status = agentStatusOf(instance)
            return {
                id: instance.id,
                name: instance.name,
                channels: channelsOf(instance.agentId),
                activeVersion: instance.activeVersion,
                status,
                statusTone: AGENT_STATUS_TONE[status],
                openHref: agentHref(module, instance.id),
            }
        }),
    }
}
