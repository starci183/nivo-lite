import { navigation } from "@/modules/i18n"
import { useTransition } from "react"
import { OFFICE_ROUTE } from "./console.shared"

/** Makes another workspace the current one with the db action the connected block entry passes in, then lands on its Office. */
export const useSwitchWorkspace = (
    currentId: string,
    switchTo: (workspaceId: string) => Promise<unknown>,
): ((workspaceId: string) => void) => {
    const router = navigation.useRouter()
    const [, startTransition] = useTransition()
    return (workspaceId) => {
        if (workspaceId === currentId) return
        startTransition(async () => {
            await switchTo(workspaceId)
            router.push(OFFICE_ROUTE)
            router.refresh()
        })
    }
}
