"use client"

import { type SlotRead, slotOfReads, useSlotLabels } from "@/hooks/slot"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { providerKey } from "@/hooks/connection-providers"
import { useGoogleLedger } from "@/hooks/googleLedger"
import { GoogleWizardBase } from "./component"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The reasons the callback puts in the return address. */
const GOOGLE_FAILURES = ["denied", "unavailable", "state", "no_refresh", "scope"] as const

/** One reason the callback puts in the return address. */
type GoogleFailure = (typeof GOOGLE_FAILURES)[number]

/** The sentence key of each known Google failure. */
const FAILURE_KEYS = {
    denied: "failDenied",
    unavailable: "failUnavailable",
    state: "failState",
    no_refresh: "failNoRefresh",
    scope: "failScope",
} as const satisfies Record<GoogleFailure, string>

/** The sentence key of a Google failure, including the generic one. */
type GoogleFailureMessage = (typeof FAILURE_KEYS)[GoogleFailure] | "failGeneric"

const GOOGLE_FAILURE_SET: ReadonlySet<string> = new Set(GOOGLE_FAILURES)

/** Whether the return address names one of the known Google failures. */
const isGoogleFailure = (value: string): value is GoogleFailure => GOOGLE_FAILURE_SET.has(value)

/** The sentence key for a Google failure, or the generic one when the reason is unknown. */
const googleFailureMessage = (reason: string): GoogleFailureMessage =>
    isGoogleFailure(reason) ? FAILURE_KEYS[reason] : "failGeneric"

/** What the last ledger step ended as: the sheet was saved, the access was just given, or nothing to say. */
const ledgerNoteOf = (
    saved: boolean,
    accessGiven: boolean,
    t: (key: "ledgerSaved" | "ledgerAccessOk") => string,
): string | null => {
    if (saved) return t("ledgerSaved")
    return accessGiven ? t("ledgerAccessOk") : null
}

/** What the board hands the Google wizard. */
interface GoogleWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Google in the shared wizard frame: what NIVO will be allowed (only files it creates), then Connect Google (OAuth), then Done; also the landing of `?google=ok|error`. */
export const GoogleWizard = (props: GoogleWizardProps) => {
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const t = useTranslations("googleWizard")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const params = useSearchParams()
    const ledger = useGoogleLedger()
    const result = params.get("google")
    const sheets = params.get("sheets")
    const reason = params.get("reason") ?? ""
    const { email } = ledger
    const ledgerStatus = {
        none: t("ledgerNone"),
        granted: t("ledgerGranted", { email }),
        ready: t("ledgerReady", { email }),
        lost: t("ledgerLost"),
    } satisfies Record<typeof ledger.state, string>
    const ledgerNote = ledgerNoteOf(ledger.saved, sheets === "ok", t)
    const failure = result === "error" || sheets === "error" ? t(googleFailureMessage(reason)) : null
    const steps = [t("stepConnect"), t("stepDone")]
    const index = result === "ok" ? 1 : 0
    return (
        <GoogleWizardBase
            props={{
                boot: slotOfReads(props.dependencyReads, () => true),
                slotLabels: slotLabels(""),
                title: tw("title", { provider: tc(providerKey("google", "title")) }),
                stepLabel: tw("stepOf", { n: index + 1, total: steps.length }),
                steps,
                index,
                refusal: failure,
                error: ledger.error,
                isPending: ledger.isPending,
                consentNeeded: ledger.read.data?.consentNeeded === true ? t("consentNeeded") : null,
                ledger: {
                    status: ledgerStatus[ledger.state],
                    mustAllow: ledger.state === "none" || ledger.state === "lost",
                    canName: ledger.state === "granted" || ledger.state === "ready",
                    sheet: ledger.sheet,
                    note: ledgerNote,
                    sheetUrl: ledger.sheetUrl,
                    text: {
                        title: t("ledgerTitle"),
                        body: t("ledgerBody"),
                        allow: t("ledgerAllow"),
                        sheetLabel: t("ledgerSheetLabel"),
                        sheetHint: t("ledgerSheetHint"),
                        save: t("ledgerSave"),
                    },
                },
                text: {
                    allowTitle: t("allowTitle"),
                    allowOnlyFiles: t("allowOnlyFiles"),
                    allowNoOthers: t("allowNoOthers"),
                    allowRevoke: t("allowRevoke"),
                    connect: t("connect"),
                    close: tw("close"),
                    done: tw("done"),
                    failTitle: t("failTitle"),
                    doneTitle: t("doneTitle"),
                    doneBody: t("doneBody", { email: t("doneNoEmail") }),
                },
            }}
            on={{
                connect: () => ledger.allow(undefined, workspaceHref(workspaceId, CONSOLE_ROUTES.connections)),
                allowSheets: () => ledger.allow("sheets", workspaceHref(workspaceId, CONSOLE_ROUTES.connections)),
                sheet: ledger.setSheet,
                saveSheet: () => ledger.save(t("failGeneric")),
                close: props.onClose,
            }}
        />
    )
}
