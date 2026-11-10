"use client"

import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

const unsubscribe = () => undefined

const subscribeNever = () => unsubscribe

/** The reader's appearance: light or dark, persisted by next-themes; light until hydration so server and client agree. */
type ThemeChoice = {
    readonly isDark: boolean
    readonly choose: (isDark: boolean) => void
}

/** Reads and writes the appearance the provider stack stores for the whole app. */
export const useThemeSwitch = (): ThemeChoice => {
    const { resolvedTheme, setTheme } = useTheme()
    const isHydrated = useSyncExternalStore(
        subscribeNever,
        () => true,
        () => false,
    )
    return {
        isDark: isHydrated && resolvedTheme === "dark",
        choose: (isDark) => setTheme(isDark ? "dark" : "light"),
    }
}
