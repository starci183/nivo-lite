"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useProviderCrumb } from "@/hooks/connectionProvider"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal, wizardQuery } from "@/hooks/connections"
import { useSepayHead } from "@/hooks/sepayConnection"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { SepayConnectionHeadBase } from "./component"
import type { SepayConnectionHeadBaseProps } from "./component"
import type { SepayHeadCommand } from "@/hooks/sepayConnection"

/** The connection of the url and the open tab's body. */
interface SepayConnectionHeadProps {
    readonly connectionId: string
    readonly children?: ReactNode
}

/**
 * The connected page of a SePay connection: the band with the name, the status in the shared vocabulary (and "test" while the
 * environment is a test), the one command it needs (fix, continue the setup, connect again), the owner disconnect in the menu, and the
 * tabs. An id that is no connection of the workspace is `notFound()` once.
 */
export const SepayConnectionHead = (props: SepayConnectionHeadProps) => {
    const t = useTranslations("sepayConnection")
    const tc = useTranslations("connections")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const providerCrumb = useProviderCrumb("sepay")
    const head = useSepayHead(props.connectionId)
    const tabs = useConnectionPageTabs(head.agentCount)
    const [isAsking, setAsking] = useState(false)
    const refusal = useConnectionRefusal()
    if (head.isMissing && refusal === undefined) notFound()
    const connection = head.connection
    const command = head.command
    const hubHref = workspaceHref(workspaceId, CONSOLE_ROUTES.connections)
    const actions: Readonly<Record<SepayHeadCommand, NonNullable<SepayConnectionHeadBaseProps["props"]["action"]>>> = {
        fix: { label: tc("actionFix"), intent: "commit" },
        settings: { label: tc("continueSetup"), intent: "commit" },
        reconnect: { label: tc("actionReconnect"), intent: "commit" },
    }
    return (
        <SepayConnectionHeadBase
            props={{
                name: connection?.name ?? "",
                facts:
                    connection === undefined
                        ? ""
                        : t("headFacts", { account: connection.accountMasked.replace(/\*/g, "•") }),
                chips: head.chips.length === 0 ? [{ label: "", tone: "neutral" }] : head.chips,
                isLoading: connection === undefined,
                markSrc: PROVIDER_LOGO.sepay ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                crumbsLabel: tc("crumbLabel"),
                crumbs: [
                    { id: "connections", label: tc("title"), href: hubHref },
                    ...(providerCrumb === undefined ? [] : [providerCrumb]),
                    { id: "open", label: connection?.name ?? t("title") },
                ],
                tabs,
                moreLabel: tc("moreActions"),
                ...(command === null || !head.isOwner ? {} : { action: actions[command] }),
                ...(head.isOwner && connection !== undefined && connection.status !== "disconnected"
                    ? { disconnectLabel: t("disconnectEntry") }
                    : {}),
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectTitle"),
                    description: t("disconnectBody"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: t("cancel"),
                    isPending: head.isDisconnecting,
                },
            }}
            on={{
                act: () => {
                    if (command === "reconnect") router.push(`${hubHref}?${wizardQuery("sepay")}`)
                    else router.push(tabs.hrefOf("settings"))
                },
                askDisconnect: () => setAsking(true),
                confirmDisconnect: () => {
                    void head.disconnect().then((isDone) => {
                        setAsking(false)
                        if (isDone) router.replace(hubHref)
                    })
                },
                dismiss: () => setAsking(false),
            }}
            children={props.children}
        />
    )
}
