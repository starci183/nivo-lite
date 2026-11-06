"use client"

import { useSearchParams } from "next/navigation"
import { navigation } from "@/modules/i18n"
import { workspaceIdOfAddress } from "@/modules/routes"

/**
 * The workspace of the address that is open, if it names one: the first segment of a workspace page, or the `ws` of the steps of
 * creating a workspace. For the readers that also run outside the console; a console page reads `useWorkspaceId`.
 */
export const useOpenWorkspaceId = (): string | undefined => {
    const pathname = navigation.usePathname()
    const search = useSearchParams()
    return workspaceIdOfAddress(pathname, search.toString())
}
