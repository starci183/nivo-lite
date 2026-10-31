"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useConnectionsRole, useDisconnectConnection } from "@/hooks/connections"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { ConnectionHeadView, DataSlot } from "@/modules/types"
import { telegramChipToneOf, telegramStatusKindOf } from "./telegramConnection.shared"
import { useTelegramPage } from "./useTelegramPage"

const CHIP_KEYS = { ok: "chipOk", check: "chipCheck", off: "chipOff" } as const

/** The header of the page of a Telegram bot connection, its status kind, and its one owner command: disconnect. */
export const useTelegramHead = (connectionId: string | undefined) => {
    const t = useTranslations("telegramConnection")
    const settle = useSettledGraphQL()
    const router = navigation.useRouter()
    const { trigger, isMutating } = useDisconnectConnection("telegram")
    const { slot, isMissing } = useTelegramPage(connectionId)
    const { role } = useConnectionsRole()
    const [notice, setNotice] = useState("")

    const head: DataSlot<ConnectionHeadView> = mapSlot(slot, (page) => {
        const kind = telegramStatusKindOf(page.healthy, page.status)
        return {
            name: page.name,
            chipLabel: t(CHIP_KEYS[kind]),
            chipTone: telegramChipToneOf(kind),
            facts: t("facts", { handle: page.botUsername === "" ? "-" : `@${page.botUsername}` }),
        }
    })

    const disconnect = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => trigger(connectionId ?? ""), t("toastDisconnected"))
        if (result.kind !== "ok") return setNotice(result.message)
        router.replace(CONSOLE_ROUTES.connections)
    }, [settle, trigger, connectionId, t, router])

    return {
        head,
        notice,
        disconnect,
        isDisconnecting: isMutating,
        isMissing,
        isOwner: role === "owner",
        isLive: slot.items !== undefined && slot.items.status !== "disconnected",
    }
}
