"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useAccountPageAddress, useGoogleLedger } from "@/hooks/googleLedger"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { DriveLedgerBase } from "./component"

/** The chip of each state of the ledger. */
const CHIP_TONES = { none: "neutral", granted: "warning", ready: "success", lost: "danger" } as const

/** What the last ledger step ended as: the sheet was saved, the access was just given, or nothing to say. */
const ledgerNoteOf = (
    saved: boolean,
    accessGiven: boolean,
    t: (key: "ledgerSaved" | "ledgerAccessOk") => string,
): string | null => {
    if (saved) return t("ledgerSaved")
    return accessGiven ? t("ledgerAccessOk") : null
}

/** The ledger kept in a Google spreadsheet, read from the workspace Google state: a region of the Google account's configuration tab. */
export const DriveLedger = () => {
    const t = useTranslations("googleWizard")
    const labels = useSlotLabels()
    const params = useSearchParams()
    const returnTo = useAccountPageAddress()
    const ledger = useGoogleLedger()
    const format = useFormatter()
    const lastRow =
        ledger.lastRowAt === ""
            ? ""
            : t("ledgerLastRow", {
                  time: format.dateTime(new Date(ledger.lastRowAt), { dateStyle: "short", timeStyle: "short" }),
              })
    const note = ledgerNoteOf(ledger.saved, params.get("sheets") === "ok", t)
    const status = {
        none: t("ledgerNone"),
        granted: t("ledgerGranted", { email: ledger.email }),
        ready: t("ledgerReady", { email: ledger.email }),
        lost: t("ledgerLost"),
    }
    return (
        <DriveLedgerBase
            props={{
                slot: mapSlot(slotOfSwr(ledger.read), () => ({
                    state: ledger.state,
                    status: status[ledger.state],
                    chip: { label: t(`ledgerChip_${ledger.state}`), tone: CHIP_TONES[ledger.state] },
                    sheet: ledger.sheet,
                    sheetUrl: ledger.sheetUrl,
                    sheetName: ledger.sheetTitle === "" ? ledger.sheetUrl : ledger.sheetTitle,
                    sheetLine: lastRow,
                    note,
                    error: ledger.error,
                    isPending: ledger.isPending,
                })),
                labels: labels(t("ledgerTitle")),
                copy: {
                    title: t("ledgerTitle"),
                    body: t("ledgerBody"),
                    allow: t("ledgerAllow"),
                    allowAgain: t("ledgerAllowAgain"),
                    lostTitle: t("ledgerLostTitle"),
                    lostBody: t("ledgerLostBody"),
                    sheetLabel: t("ledgerSheetLabel"),
                    sheetHint: t("ledgerSheetHint"),
                    save: t("ledgerSave"),
                    open: t("ledgerOpen"),
                    change: t("ledgerChange"),
                },
            }}
            on={{
                allow: () => ledger.allow("sheets", returnTo),
                sheet: ledger.setSheet,
                save: () => ledger.save(t("failGeneric")),
                retry: () => void ledger.read.mutate(),
            }}
        />
    )
}
