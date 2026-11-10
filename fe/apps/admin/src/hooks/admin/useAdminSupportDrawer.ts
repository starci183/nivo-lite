"use client"

import { useSearchParams } from "next/navigation"
import { navigation } from "@/modules/i18n"

/** The key of the address query that says the support actions drawer is open. */
const SUPPORT_KEY = "support"

/** The view `useAdminSupportDrawer` returns. */
export interface AdminSupportDrawerView {
    readonly isOpen: boolean
    readonly setOpen: (isOpen: boolean) => void
}

/** Whether the support actions drawer of a workspace is open: kept in the address, so the header command and the drawer, two blocks, share it. */
export const useAdminSupportDrawer = (): AdminSupportDrawerView => {
    const params = useSearchParams()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    return {
        isOpen: params.get(SUPPORT_KEY) === "1",
        setOpen: (isOpen) => router.replace(isOpen ? `${pathname}?${SUPPORT_KEY}=1` : pathname),
    }
}
