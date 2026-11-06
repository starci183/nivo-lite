"use client"

import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionRefusal } from "@/hooks/connections"
import { usePaneCopy } from "@/hooks/paneFrame"
import { useZaloChecks, useZaloHead, useZaloPage } from "@/hooks/zaloConnection"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { ZaloHeadView } from "@/modules/types"
import { ZaloConnectionHeadBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const HEAD_PLACEHOLDER: ZaloHeadView = { name: "-", chipLabel: "-", chipTone: "neutral", facts: "-", banner: "" }

/** The connection of the url. */
interface ZaloConnectionHeadProps {
    readonly connectionId: string
}

/**
 * The connected head band of a Zalo OA connection page: the name and state, "Check again", and the owner disconnect, which asks
 * first. An id that is no connection of the workspace is `notFound()` once.
 */
export const ZaloConnectionHead = (props: ZaloConnectionHeadProps) => {
    const t = useTranslations("zaloConnection")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { head, disconnect, isDisconnecting, isMissing, isOwner } = useZaloHead(props.connectionId)
    const { recheck, isRechecking } = useZaloChecks(props.connectionId)
    const { slot } = useZaloPage(props.connectionId)
    const page = "items" in slot ? slot.items : undefined
    const [isAsking, setIsAsking] = useState(false)
    const refusal = useConnectionRefusal()
    if (isMissing && refusal === undefined) notFound()
    const isLive = page !== undefined && page.status !== "disconnected"
    return (
        <ZaloConnectionHeadBase
            props={{
                head: "items" in head ? head.items : HEAD_PLACEHOLDER,
                isLoading: "isLoading" in head,
                markSrc: PROVIDER_LOGO.zalo_oa ?? "",
                ...(refusal === undefined ? {} : { refusal }),
                backLabel: pane.backToList,
                moreLabel: pane.moreActions,
                railLabel: t("eventsOpen"),
                recheckLabel: t("recheck"),
                isRechecking,
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
            }}
            on={{
                recheck: () => void recheck(),
                askDisconnect: () => setIsAsking(true),
                confirmDisconnect: () => void disconnect(),
                dismiss: () => setIsAsking(false),
                back: () => router.push(workspaceHref(workspaceId, CONSOLE_ROUTES.connections)),
            }}
        />
    )
}
