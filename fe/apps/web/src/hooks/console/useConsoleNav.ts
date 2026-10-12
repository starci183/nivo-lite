import { useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import type { ConsoleNavItem } from "@/modules/types"
import { DESTINATIONS, OFFICE_ROUTE, activeDestinationKey } from "./console.shared"

/** The rail destinations this role may see, translated, with the current route highlighted and the Office badge counted. */
export const useConsoleNav = (
    role: "owner" | "manager" | "staff",
    pendingCount: number,
): ReadonlyArray<ConsoleNavItem> => {
    const t = useTranslations("shell")
    const pathname = navigation.usePathname()
    const activeKey = activeDestinationKey(pathname)
    return DESTINATIONS.filter((d) => !d.managerOnly || role !== "staff").map((d) => ({
        id: d.key,
        label: t(d.label),
        href: d.route,
        icon: d.icon,
        group: d.group,
        isActive: d.key === activeKey,
        badge: d.route === OFFICE_ROUTE ? pendingCount : 0,
    }))
}
