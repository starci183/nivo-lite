"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { useMutateAuthorizeZaloSwr, useMutateDisconnectConnectionSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LocalStorage, StorageId } from "@/modules/storage"
import type { DataSlot, ZaloHeadView } from "@/modules/types"
import { chipToneOf } from "./zaloConnection.shared"
import { useZaloPage } from "./useZaloPage"
import type { ZaloPageData } from "./useZaloPage"

/** The header of the page of a Zalo OA connection and its two actions: reconnect through the existing authorization, and disconnect. */
export const useZaloHead = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const router = navigation.useRouter()
    const settle = useSettledGraphQL()
    const { trigger: triggerAuthorize } = useMutateAuthorizeZaloSwr()
    const { trigger: triggerDisconnect, isMutating } = useMutateDisconnectConnectionSwr()
    const { slot } = useZaloPage(connectionId)
    const [notice, setNotice] = useState("")

    const bannerOf = (page: ZaloPageData): string => {
        if (page.access.state === "none") return t("bannerNone")
        if (page.access.state !== "expired" || page.access.expiresAt === null) return ""
        return t("bannerExpired", { ago: format.relativeTime(new Date(page.access.expiresAt), new Date()) })
    }
    const head: DataSlot<ZaloHeadView> = mapSlot(slot, (page) => ({
        name: page.name,
        chipLabel: page.healthy ? t("chipOk") : t("chipCheck"),
        chipTone: chipToneOf(page.healthy, page.access.state, page.status),
        facts: t("facts", { oaId: page.oaId === "" ? "-" : page.oaId, appId: page.appId === "" ? "-" : page.appId }),
        banner: bannerOf(page),
    }))

    const reconnect = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => triggerAuthorize({ connectionId }))
        if (result.kind !== "ok") return setNotice(result.message)
        LocalStorage.set(StorageId.ZaloReturn, connectionId)
        window.location.assign(result.value.url)
    }, [settle, triggerAuthorize, connectionId])

    const disconnect = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => triggerDisconnect({ connectionId }), t("toastDisconnected"))
        if (result.kind !== "ok") return setNotice(result.message)
        router.replace(CONSOLE_ROUTES.connections)
    }, [settle, triggerDisconnect, connectionId, t, router])

    return { head, notice, reconnect, disconnect, isDisconnecting: isMutating }
}
