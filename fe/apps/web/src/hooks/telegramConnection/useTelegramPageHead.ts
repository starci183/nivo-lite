"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { readFailureNotice } from "@/hooks/connectionPage"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { ConnectionPageHeadCommands, ConnectionPageHeadView } from "@/modules/types"
import { useTelegramChecks } from "./useTelegramChecks"
import { useTelegramHead } from "./useTelegramHead"
import { useTelegramNotices } from "./useTelegramNotices"

/**
 * The frame of a Telegram bot connection page: the header with "Check again" (owner and manager), the notices (why the bot cannot work,
 * a refused command, a local site, no agent yet), the live rail's drawer and the owner's disconnect, which asks first. Nothing is read
 * while `connectionId` is undefined (the frame is serving another provider).
 */
export const useTelegramPageHead = (connectionId: string | undefined) => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { head, notice, disconnect, isDisconnecting, isMissing, isOwner, isLive } = useTelegramHead(connectionId)
    const { recheck, isRechecking } = useTelegramChecks(connectionId)
    const notices = useTelegramNotices(connectionId, notice)
    const failure = readFailureNotice(head, slotLabels(""), () => router.refresh())
    const [isAsking, setIsAsking] = useState(false)
    const [isRailOpen, setRailOpen] = useState(false)
    const view: ConnectionPageHeadView = {
        ...(head.items === undefined ? {} : { head: head.items }),
        isSkeleton: head.isLoading === true,
        icon: "chat",
        crumbLabel: t("crumbLabel"),
        crumbs: [
            { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
            { id: "telegram", label: head.items?.name ?? t("crumbTelegram") },
        ],
        gridLabel: t("title"),
        mainLabel: t("mainLabel"),
        rail: { label: t("eventsTitle"), openLabel: t("eventsOpen"), closeLabel: t("eventsClose"), isOpen: isRailOpen },
        action: { label: t("recheck"), intent: "neutral", isPending: isRechecking },
        notices: failure === undefined ? notices : [failure, ...notices],
        ...(isOwner && isLive
            ? {
                  disconnect: {
                      title: t("disconnectTitle"),
                      description: t("disconnectBody"),
                      label: t("disconnectEntry"),
                  },
              }
            : {}),
        confirm: {
            isOpen: isAsking,
            title: t("disconnectQuestion"),
            description: t("disconnectBody"),
            confirmLabel: t("disconnectConfirm"),
            cancelLabel: t("cancel"),
            isPending: isDisconnecting,
        },
    }
    const on: ConnectionPageHeadCommands = {
        act: () => void recheck(),
        askDisconnect: () => setIsAsking(true),
        confirmDisconnect: () => void disconnect(),
        dismiss: () => setIsAsking(false),
        openRail: setRailOpen,
        retry: () => router.refresh(),
    }
    return { view, on, isMissing }
}
