import { useTransition } from "react"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { OFFICE_ROUTE } from "./console.shared"

/** Makes another workspace the current one (kept in the browser, sent on every GraphQL operation), then lands on its Office. */
export const useSwitchWorkspace = (currentId: string): ((workspaceId: string) => void) => {
    const router = navigation.useRouter()
    const { select } = useActiveWorkspace()
    const [, startTransition] = useTransition()
    return (workspaceId) => {
        if (workspaceId === currentId) return
        startTransition(() => {
            select(workspaceId)
            router.push(OFFICE_ROUTE)
            router.refresh()
        })
    }
}
