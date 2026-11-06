"use client"

import { useTransition } from "react"
import { useWorkspaceOpenStore } from "@/hooks/zustand/workspaceOpen"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, workspaceHref, workspacePaymentPath } from "@/modules/routes"
import type { WorkspaceCardView } from "./workspaces.shared"

/** What opening a workspace gives the list. */
interface OpenWorkspace {
    /** Opens the workspace: an unpaid one goes to its payment step, a usable one lands on its Office. */
    readonly open: (card: WorkspaceCardView) => void
    /** The id being opened, while it is. */
    readonly openingId: string | undefined
}

/** Opens a workspace: the address of its Office names it, and that address is what every operation then carries. */
export const useOpenWorkspace = (): OpenWorkspace => {
    const router = navigation.useRouter()
    const openingId = useWorkspaceOpenStore((state) => state.openingId)
    const setOpeningId = useWorkspaceOpenStore((state) => state.setOpeningId)
    const [, startTransition] = useTransition()
    return {
        open: (card) => {
            setOpeningId(card.id)
            startTransition(() => {
                if (card.state !== "active") return router.push(workspacePaymentPath(card.id))
                router.push(workspaceHref(card.id, APP_ROUTES.workspaceHome))
            })
        },
        openingId,
    }
}
