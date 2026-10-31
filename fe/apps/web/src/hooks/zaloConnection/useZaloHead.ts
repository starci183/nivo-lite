"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useSettledGraphQL, useZaloFailureLabel } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { useMutateAuthorizeZaloSwr, useMutateDisconnectConnectionSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { LocalStorage, StorageId } from "@/modules/storage"
import type { DataSlot, ZaloHeadView } from "@/modules/types"
import { chipToneOf, zaloStatusKindOf } from "./zaloConnection.shared"
import { useConnectionsRole } from "@/hooks/connections"
import { useZaloPage } from "./useZaloPage"
import type { ZaloPageData } from "./useZaloPage"

const CHIP_KEYS = { ok: "chipOk", waiting: "chipWaiting", check: "chipCheck" } as const

/** The header of the page of a Zalo OA connection, its status kind, and its two commands: reconnect through the existing authorization, and disconnect. */
export const useZaloHead = (connectionId: string) => {
    const t = useTranslations("zaloConnection")
    const format = useFormatter()
    const router = navigation.useRouter()
    const settle = useSettledGraphQL()
    const labelOf = useZaloFailureLabel()
    const { trigger: triggerAuthorize } = useMutateAuthorizeZaloSwr()
    const { trigger: triggerDisconnect, isMutating } = useMutateDisconnectConnectionSwr()
    const { slot, isMissing } = useZaloPage(connectionId)
    const { role } = useConnectionsRole()
    const [notice, setNotice] = useState("")

    const isOwner = role === "owner"
    const bannerOf = (page: ZaloPageData): string => {
        if (page.access.state === "none") return t(isOwner ? "bannerNone" : "bannerNoneAsk")
        if (page.access.state !== "expired" || page.access.expiresAt === null) return ""
        return t(isOwner ? "bannerExpired" : "bannerExpiredAsk", {
            ago: format.relativeTime(new Date(page.access.expiresAt), new Date()),
        })
    }
    const head: DataSlot<ZaloHeadView> = mapSlot(slot, (page) => ({
        name: page.name,
        chipLabel: t(CHIP_KEYS[zaloStatusKindOf(page.healthy, page.status, page.access.state)]),
        chipTone: chipToneOf(page.healthy, page.access.state, page.status),
        facts: t("facts", { oaId: page.oaId === "" ? "-" : page.oaId, appId: page.appId === "" ? "-" : page.appId }),
        banner: bannerOf(page),
    }))

    const reconnect = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => triggerAuthorize({ connectionId }))
        if (result.kind !== "ok") return setNotice(labelOf(result.code, result.message))
        LocalStorage.set(StorageId.ZaloReturn, connectionId)
        window.location.assign(result.value.url)
    }, [settle, labelOf, triggerAuthorize, connectionId])

    const disconnect = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => triggerDisconnect({ connectionId }), t("toastDisconnected"))
        if (result.kind !== "ok") return setNotice(labelOf(result.code, result.message))
        router.replace(CONSOLE_ROUTES.connections)
    }, [settle, labelOf, triggerDisconnect, connectionId, t, router])

    const page = slot.items
    const statusKind = page === undefined ? null : zaloStatusKindOf(page.healthy, page.status, page.access.state)

    return { head, notice, reconnect, disconnect, isDisconnecting: isMutating, isMissing, isOwner, statusKind }
}
