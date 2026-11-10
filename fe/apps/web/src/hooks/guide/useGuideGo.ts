"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { workspaceHref } from "@/modules/routes"
import { toast } from "@/modules/toast"
import type { GuideDoc } from "@/modules/guide"
import { useGuideSpotlight } from "./useGuideSpotlight"

/** The path of an address without its query and anchor. */
const pathOf = (href: string): string => href.split(/[?#]/u)[0] ?? href

/**
 * Opens a result: queues the spotlight, goes to the page and tab (the Next router), closes the drawer and offers a toast that goes
 * back to where the person was. `where` is the person's current page inside the workspace.
 */
export const useGuideGo = (where: string, close: () => void): ((doc: GuideDoc) => void) => {
    const t = useTranslations("guide")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const workspaceId = useWorkspaceId()
    const spotlight = useGuideSpotlight(pathname)
    return useCallback(
        (doc) => {
            const back = `${pathname}${window.location.search}`
            const isHere = pathOf(doc.href) === where
            spotlight(doc.target, isHere)
            router.push(workspaceHref(workspaceId, doc.href))
            close()
            toast.info(t("arrived", { title: doc.title }), {
                actionProps: { children: t("back"), onPress: () => router.push(back) },
            })
        },
        [pathname, where, spotlight, router, workspaceId, close, t],
    )
}
