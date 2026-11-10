"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { ReactNode } from "react"
import { GOOGLE_ACCOUNT_LOGO } from "@/hooks/connection-providers"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { DRIVE_PAGE_PATH, useDriveHead, useDriveLife } from "@/hooks/drive"
import { useGoogleAccount } from "@/hooks/google"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { DriveConnectionHeadBase } from "./component"
import type { DriveConnectionHeadBaseProps } from "./component"

/** The routed page the band sits over. */
interface DriveConnectionHeadProps {
    readonly children: ReactNode
}

/**
 * The connected page of the workspace's Google account: the band with the account's email as the name, the status in the shared
 * vocabulary, how many services are on, the one command Drive's status needs (grant, grant again, continue the setup), the owner's
 * disconnect of the Drive grant in the menu (it asks first), and the tabs (Services, Events, Agents, Settings). The root of the Google
 * route layout: it draws the one Page of every route under it.
 */
export const DriveConnectionHead = (props: DriveConnectionHeadProps) => {
    const t = useTranslations("driveConnection")
    const tc = useTranslations("connections")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const { life, agentCount } = useDriveLife()
    const account = useGoogleAccount()
    const { grant, isGranting, disconnect, isDisconnecting, isOwner, standing } = useDriveHead()
    const tabs = useConnectionPageTabs(agentCount, undefined, { overview: t("tabServices") })
    const [isAsking, setIsAsking] = useState(false)
    const refusal = useConnectionRefusal()
    const action = ((): DriveConnectionHeadBaseProps["props"]["action"] => {
        if (life === null) return undefined
        if (life.id === "attention") return { label: tc("actionGrantAgain"), intent: "commit", isPending: isGranting }
        return life.id === "waiting" ? { label: tc("continueSetup"), intent: "commit" } : undefined
    })()
    const email = account.email ?? ""
    return (
        <DriveConnectionHeadBase
            props={{
                name: email === "" ? t("googleTitle") : email,
                facts: account.servicesOn === undefined ? "" : t("metaServices", { count: account.servicesOn }),
                chip: account.chip ?? { label: "", tone: "neutral" },
                isLoading: account.email === undefined,
                markSrc: GOOGLE_ACCOUNT_LOGO,
                ...(refusal === undefined ? {} : { refusal }),
                crumbsLabel: tc("crumbLabel"),
                crumbs: [
                    {
                        id: "connections",
                        label: tc("title"),
                        href: workspaceHref(workspaceId, CONSOLE_ROUTES.connections),
                    },
                    {
                        id: "google",
                        label: t("googleTitle"),
                        ...(email === "" ? {} : { href: workspaceHref(workspaceId, DRIVE_PAGE_PATH) }),
                    },
                    ...(email === "" ? [] : [{ id: "account", label: email }]),
                ],
                tabs,
                moreLabel: tc("moreActions"),
                ...(action === undefined ? {} : { action }),
                ...(isOwner && standing !== undefined && standing !== "none"
                    ? { disconnectLabel: t("disconnectEntry") }
                    : {}),
                confirm: {
                    isOpen: isAsking,
                    title: t("disconnectQuestion"),
                    description: t("disconnectConfirmBody"),
                    confirmLabel: t("disconnectConfirm"),
                    cancelLabel: t("cancel"),
                    isPending: isDisconnecting,
                },
            }}
            on={{
                act: () => {
                    if (life?.id === "waiting") router.push(tabs.hrefOf("settings"))
                    else grant()
                },
                askDisconnect: () => setIsAsking(true),
                confirmDisconnect: () => void disconnect(),
                dismiss: () => setIsAsking(false),
            }}
            children={props.children}
        />
    )
}
