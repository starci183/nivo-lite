"use client"

import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { useConnectionsRole, useDisconnectConnection } from "@/hooks/connections"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { lifecycleChipOf } from "@/modules/connection-lifecycle"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { ConnectionHeadView, ConnectionLifecycle, ConnectionLifecycleChip, DataSlot } from "@/modules/types"
import { telegramChipToneOf, telegramLifecycleOf, telegramStatusKindOf } from "./telegramConnection.shared"
import { useTelegramPage } from "./useTelegramPage"
import { useWorkspaceId } from "@/hooks/workspaces"

const CHIP_KEYS = { ok: "chipOk", check: "chipCheck", off: "chipOff" } as const

type UseTelegramHeadResult = {
    head: DataSlot<ConnectionHeadView>
    notice: string
    disconnect: () => Promise<void>
    isDisconnecting: boolean
    isMissing: boolean
    isOwner: boolean
    isLive: boolean
    /** Where the connection stands in the shared life; null while the page is read. */
    life: ConnectionLifecycle | null
    /** The status badge of that life in the shared vocabulary; null while the page is read. */
    chip: ConnectionLifecycleChip | null
    /** How many agents work through the bot; undefined while the page is read. */
    agentCount: number | undefined
}

/** The header of the page of a Telegram bot connection, its status kind, and its one owner command: disconnect. */
export const useTelegramHead = (connectionId: string | undefined): UseTelegramHeadResult => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const settle = useSettledGraphQL()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { trigger, isMutating } = useDisconnectConnection("telegram")
    const { slot, isMissing } = useTelegramPage(connectionId)
    const page = "items" in slot ? slot.items : undefined
    const life = page === undefined ? null : telegramLifecycleOf(page)
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
        router.replace(workspaceHref(workspaceId, CONSOLE_ROUTES.connections))
    }, [settle, trigger, connectionId, t, router, workspaceId])

    return {
        head,
        notice,
        disconnect,
        isDisconnecting: isMutating,
        isMissing,
        isOwner: role === "owner",
        isLive: page !== undefined && page.status !== "disconnected",
        life,
        chip: life === null ? null : lifecycleChipOf(life, (key, values) => tc(key, values)),
        agentCount: page?.agentIds.length,
    }
}
