"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import type { InboxCopy } from "@/modules/types"

/** What the words of the inbox depend on: the progress they count, and whether the trust filter narrows the fresh facts. */
export interface InboxCopyInput {
    readonly progress: { readonly used: number; readonly total: number }
    readonly isNarrowed: boolean
}

/** The words of the to-do inbox: its cards, its controls, its notices and its rail. */
export const useInboxCopy = (input: InboxCopyInput): InboxCopy => {
    const t = useTranslations("brainInbox")
    const q = useTranslations("brainQueue")
    const slotLabels = useSlotLabels()
    return {
        table: {
            label: t("freshTitle"),
            columns: { item: t("colItem"), value: t("colValue"), badge: t("colTrust"), action: t("colAction") },
            openLabel: t("openFact"),
            compareLabel: t("compare"),
            emptyTitle: input.isNarrowed ? t("factsNoMatchTitle") : t("freshEmptyTitle"),
            emptyBody: input.isNarrowed ? t("factsNoMatchBody") : t("freshEmptyBody"),
        },
        trustFilterLabel: t("trustFilterLabel"),
        trustAll: t("trustAll"),
        trustHighOnly: t("trustHighOnly"),
        groupingLabel: t("groupingLabel"),
        byDocument: t("byDocument"),
        bySubject: t("bySubject"),
        conflictsTitle: t("conflictsTitle"),
        conflictsFact: t("conflictsFact"),
        compare: t("compare"),
        inboxEmptyTitle: t("inboxEmptyTitle"),
        inboxEmptyBody: t("inboxEmptyBody"),
        inboxEmptyAction: t("inboxEmptyAction"),
        errorTitle: q("errorTitle"),
        errorBody: q("errorBody"),
        retry: slotLabels("").retry,
        progressTitle: t("progressTitle"),
        progressLabel: t("progressLabel"),
        progressValue: t("progressValue", input.progress),
        progressNote: t("progressNote"),
        asksTitle: t("asksTitle"),
        asksMore: t("asksMore"),
        proposalsTitle: t("proposalsTitle"),
        read: t("read"),
        dismiss: t("dismiss"),
        rowMenu: t("rowMenu"),
    }
}
