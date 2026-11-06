"use client"

import { useEffect } from "react"
import { navigation } from "@/modules/i18n"
import { AUTH_ROUTES, workspaceHref, zaloReturnPath } from "@/modules/routes"
import { LocalStorage, StorageId } from "@/modules/storage"

/** What Zalo sends the browser back with. */
interface ZaloForwardInput {
    readonly code: string | undefined
    readonly oaId: string | undefined
    readonly state: string | undefined
}

/**
 * Forwards the Zalo return into the workspace that started the authorization (the browser kept its id when it left for Zalo), where the
 * page of the console hands it to the back end. A browser that kept none lands on the workspaces page.
 */
export const useZaloForward = (input: ZaloForwardInput): void => {
    const router = navigation.useRouter()
    const { code, oaId, state } = input
    useEffect(() => {
        const workspaceId = LocalStorage.get<string>(StorageId.ZaloOAuthWorkspace)
        LocalStorage.remove(StorageId.ZaloOAuthWorkspace)
        router.replace(
            workspaceId === undefined
                ? AUTH_ROUTES.workspaces
                : workspaceHref(workspaceId, zaloReturnPath({ code, oa_id: oaId, state })),
        )
    }, [router, code, oaId, state])
}
