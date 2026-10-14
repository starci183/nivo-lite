"use client"

import { useTransition } from "react"
import { useWorkspaceOpenStore } from "@/hooks/zustand/workspaceOpen"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, workspacePaymentPath } from "@/modules/routes"
import type { WorkspaceCardView } from "./workspaces.shared"
import { useActiveWorkspace } from "./useActiveWorkspace"

/** What opening a workspace gives the list. */
interface OpenWorkspace {
    /** Opens the workspace: an unpaid one goes to its payment step, a usable one becomes the active workspace and lands on the Office. */
    readonly open: (card: WorkspaceCardView) => void
    /** The id being opened, while it is. */
    readonly openingId: string | undefined
}

/**
 * Opens a workspace. The active workspace is kept in the browser (store and storage) so the GraphQL client sends it on every
 * operation, and mirrored in a cookie the server-rendered console pages still read until they move to GraphQL.
 */
export const useOpenWorkspace = (): OpenWorkspace => {
    const router = navigation.useRouter()
    const { select } = useActiveWorkspace()
    const openingId = useWorkspaceOpenStore((state) => state.openingId)
    const setOpeningId = useWorkspaceOpenStore((state) => state.setOpeningId)
    const [, startTransition] = useTransition()
    return {
        open: (card) => {
            setOpeningId(card.id)
            startTransition(() => {
                if (card.state !== "active") return router.push(workspacePaymentPath(card.id))
                select(card.id)
                router.push(APP_ROUTES.chat)
                router.refresh()
            })
        },
        openingId,
    }
}
