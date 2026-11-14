"use client"

import { useTranslations } from "next-intl"
import { useParams, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useMutateAuthorizeDriveSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { providerPagePath } from "@/modules/connection-page"
import { workspaceHref } from "@/modules/routes"
import type { ConnectionNotice } from "@/modules/types"
import { DRIVE_WIZARD_PATH, driveFailureKeyOf, type DriveGrantStanding } from "./drive.shared"
import { useDrivePage } from "./useDrivePage"

/** The view `useDriveHead` returns. */
export interface DriveHeadView {
    notices: readonly ConnectionNotice[]
    grant: () => undefined
    isGranting: boolean
    standing: DriveGrantStanding | undefined
}

/**
 * The notices of the Google Drive account page, its standing, and its command: grant (or grant again) through Google, which sends
 * the owner back to this page. Disconnecting is the account row's command in the page band. Nothing is read while `enabled` is false.
 */
export const useDriveHead = (enabled = true): DriveHeadView => {
    const t = useTranslations("driveConnection")
    const tw = useTranslations("driveWizard")
    const settle = useSettledGraphQL()
    const workspaceId = useWorkspaceId()
    const params = useSearchParams()
    const route = useParams<{ id?: string }>()
    const { trigger: authorize, isMutating: isGranting } = useMutateAuthorizeDriveSwr()
    const { slot } = useDrivePage(enabled)
    const [notice, setNotice] = useState("")
    const returnTo = workspaceHref(workspaceId, typeof route.id === "string" ? providerPagePath(route.id) : DRIVE_WIZARD_PATH)

    const grant = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => authorize({ returnTo }))
        if (result.kind !== "ok") return setNotice(result.message)
        window.location.assign(result.value.url)
    }, [settle, authorize, returnTo])

    const standing = ("items" in slot ? slot.items : undefined)?.standing
    const returned = params.get("drive") === "error" ? tw(driveFailureKeyOf(params.get("reason") ?? "")) : ""
    const notices: ReadonlyArray<ConnectionNotice> = [
        ...(standing === "lost"
            ? [{ id: "lost", tone: "negative" as const, title: t("lostTitle"), description: t("lostBody") }]
            : []),
        ...(returned === "" ? [] : [{ id: "returned", tone: "negative" as const, title: returned }]),
        ...(notice === "" ? [] : [{ id: "command", tone: "negative" as const, title: notice }]),
    ]

    return {
        notices,
        grant: () => void grant(),
        isGranting,
        standing,
    }
}
