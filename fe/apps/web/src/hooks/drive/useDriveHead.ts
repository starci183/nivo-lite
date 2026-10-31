"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { useConnectionsRole } from "@/hooks/connections"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { mapSlot } from "@/hooks/slot"
import { useMutateAuthorizeDriveSwr, useMutateDisconnectDriveSwr } from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { ConnectionHeadView, ConnectionNotice, ConnectionTone, DataSlot } from "@/modules/types"
import { DRIVE_PAGE_PATH, driveFailureKeyOf } from "./drive.shared"
import type { DriveGrantStanding } from "./drive.shared"
import { useDrivePage } from "./useDrivePage"

const CHIP_KEYS = { none: "chipNone", connected: "chipOk", lost: "chipCheck" } as const
const CHIP_TONES: Readonly<Record<DriveGrantStanding, ConnectionTone>> = {
    none: "neutral",
    connected: "success",
    lost: "danger",
}

/**
 * The header of the Google Drive page, its standing, its notices, and its two commands: grant (or grant again) through Google, and the
 * owner's disconnect, which forgets the stored tokens and leaves the page for the hub. Nothing is read while `enabled` is false.
 */
export const useDriveHead = (enabled = true) => {
    const t = useTranslations("driveConnection")
    const tw = useTranslations("driveWizard")
    const settle = useSettledGraphQL()
    const router = navigation.useRouter()
    const params = useSearchParams()
    const { trigger: forget, isMutating: isDisconnecting } = useMutateDisconnectDriveSwr()
    const { trigger: authorize, isMutating: isGranting } = useMutateAuthorizeDriveSwr()
    const { slot } = useDrivePage(enabled)
    const { role } = useConnectionsRole()
    const [notice, setNotice] = useState("")

    const head: DataSlot<ConnectionHeadView> = mapSlot(slot, (page) => ({
        name: t("title"),
        chipLabel: t(CHIP_KEYS[page.standing]),
        chipTone: CHIP_TONES[page.standing],
        facts: page.email === "" ? t("factsNone") : page.email,
    }))

    const grant = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => authorize({ returnTo: DRIVE_PAGE_PATH }))
        if (result.kind !== "ok") return setNotice(result.message)
        window.location.assign(result.value.url)
    }, [settle, authorize])

    const disconnect = useCallback(async (): Promise<void> => {
        setNotice("")
        const result = await settle(() => forget(), t("toastDisconnected"))
        if (result.kind !== "ok") return setNotice(result.message)
        router.replace(CONSOLE_ROUTES.connections)
    }, [settle, forget, t, router])

    const standing = slot.items?.standing
    const returned = params.get("drive") === "error" ? tw(driveFailureKeyOf(params.get("reason") ?? "")) : ""
    const notices: ReadonlyArray<ConnectionNotice> = [
        ...(standing === "lost"
            ? [{ id: "lost", tone: "negative" as const, title: t("lostTitle"), description: t("lostBody") }]
            : []),
        ...(returned === "" ? [] : [{ id: "returned", tone: "negative" as const, title: returned }]),
        ...(notice === "" ? [] : [{ id: "command", tone: "negative" as const, title: notice }]),
    ]

    return {
        head,
        notices,
        grant: () => void grant(),
        isGranting,
        disconnect,
        isDisconnecting,
        isOwner: role === "owner",
        standing,
    }
}
