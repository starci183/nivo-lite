"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useProviderCrumb } from "@/hooks/connectionProvider"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { useTelegramChecks, useTelegramHead } from "@/hooks/telegramConnection"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import type { ConnectionLifecycle } from "@/modules/types"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"

import { TelegramConnectionHeadBase } from "./component"
import type { TelegramConnectionHeadBaseProps } from "./component"

/** The connection of the url and the open tab's body. */
interface TelegramConnectionHeadProps {
    readonly connectionId: string
    readonly children: ReactNode
}

/** Which command each step of the life needs. */
type HeadCommand = "recheck" | "settings" | "test" | "reconnect"

/** The command of a life: check a broken bot again, connect a disconnected one, continue an unfinished setup, else send a test. */
const commandOf = (life: ConnectionLifecycle | null): HeadCommand | null => {
    if (life === null) return null
    switch (life.id) {
        case "attention":
            return "recheck"
        case "disconnected":
            return "reconnect"
        case "setup":
        case "unconnected":
            return "settings"
        case "waiting":
        case "running":
            return "test"
    }
}

/**
 * The band of a Telegram bot connection page: the name, the status in the shared vocabulary, the one command it needs, "Check again"
 * and the owner disconnect in the menu, and the tabs. An id that is no connection of the workspace is `notFound()` once.
 */
export const TelegramConnectionHead = (props: TelegramConnectionHeadProps) => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const providerCrumb = useProviderCrumb("telegram")
    const head = useTelegramHead(props.connectionId)
    const { recheck, isRechecking } = useTelegramChecks(props.connectionId)
    const tabs = useConnectionPageTabs(head.agentCount)
    const [isAsking, setIsAsking] = useState(false)
    const refusal = useConnectionRefusal()
    if (head.isMissing && refusal === undefined) notFound()
    const view = "items" in head.head ? head.head.items : undefined
    const command = commandOf(head.life)
    const hubHref = workspaceHref(workspaceId, CONSOLE_ROUTES.connections)
    const actions: Readonly<Record<HeadCommand, NonNullable<TelegramConnectionHeadBaseProps["props"]["action"]>>> = {
        recheck: { label: t("recheck"), intent: "commit", isPending: isRechecking },
        settings: { label: tc("continueSetup"), intent: "commit" },
        test: { label: tc("actionTestSend"), intent: "neutral" },
        reconnect: { label: tc("actionReconnect"), intent: "commit" },
    }
    return (
        <TelegramConnectionHeadBase
            props={{
                name: view?.name ?? "",
                facts: view?.facts ?? "",
                chip: head.chip ?? { label: "", tone: "neutral" },
                isLoading: view === undefined,
                markSrc: PROVIDER_LOGO.telegram ?? "",
                ...(refusal === undefined ? {} : { refusalTitle: refusal.title }),
                crumbsLabel: tc("crumbLabel"),
                crumbs: [
                    { id: "connections", label: tc("title"), href: hubHref },
                    ...(providerCrumb === undefined ? [] : [providerCrumb]),
                    { id: "open", label: view?.name ?? t("title") },
                ],
                tabs: { label: tabs.label, selectedKey: tabs.selected, items: tabs.items },
                moreLabel: tc("moreActions"),
                ...(command === null || !head.isOwner ? {} : { action: actions[command] }),
                recheckLabel: t("recheck"),
                ...(head.isOwner && head.isLive ? { disconnectLabel: t("disconnectEntry") } : {}),
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectQuestionNamed", { name: view?.name ?? t("title") }),
                    description: t("disconnectBodyPage"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: tc("disconnectKeep"),
                    isPending: head.isDisconnecting,
                },
            }}
            on={{
                act: () => {
                    if (command === "recheck") void recheck()
                    else if (command === "reconnect") router.push(hubHref)
                    else router.push(tabs.hrefOf("settings"))
                },
                recheck: () => void recheck(),
                askDisconnect: () => setIsAsking(true),
                confirmDisconnect: () => void head.disconnect(),
                dismiss: () => setIsAsking(false),
            }}
            children={props.children}
        />
    )
}
