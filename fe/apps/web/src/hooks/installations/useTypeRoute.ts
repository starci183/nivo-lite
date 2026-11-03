"use client"

import { useEffect } from "react"
import type { ModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { agentListHref, instancesOf } from "@/modules/installations"
import { AGENTS_ROUTE } from "@/modules/routes"
import type { AgentTab, Installation } from "@/modules/installations"
import type { DataSlot } from "@/modules/types"
import { loadingSlot, slotOfReads } from "@/hooks/slot"
import { typeTargetOf } from "./installations.shared"
import type { TypeRouteMode } from "./installations.shared"
import { useInstallations } from "./useInstallations"

/** The instances of one agent type, or where the url of the type leads instead. */
interface TypeRoute {
    readonly slot: DataSlot<ReadonlyArray<Installation>>
    readonly reload: () => void
    readonly read: ReturnType<typeof useInstallations>["read"]
    readonly instances: ReadonlyArray<Installation>
    /** A resolved redirect holds the same frame loading until the destination opens. */
    readonly isLeaving: boolean
}

/**
 * Resolves a type-level url (/agents/<type>[/tab]) over the installations. `page`: the only instance opens, none goes back to the
 * catalogue, several stay on the list. `list`: the list stays even for one instance. `redirect`: an old tab url always leaves for an
 * instance or the list. While it decides, or sends the person away, the slot reads as loading.
 */
export const useTypeRoute = (module: ModuleKey, tab: AgentTab, query: string, mode: TypeRouteMode): TypeRoute => {
    const router = navigation.useRouter()
    const installed = useInstallations()
    const target =
        installed.installations === undefined ? null : typeTargetOf(installed.installations, module, tab, query)
    const listed = target ?? (mode === "redirect" ? agentListHref(module) : null)
    const leaveTo = mode === "list" && listed !== AGENTS_ROUTE ? null : listed
    useEffect(() => {
        if (leaveTo !== null) router.replace(leaveTo)
    }, [leaveTo, router])
    const instances = instancesOf(installed.installations ?? [], module)
    return {
        slot:
            leaveTo !== null
                ? loadingSlot<ReadonlyArray<Installation>>()
                : slotOfReads([installed.read], () => instances),
        reload: installed.reload,
        read: installed.read,
        instances,
        isLeaving: leaveTo !== null,
    }
}
