"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { connectionCrumbsOf, connectionHeadStateOf, readFailureNotice } from "@/hooks/connectionPage"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import type { ConnectionPageHeadCommands, ConnectionPageHeadView } from "@/modules/types"
import { useTelegramChecks } from "./useTelegramChecks"
import { useTelegramHead } from "./useTelegramHead"
import { useTelegramNotices } from "./useTelegramNotices"
import { useWorkspaceId } from "@/hooks/workspaces"

type UseTelegramPageHeadResult = {
    view: ConnectionPageHeadView
    on: ConnectionPageHeadCommands
    isMissing: boolean
}

/**
 * The frame of a Telegram bot connection page: the header with "Check again" (owner and manager), the notices (why the bot cannot work,
 * a refused command, a local site, no agent yet), the live rail's drawer and the owner's disconnect, which asks first. Nothing is read
 * while `connectionId` is undefined (the frame is serving another provider).
 */
export const useTelegramPageHead = (connectionId: string | undefined): UseTelegramPageHeadResult => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { head, notice, disconnect, isDisconnecting, isMissing, isOwner, isLive } = useTelegramHead(connectionId)
    const { recheck, isRechecking } = useTelegramChecks(connectionId)
    const notices = useTelegramNotices(connectionId, notice)
    const failure = readFailureNotice(head, slotLabels(""), () => router.refresh())
    const [isAsking, setIsAsking] = useState(false)
    const [isRailOpen, setRailOpen] = useState(false)
    const headState = connectionHeadStateOf(head)
    const view: ConnectionPageHeadView = {
        ...headState,
        icon: "chat",
        crumbLabel: t("crumbLabel"),
        crumbs: connectionCrumbsOf(workspaceId, t("crumbConnections"), {
            id: "telegram",
            label: headState.head?.name ?? t("crumbTelegram"),
        }),
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
