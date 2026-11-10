"use client"

import { useTranslations } from "next-intl"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { GOOGLE_SERVICE_LOGO } from "@/hooks/connection-providers"
import { wizardQuery } from "@/hooks/connections"
import { useDriveProgress } from "@/hooks/drive"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import type { GoogleServiceView } from "./google.shared"
import { useGoogleAccount } from "./useGoogleAccount"

/**
 * The services of the one Google account, one row each: Drive and Sheets with where each stands and the command it needs, Calendar
 * and Gmail as "coming soon" rows. Drive's command goes to the Settings tab, where the folders are chosen. The Sheets command opens
 * its connection's page when it has one, else the Settings tab when only the ledger access exists, else the Google wizard.
 */
export const useGoogleServices = (): ReadonlyArray<GoogleServiceView> => {
    const t = useTranslations("driveConnection")
    const tc = useTranslations("connections")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const tabs = useConnectionPageTabs(undefined)
    const account = useGoogleAccount()
    const { count: documents } = useDriveProgress()
    const connections = workspaceHref(workspaceId, CONSOLE_ROUTES.connections)
    const sheetsTarget = ((): string => {
        if (account.sheetsRecord !== undefined) return `${connections}/open/${account.sheetsRecord.id}`
        return account.sheets === "none" ? `${connections}?${wizardQuery("google")}` : tabs.hrefOf("settings")
    })()
    const toSettings = (): void => router.push(tabs.hrefOf("settings"))
    const toSheets = (): void => router.push(sheetsTarget)
    const on = { label: t("serviceOn"), tone: "success", isDot: true } as const
    const attention = { label: tc("life_attention"), tone: "danger", isDot: true } as const
    const soon = { label: t("serviceSoon"), tone: "neutral" } as const
    const drive = ((): GoogleServiceView => {
        const base = { id: "drive", title: t("title"), logo: GOOGLE_SERVICE_LOGO.drive } as const
        if (account.drive === "connected") {
            const action = { label: t("serviceFolders"), run: toSettings }
            return { ...base, description: t("serviceDriveOn", { count: documents }), badge: on, action }
        }
        if (account.drive === "lost") {
            const action = { label: tc("actionGrantAgain"), run: toSettings }
            return { ...base, description: t("serviceDriveLost"), badge: attention, action }
        }
        return { ...base, description: t("serviceDriveOff"), action: { label: t("serviceTurnOn"), run: toSettings } }
    })()
    const sheets = ((): GoogleServiceView => {
        const base = { id: "sheets", title: t("serviceSheetsName"), logo: GOOGLE_SERVICE_LOGO.sheets } as const
        const choose = { label: t("serviceSheet"), run: toSheets }
        if (account.sheets === "ready") {
            const sheet = account.sheetTitle === "" ? t("serviceSheetsUntitled") : account.sheetTitle
            return { ...base, description: t("serviceSheetsReady", { sheet }), badge: on, action: choose }
        }
        if (account.sheets === "granted") {
            return { ...base, description: t("serviceSheetsGranted"), badge: on, action: choose }
        }
        if (account.sheets === "lost") {
            const action = { label: tc("actionGrantAgain"), run: toSheets }
            return { ...base, description: t("serviceSheetsLost"), badge: attention, action }
        }
        return { ...base, description: t("serviceSheetsOff"), action: { label: t("serviceTurnOn"), run: toSheets } }
    })()
    return [
        drive,
        sheets,
        {
            id: "calendar",
            title: t("serviceCalendarName"),
            logo: GOOGLE_SERVICE_LOGO.calendar,
            description: t("serviceCalendarSoon"),
            badge: soon,
        },
        {
            id: "gmail",
            title: t("serviceGmailName"),
            logo: GOOGLE_SERVICE_LOGO.gmail,
            description: t("serviceGmailSoon"),
            badge: soon,
        },
    ]
}
