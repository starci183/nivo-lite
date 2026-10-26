"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import type { ZoneView } from "./knowledge.shared"
import { useDriveGrant } from "./useDriveGrant"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** The reasons the Google callback puts in `?drive=error&reason=`, with the sentence of each. */
const DRIVE_FAILURE_KEYS: Readonly<Record<string, "driveErrDenied" | "driveErrScope" | "driveErrUnavailable">> = {
    denied: "driveErrDenied",
    scope: "driveErrScope",
    unavailable: "driveErrUnavailable",
}

/** What the drop zone is built from. */
interface ZoneContext {
    readonly t: Translate
    readonly drive: ReturnType<typeof useDriveGrant>
    readonly params: ReturnType<typeof useSearchParams>
    /** Opens the drawer on files and links, or on a written note. */
    readonly open: (mode: "files" | "write") => void
    /** The address of the sources tab, with the drawer closed. */
    readonly sourcesHref: (addKey?: string) => string
}

/** The way in that depends on where the Google Drive grant stands: grant it, grant it again, or let it go. */
const driveWaysOf = (context: ZoneContext): ZoneView["ways"] => {
    const { t, drive } = context
    if (drive.state === "hidden") return []
    if (drive.state === "connected") return [{ id: "drive", label: t("driveDisconnect"), onPress: drive.disconnect }]
    const label = t(drive.state === "lost" ? "driveRegrant" : "driveGrant")
    return [{ id: "drive", label, onPress: () => drive.grant(context.sourcesHref()) }]
}

/** What the Drive grant says under the ways in. */
const driveNoteOf = (context: ZoneContext): string | undefined => {
    const { t, drive } = context
    if (drive.state === "connected") return t("driveConnected", { email: drive.email })
    if (drive.state === "lost") return t("driveLostBody")
    return drive.state === "none" ? t("driveAlertBody") : undefined
}

/** The failure of the last Drive action, or the one the Google callback brought back in the address. */
const driveFailureOf = (context: ZoneContext): string | undefined => {
    const { t, drive, params } = context
    if (drive.error !== null) return drive.error
    if (params.get("drive") !== "error") return undefined
    return t(DRIVE_FAILURE_KEYS[params.get("reason") ?? ""] ?? "driveErrGeneric")
}

/** The drop zone: its words, its ways in (a link, a written note, Google Drive) and where the Drive grant stands. */
const zoneViewOf = (context: ZoneContext): ZoneView => ({
    label: context.t("addTitle"),
    prompt: context.t("filesDrop"),
    hint: context.t("filesHint"),
    ways: [
        { id: "link", label: context.t("zoneLink"), onPress: () => context.open("files") },
        { id: "write", label: context.t("zoneWrite"), onPress: () => context.open("write") },
        ...driveWaysOf(context),
    ],
    driveNote: driveNoteOf(context),
    driveFailure: driveFailureOf(context),
})

/** The drop zone of the sources tab: its words, its ways in (a link, a written note, Google Drive) and where the Drive grant stands. */
export const useAddDropZone = (
    open: (mode: "files" | "write") => void,
    sourcesHref: (addKey?: string) => string,
): ZoneView => {
    const t = useTranslations("knowledge")
    const params = useSearchParams()
    const drive = useDriveGrant()
    return zoneViewOf({ t, drive, params, open, sourcesHref })
}
