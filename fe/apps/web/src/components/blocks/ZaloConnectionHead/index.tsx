"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useProviderCrumb } from "@/hooks/connectionProvider"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { useZaloChecks, useZaloHead, useZaloPage } from "@/hooks/zaloConnection"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { ConnectionLifecycle } from "@/modules/types"
import { ZaloConnectionHeadBase } from "./component"
import type { ZaloConnectionHeadBaseProps } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The connection of the url and the open tab's body. */
interface ZaloConnectionHeadProps {
    readonly connectionId: string
    readonly children?: ReactNode
}

/** Which command each step of the life needs: grant again a broken token, continue an unfinished setup, else send a test. */
type HeadCommand = "grant" | "settings" | "test"

const commandOf = (life: ConnectionLifecycle | null): HeadCommand | null => {
    if (life === null) return null
    if (life.id === "attention" || life.id === "disconnected") return "grant"
    return life.id === "setup" ? "settings" : "test"
}

/**
 * The connected page of a Zalo OA connection: the band with the name, the status in the shared vocabulary, the one command it needs
 * (grant again, continue the setup, send a test), "Check again" and the owner disconnect in the menu, and the tabs. An id that is no
 * connection of the workspace is `notFound()` once.
 */
export const ZaloConnectionHead = (props: ZaloConnectionHeadProps) => {
    const t = useTranslations("zaloConnection")
    const tc = useTranslations("connections")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const providerCrumb = useProviderCrumb("zalo_oa")
    const head = useZaloHead(props.connectionId)
    const { recheck } = useZaloChecks(props.connectionId)
    const { slot } = useZaloPage(props.connectionId)
    const tabs = useConnectionPageTabs(head.agentCount)
    const page = "items" in slot ? slot.items : undefined
    const [isAsking, setIsAsking] = useState(false)
    const refusal = useConnectionRefusal()
    if (head.isMissing && refusal === undefined) notFound()
    const view = "items" in head.head ? head.head.items : undefined
    const command = commandOf(head.life)
    const actions: Readonly<Record<HeadCommand, NonNullable<ZaloConnectionHeadBaseProps["props"]["action"]>>> = {
        grant: {
            label: head.life?.id === "disconnected" ? tc("actionReconnect") : tc("actionGrantAgain"),
            intent: "commit",
        },
        settings: { label: tc("continueSetup"), intent: "commit" },
        test: { label: tc("actionTestSend"), intent: "neutral" },
    }
    const hubHref = workspaceHref(workspaceId, CONSOLE_ROUTES.connections)
    const isLive = page !== undefined && page.status !== "disconnected"
    return (
        <ZaloConnectionHeadBase
            props={{
                name: view?.name ?? "",
                facts: view?.facts ?? "",
                chip: head.chip ?? { label: "", tone: "neutral" },
                isLoading: view === undefined,
                markSrc: PROVIDER_LOGO.zalo_oa ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                crumbsLabel: tc("crumbLabel"),
                crumbs: [
                    { id: "connections", label: tc("title"), href: hubHref },
                    ...(providerCrumb === undefined ? [] : [providerCrumb]),
                    { id: "open", label: view?.name ?? t("title") },
                ],
                tabs,
                moreLabel: tc("moreActions"),
                ...(command === null || !head.isOwner ? {} : { action: actions[command] }),
                recheckLabel: t("recheck"),
                ...(head.isOwner && isLive ? { disconnectLabel: t("disconnectEntry") } : {}),
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectQuestion"),
                    description: t("disconnectBody"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: t("cancel"),
                    isPending: head.isDisconnecting,
                },
            }}
            on={{
                act: () => {
                    if (command === "grant") void head.reconnect()
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
