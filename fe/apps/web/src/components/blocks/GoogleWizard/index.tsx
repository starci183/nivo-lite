"use client"

import type { SlotRead } from "@/hooks/slot"

import { slotOfReads, useSlotLabels } from "@/hooks/slot"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { providerKey } from "@/hooks/connection-providers"
import { useAuthorizeGoogle } from "@/hooks/connections"
import { useMutateSetLedgerSheetSwr, useQueryGoogleStateSwr } from "@/hooks/swr"
import { GoogleWizardBase } from "./component"

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

/** Where the ledger kept in a Google spreadsheet stands: no access, access without a sheet, working, or the access was withdrawn. */
type LedgerState = "none" | "granted" | "ready" | "lost"

/** The ledger state the back end names; a word it does not know reads as no access. */
const ledgerStateOf = (value: string): LedgerState =>
    value === "granted" || value === "ready" || value === "lost" ? value : "none"

type GoogleTranslate = ReturnType<typeof useTranslations<"googleWizard">>
type WizardTranslate = ReturnType<typeof useTranslations<"connectionWizard">>

/** The note under the ledger: the sheet was just saved, the access was just given, or nothing to say. */
const ledgerNoteKeyOf = (saved: boolean, accessGiven: boolean): "ledgerSaved" | "ledgerAccessOk" | null => {
    if (saved) return "ledgerSaved"
    return accessGiven ? "ledgerAccessOk" : null
}

/** The sentence that says where the ledger stands, naming the Google account when one is connected. */
const ledgerStatusOf = (t: GoogleTranslate, state: LedgerState, email: string): string => {
    const status: Record<LedgerState, string> = {
        none: t("ledgerNone"),
        granted: t("ledgerGranted", { email }),
        ready: t("ledgerReady", { email }),
        lost: t("ledgerLost"),
    }
    return status[state]
}

/** The words of the ledger section. */
const ledgerTextOf = (t: GoogleTranslate) => ({
    title: t("ledgerTitle"),
    body: t("ledgerBody"),
    allow: t("ledgerAllow"),
    sheetLabel: t("ledgerSheetLabel"),
    sheetHint: t("ledgerSheetHint"),
    save: t("ledgerSave"),
})

/** The words of the consent, the buttons and the landing. */
const wizardTextOf = (t: GoogleTranslate, tw: WizardTranslate) => ({
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
})

/** What the board hands the Google wizard. */
interface GoogleWizardProps {
    /** The actual workspace reads shared with this selected wizard. */
    readonly dependencyReads: ReadonlyArray<SlotRead<unknown>>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Google in the shared wizard frame: what NIVO will be allowed (only files it creates), then Connect Google (OAuth), then Done; also the landing of `?google=ok|error`. */
export const GoogleWizard = (props: GoogleWizardProps) => {
    const slotLabels = useSlotLabels()
    const t = useTranslations("googleWizard")
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const params = useSearchParams()
    const authorize = useAuthorizeGoogle()
    const read = useQueryGoogleStateSwr()
    const setSheet = useMutateSetLedgerSheetSwr()
    const result = params.get("google")
    const sheets = params.get("sheets")
    const reason = params.get("reason") ?? ""
    const [error, setError] = useState<string | null>(null)
    const [sheet, setSheetText] = useState("")
    const [saved, setSaved] = useState(false)
    const [isPending, startTransition] = useTransition()
    const ask = (purpose: "sheets" | undefined) =>
        startTransition(async () => {
            setError(null)
            const answer = await authorize("/connections", purpose)
            if (answer.kind !== "ok") return setError(answer.message)
            window.location.assign(answer.value)
        })
    const saveSheet = () =>
        startTransition(async () => {
            setError(null)
            try {
                await setSheet.trigger({ sheet })
                setSaved(true)
                await read.mutate()
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : t("failGeneric"))
            }
        })
    const ledger = read.data?.ledger
    const ledgerState = ledgerStateOf(ledger?.state ?? "none")
    const noteKey = ledgerNoteKeyOf(saved, sheets === "ok")
    const ledgerNote = noteKey === null ? null : t(noteKey)
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
                error,
                isPending,
                consentNeeded: read.data?.consentNeeded === true ? t("consentNeeded") : null,
                ledger: {
                    status: ledgerStatusOf(t, ledgerState, ledger?.email ?? ""),
                    mustAllow: ledgerState === "none" || ledgerState === "lost",
                    canName: ledgerState === "granted" || ledgerState === "ready",
                    sheet: sheet === "" ? (ledger?.sheetUrl ?? "") : sheet,
                    note: ledgerNote,
                    sheetUrl: ledger?.sheetUrl ?? "",
                    text: ledgerTextOf(t),
                },
                text: wizardTextOf(t, tw),
            }}
            on={{
                connect: () => ask(undefined),
                allowSheets: () => ask("sheets"),
                sheet: setSheetText,
                saveSheet,
                close: props.onClose,
            }}
        />
    )
}
