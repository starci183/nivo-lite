import { useEffect } from "react"
import { navigation } from "@/modules/i18n"
import { LocalStorage, StorageId } from "@/modules/storage"
import { AUTH_ROUTES } from "@/modules/routes"
import { useActiveWorkspace } from "./useActiveWorkspace"

/** Sends a session without a workspace selection to the workspace picker after hydration. */
export const useRequireActiveWorkspace = () => {
    const workspace = useActiveWorkspace()
    const router = navigation.useRouter()
    useEffect(() => {
        if (
            workspace.activeWorkspaceId === undefined &&
            LocalStorage.get<string>(StorageId.ActiveWorkspaceId) === undefined
        ) {
            router.replace(AUTH_ROUTES.workspaces)
        }
    }, [workspace.activeWorkspaceId, router])
    return workspace
}
