"use client"

import { useSearchParams } from "next/navigation"
import { navigation } from "@/modules/i18n"
import { agentWorkViewOf, agentWorkViewQuery } from "@/modules/agentWork"
import type { AgentWorkViewKey } from "@/modules/agentWork"

/** The view `useAgentWorkView` returns. */
export interface AgentWorkViewState {
    view: AgentWorkViewKey
    select: (view: AgentWorkViewKey) => void
}

/** Which view of the Work tab the URL opens, and the move to the other one. */
export const useAgentWorkView = (): AgentWorkViewState => {
    const params = useSearchParams()
    const pathname = navigation.usePathname()
    const router = navigation.useRouter()
    return {
        view: agentWorkViewOf((name) => params.get(name)),
        select: (view) => {
            const query = agentWorkViewQuery(view)
            router.push(query === "" ? pathname : `${pathname}?${query}`)
        },
    }
}
