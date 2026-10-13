import { useEffect } from "react"
import { navigation } from "@/modules/i18n"

/** How often the route is read again while the server works on a video, in milliseconds. */
const REFRESH_MS = 3000

/** While `active`, reads the route again on the server every few seconds so a script or render in progress shows its new state. */
export const useVideoRefresh = (active: boolean): void => {
    const router = navigation.useRouter()
    useEffect(() => {
        if (!active) return
        const timer = window.setInterval(() => router.refresh(), REFRESH_MS)
        return () => window.clearInterval(timer)
    }, [active, router])
}
