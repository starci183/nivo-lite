"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useDriveGrant } from "@/hooks/knowledge"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { KnowledgeDriveGrantBase } from "./component"
import type { DriveNoticeView } from "./component"

/** The reasons the Google callback puts in `?drive=error&reason=`, with the sentence of each. */
const FAILURE_KEYS: Readonly<Record<string, "driveErrDenied" | "driveErrScope" | "driveErrUnavailable">> = {
    denied: "driveErrDenied",
    scope: "driveErrScope",
    unavailable: "driveErrUnavailable",
}

/** The Google Drive read grant of the workspace on the documents page: grant it, grant it again once revoked, or disconnect it. */
export const KnowledgeDriveGrant = () => {
    const t = useTranslations("knowledge")
    const params = useSearchParams()
    const drive = useDriveGrant()
    const returned =
        params.get("drive") === "error" ? (FAILURE_KEYS[params.get("reason") ?? ""] ?? "driveErrGeneric") : null
    const notices: Readonly<Record<typeof drive.state, DriveNoticeView | null>> = {
        hidden: null,
        none: {
            tone: "informative",
            title: t("driveAlertTitle"),
            description: t("driveAlertBody"),
            actionLabel: t("driveGrant"),
            action: "grant",
        },
        lost: {
            tone: "cautionary",
            title: t("driveAlertTitle"),
            description: t("driveLostBody"),
            actionLabel: t("driveRegrant"),
            action: "grant",
        },
        connected: {
            tone: "affirmative",
            title: t("driveConnected", { email: drive.email }),
            actionLabel: t("driveDisconnect"),
            action: "disconnect",
        },
    }
    return (
        <KnowledgeDriveGrantBase
            props={{
                notice: drive.isPending ? null : notices[drive.state],
                failure: drive.error ?? (returned === null ? null : t(returned)),
            }}
            on={{ grant: () => drive.grant(KNOWLEDGE_ROUTES.library), disconnect: drive.disconnect }}
        />
    )
}
