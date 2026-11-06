"use client"

import { useMemo } from "react"
import { navigation } from "@/modules/i18n"
import { workspaceHref } from "@/modules/routes"
import { useWorkspaceId } from "./useWorkspaceId"

/** The options the locale-aware router takes beside the address. */
type NavigateOptions = Parameters<ReturnType<typeof navigation.useRouter>["push"]>[1]

/** The router of the open workspace: it takes the path of a page inside the workspace and opens it at its address. */
export interface WorkspaceRouter {
    readonly push: (path: string, options?: NavigateOptions) => void
    readonly replace: (path: string, options?: NavigateOptions) => void
}

/** Opens the pages of the workspace of the address: `push` and `replace` take a path such as `/leads/abc` and build its address with `workspaceHref`. */
export const useWorkspaceRouter = (): WorkspaceRouter => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    return useMemo(
        () => ({
            push: (path, options) => router.push(workspaceHref(workspaceId, path), options),
            replace: (path, options) => router.replace(workspaceHref(workspaceId, path), options),
        }),
        [router, workspaceId],
    )
}
