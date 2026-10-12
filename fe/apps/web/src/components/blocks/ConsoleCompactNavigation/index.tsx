"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useConsoleNav } from "@/hooks/console"
import { ConsoleCompactNavigationBase } from "./component"

/** The role and the real count the compact bar needs. */
type ConsoleCompactNavigationProps = {
    readonly role: "owner" | "manager" | "staff"
    readonly pendingCount: number
}

/** The compact bar keeps these three destinations; the rest sit behind "More" (the wide rail shows everything). */
const PHONE_TABS = new Set(["chat", "overview", "leads"])

/** The connected compact navigation shown below the wide breakpoint. */
export const ConsoleCompactNavigation = (props: ConsoleCompactNavigationProps) => {
    const t = useTranslations("shell")
    const router = useRouter()
    const items = useConsoleNav(props.role, props.pendingCount)
    const [isMoreOpen, setMoreOpen] = useState(false)
    return (
        <ConsoleCompactNavigationBase
            props={{
                tabs: items.filter((item) => PHONE_TABS.has(item.id)),
                more: items.filter((item) => !PHONE_TABS.has(item.id)),
                moreLabel: t("navMore"),
                groupLabels: { operate: t("groupOperate"), setup: t("groupSetup") },
                isMoreOpen,
            }}
            on={{ go: (href) => router.push(href), setMoreOpen }}
        />
    )
}
