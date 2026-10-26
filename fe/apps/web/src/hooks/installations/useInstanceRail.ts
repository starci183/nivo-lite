"use client"

import { useLocale } from "next-intl"
import { useModuleCatalog } from "@/hooks/moduleCatalog"
import { pickCopy } from "@/modules/catalog"
import { installationPersonName, agentHref, agentLifecycleOf, agentLifecycleTone } from "@/modules/installations"
import { useInstallations } from "./useInstallations"

/** The installed agents (one row per instance, as people of the team) for the switcher of the agent frame; no rows until they are known. */
export const useInstanceRail = (installationId: string) => {
    const locale = useLocale() === "en" ? "en" : "vi"
    const { installations } = useInstallations()
    const catalog = useModuleCatalog()
    return {
        isLoading: installations === undefined || catalog.slot.isLoading === true,
        items: (installations ?? []).map((other) => {
            const lifecycle = agentLifecycleOf(other)
            const copy = catalog.modules[other.moduleKey]
            return {
                id: other.id,
                href: agentHref(other.moduleKey, other.id),
                name: installationPersonName(other),
                seed: other.agentId ?? other.id,
                roleName: copy === undefined ? "" : pickCopy(copy.name, locale),
                isCurrent: other.id === installationId,
                lifecycle,
                statusTone: agentLifecycleTone(lifecycle),
            }
        }),
    }
}
