"use client"

import { useTransition } from "react"
import { useSWRConfig } from "swr"
import { useViewerKeyId } from "@/hooks/workspaceKey"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { isWorkspaceSwitchSwrKey } from "@/modules/utils"
import { OFFICE_ROUTE } from "./console.shared"

/**
 * Makes another workspace the current one (kept in the browser, sent on every GraphQL operation), then lands on its Office. The
 * cached answers of the workspace being left are dropped first, so nothing read for it can be drawn under the next one.
 */
export const useSwitchWorkspace = (currentId: string): ((workspaceId: string) => void) => {
    const router = navigation.useRouter()
    const { select } = useActiveWorkspace()
    const { mutate } = useSWRConfig()
    const viewerKeyId = useViewerKeyId()
    const [, startTransition] = useTransition()
    return (workspaceId) => {
        if (workspaceId === currentId) return
        startTransition(() => {
            void mutate(isWorkspaceSwitchSwrKey(viewerKeyId), undefined, { revalidate: false })
            select(workspaceId)
            router.push(OFFICE_ROUTE)
            router.refresh()
        })
    }
}
