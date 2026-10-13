import { useState, useTransition } from "react"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, workspacePaymentPath } from "@/modules/routes"
import type { WorkspaceCardView } from "./workspaces.shared"

/** What opening a workspace gives the list. */
interface OpenWorkspace {
    /** Opens the workspace: an unpaid one goes to its payment step, a usable one becomes the current workspace and lands on the Office. */
    readonly open: (card: WorkspaceCardView) => void
    /** The id being opened, while it is. */
    readonly openingId: string | undefined
}

/** Opens a workspace with the db action the connected block entry passes in. */
export const useOpenWorkspace = (switchTo: (workspaceId: string) => Promise<unknown>): OpenWorkspace => {
    const router = navigation.useRouter()
    const [openingId, setOpeningId] = useState<string>()
    const [, startTransition] = useTransition()
    return {
        open: (card) => {
            setOpeningId(card.id)
            startTransition(async () => {
                if (card.state !== "active") return router.push(workspacePaymentPath(card.id))
                await switchTo(card.id)
                router.push(APP_ROUTES.chat)
                router.refresh()
            })
        },
        openingId,
    }
}
