"use client"

import { type SlotRead, slotOfReads, useSlotLabels } from "@/hooks/slot"


import { useTranslations } from "next-intl"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { useSearchParams } from "next/navigation"
import { providerKey } from "@/hooks/connection-providers"
import { driveFailureKeyOf, DRIVE_WIZARD_PATH, useDriveChooserView, useDrivePage } from "@/hooks/drive"
import { useDriveGrant } from "@/hooks/knowledge"
import { DriveWizardBase } from "./component"
import { workspaceHref } from "@/modules/routes"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The step the wizard is on: done once something was added, choosing once Google answered, else asking for the read access. */
const wizardIndexOf = (added: number, isGranted: boolean): number => {
    if (added > 0) return 2
    return isGranted ? 1 : 0
}

/** What the board hands the Google Drive wizard. */
interface DriveWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/**
 * Google Drive in the shared wizard frame: what NIVO will be allowed (read only), choose documents, Done; also the landing of
 * `?drive=ok|error&reason=`, which opens it on the step the answer leads to.
 */
export const DriveWizard = (props: DriveWizardProps) => {
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const t = useTranslations("driveWizard")
    const tw = useTranslations("connectionWizard")
    const phases = useWizardPhases("drive")
    const tc = useTranslations("connections")
    const params = useSearchParams()
    const drive = useDriveGrant()
    const { slot, reads, reload } = useDrivePage()
    const chooser = useDriveChooserView()
    const page = "items" in slot ? slot.items : undefined
    const failed = params.get("drive") === "error"
    const isGranted = page?.standing === "connected" || params.get("drive") === "ok"
    const index = wizardIndexOf(chooser.added, isGranted)
    const steps = [t("stepGrant"), t("stepChoose"), t("stepDone")]
    return (
        <DriveWizardBase
            props={{
                boot: slotOfReads([...props.dependencyReads, ...reads], () => true),
                slotLabels: slotLabels(""),
                title: tw("title", { provider: tc(providerKey("google_drive", "title")) }),
                stepLabel: tw("stepOf", { n: index + 1, total: steps.length }),
                phases,
                steps,
                index,
                refusal: failed ? t(driveFailureKeyOf(params.get("reason") ?? "")) : null,
                error: drive.error,
                isPending: drive.isPending,
                chooser: chooser.props,
                text: {
                    allowTitle: t("allowTitle"),
                    allowRead: t("allowRead"),
                    allowFiles: t("allowFiles"),
                    allowRevoke: t("allowRevoke"),
                    connected: page?.email ? t("connected", { email: page.email }) : t("connectedNoEmail"),
                    grant: failed || page?.standing === "lost" ? t("regrant") : t("grant"),
                    close: tw("close"),
                    later: t("later"),
                    done: tw("done"),
                    doneBody: t("doneBody", { count: chooser.added }),
                    doneHint: t("doneHint"),
                    failTitle: t("failTitle"),
                },
            }}
            on={{
                retryRead: reload,
                ...chooser.on,
                grant: () => drive.grant(workspaceHref(workspaceId, DRIVE_WIZARD_PATH)),
                close: props.onClose,
            }}
        />
    )
}
