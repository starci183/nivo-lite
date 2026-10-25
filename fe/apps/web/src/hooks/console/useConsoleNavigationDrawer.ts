"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

/** The words and open state of the compact navigation drawer the console shell opens from its mobile row. */
export const useConsoleNavigationDrawer = () => {
    const t = useTranslations("shell")
    const [isOpen, setOpen] = useState(false)
    return {
        title: t("mainNavigation"),
        openLabel: t("openMenu"),
        closeLabel: t("closeMenu"),
        isOpen,
        setOpen,
    }
}
