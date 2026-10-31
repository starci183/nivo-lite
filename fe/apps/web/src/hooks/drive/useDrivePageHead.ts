"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { readFailureNotice } from "@/hooks/connectionPage"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { ConnectionPageHeadCommands, ConnectionPageHeadView } from "@/modules/types"
import { useDriveHead } from "./useDriveHead"

/**
 * The frame of the Google Drive page: the header with the grant-again command, the notices (the grant was revoked, Google sent the
 * owner back with a reason, a refused command), the progress rail's drawer and the owner's disconnect, which asks first. Nothing is
 * read while `enabled` is false (the frame is serving another provider).
 */
export const useDrivePageHead = (enabled: boolean) => {
    const t = useTranslations("driveConnection")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const { head, notices, grant, isGranting, disconnect, isDisconnecting, isOwner, standing } = useDriveHead(enabled)
    const [isAsking, setIsAsking] = useState(false)
    const [isRailOpen, setRailOpen] = useState(false)
    const failure = readFailureNotice(head, slotLabels(""), () => router.refresh())
    const canDisconnect = isOwner && standing !== undefined && standing !== "none"
    const view: ConnectionPageHeadView = {
        ...(head.items === undefined ? {} : { head: head.items }),
        isSkeleton: head.isLoading === true,
        icon: "apps",
        crumbLabel: t("crumbLabel"),
        crumbs: [
            { id: "connections", label: t("crumbConnections"), href: CONSOLE_ROUTES.connections },
            { id: "drive", label: t("crumbDrive") },
        ],
        gridLabel: t("title"),
        mainLabel: t("mainLabel"),
        rail: { label: t("progressTitle"), openLabel: t("progressOpen"), closeLabel: t("progressClose"), isOpen: isRailOpen },
        ...(standing === "lost" ? { action: { label: t("regrant"), intent: "commit" as const, isPending: isGranting } } : {}),
        notices: failure === undefined ? notices : [failure, ...notices],
        ...(canDisconnect
            ? { disconnect: { title: t("disconnectTitle"), description: t("disconnectBody"), label: t("disconnectEntry") } }
            : {}),
        confirm: {
            isOpen: isAsking,
            title: t("disconnectQuestion"),
            description: t("disconnectConfirmBody"),
            confirmLabel: t("disconnectConfirm"),
            cancelLabel: t("cancel"),
            isPending: isDisconnecting,
        },
    }
    const on: ConnectionPageHeadCommands = {
        act: grant,
        askDisconnect: () => setIsAsking(true),
        confirmDisconnect: () => void disconnect(),
        dismiss: () => setIsAsking(false),
        openRail: setRailOpen,
        retry: () => router.refresh(),
    }
    return { view, on }
}
