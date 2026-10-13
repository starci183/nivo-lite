import { useLocale } from "next-intl"
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
    const typeShort = pickCopy(def.shortName, locale)
    const instances = route.slot.items ?? []
    const names = instances.map((instance) => instance.name)
    return {
        slot: route.slot,
        typeName: pickCopy(def.name, locale),
        typeShort,
        typeDescription: pickCopy(def.description, locale),
        isMulti: def.multiInstance,
        names,
        defaultName: nextInstanceName(typeShort, names),
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
