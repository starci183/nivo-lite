"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { MODULE_KEYS, MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import { AGENT_STATUS_TONE, agentHref, agentStatusOf } from "@/modules/installations"
import { useInstallations } from "./useInstallations"

/** The installed agents (one row per instance) for the switcher of the agent frame; the catalogue, not installed, until they are known. */
export const useInstanceRail = (installationId: string) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { installations } = useInstallations()
    const catalog = useModuleCatalog()
    if (installations === undefined) {
        return {
            isLoading: true,
            items: MODULE_KEYS.map((key) => {
                const copy = catalog.modules[key]
                const fallbackName = catalog.slot.isError === true ? key : ""
                return {
                    id: key,
                    href: agentHref(key, null),
                    name: copy === undefined ? fallbackName : pickCopy(copy.name, locale),
                    isNameLoading: copy === undefined && catalog.slot.isLoading === true,
                    mascot: MODULE_REGISTRY[key].mascot,
                    isCurrent: false,
                    status: agentStatusOf(undefined),
                    statusTone: AGENT_STATUS_TONE.notInstalled,
                }
            }),
        }
    }
    return {
        isLoading: catalog.slot.isLoading === true,
        items: installations.map((other) => {
            const status = agentStatusOf(other)
            const copy = catalog.modules[other.moduleKey]
            const fallbackName = catalog.slot.isError === true ? other.moduleKey : ""
            const typeName = copy === undefined ? fallbackName : pickCopy(copy.name, locale)
            return {
                id: other.id,
                href: agentHref(other.moduleKey, other.id),
                name: other.isMulti ? other.name : typeName,
                isNameLoading: !other.isMulti && copy === undefined && catalog.slot.isLoading === true,
                mascot: MODULE_REGISTRY[other.moduleKey].mascot,
                isCurrent: other.id === installationId,
                status,
                statusTone: AGENT_STATUS_TONE[status],
            }
        }),
    }
}
