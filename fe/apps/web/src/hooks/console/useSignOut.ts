import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { APP_ROUTES } from "@/modules/routes"

/** What a sign-out control needs: the command that ends the session. */
type SignOut = {
    readonly signOut: () => void
}

/** Ends the session with the db action the connected block entry passes in, then sends the reader to the sign-in page. */
export const useSignOut = (end: () => Promise<unknown>): SignOut => {
    const router = useRouter()
    const [, startTransition] = useTransition()
    return {
        signOut: () => {
            startTransition(async () => {
                await end()
                router.push(APP_ROUTES.login)
                router.refresh()
            })
        },
    }
}
