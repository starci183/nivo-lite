"use client"

import { useFormatter, useTranslations } from "next-intl"
import { FACT_SOURCE_KEY, TRUST_LEVEL_KEY, TYPE_KEY } from "@/modules/brain"
import type { FactDrawerWords, FactPickWords } from "@/modules/brain"

/** The resolved words of the tables of facts and of their two drawers. */
export interface FactWords {
    readonly pick: FactPickWords
    readonly drawer: FactDrawerWords
}

/** The words the inbox and the facts page build their rows, groups and drawers from. */
export const useFactWords = (): FactWords => {
    const t = useTranslations("brainInbox")
    const brain = useTranslations("brain")
    const format = useFormatter()
    const day = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short" })
    const pick: FactPickWords = {
        trustLabel: (level) => brain(TRUST_LEVEL_KEY[level].label),
        conflictBadge: t("conflictBadge"),
        retiredBadge: t("retiredBadge"),
        valuesOf: (values) => values.join(` ${t("orWord")} `),
        conflictSource: (count) => t("conflictSource", { count }),
        mergedOf: (count) => t("merged", { count }),
        noDocument: t("noDocument"),
        typeOf: (type) => brain(TYPE_KEY[type]),
        groupLine: (rows, high, medium, low) => t("groupLine", { rows, high, medium, low }),
        waitingBadge: (count) => t("waitingBadge", { count }),
        conflictsBadge: (count) => t("conflictsBadge", { count }),
        collapseLabel: t("collapse"),
        expandLabel: (count) => t("expand", { count }),
    }
    const drawer: FactDrawerWords = {
        pick,
        close: t("close"),
        typeOf: pick.typeOf,
        sourceOf: (source) => brain(FACT_SOURCE_KEY[source]),
        audienceOf: (audience) => (audience === "customer" ? t("audienceCustomer") : t("audienceInternal")),
        day,
        conflictLine: (documents, values) => t("conflictLine", { documents, values }),
        todayTitle: t("todayTitle"),
        todayLabel: t("todayLabel"),
        todayInUse: t("todayInUse"),
        todayNone: t("todayNone"),
        todayNoteInUse: (source) => t("todayNoteInUse", { source }),
        todayNoteNone: t("todayNoteNone"),
        chooseTitle: (count) => t("chooseTitle", { count }),
        keepOption: t("keepOption"),
        retireOption: t("retireOption"),
        documentsBadge: (count) => t("documentsBadge", { count }),
        conditionFrom: (date) => t("conditionFrom", { date }),
        conditionUntil: (date) => t("conditionUntil", { date }),
        readersTitle: t("readersTitle"),
        readersEmpty: t("readersEmpty"),
        footerNote: t("footerNote"),
        later: t("later"),
        chooseNone: t("chooseNone"),
        useValue: (value) => t("useValue", { value }),
        keepValue: (value) => t("keepValue", { value }),
        stopUsing: t("stopUsing"),
        valueLabel: t("valueLabel"),
        quoteTitle: t("quoteTitle"),
        statusWaiting: t("statusWaiting"),
        statusActive: t("statusActive"),
        statusScheduled: t("statusScheduled"),
        termType: t("termType"),
        termReaders: t("termReaders"),
        termSource: t("termSource"),
        termAddedByLabel: t("termAddedBy"),
        termAddedBy: (who, date) => t("addedBy", { who, date }),
        historyTitle: t("historyTitle"),
        historyState: (status) => t("historyState", { status }),
        approve: t("approve"),
        reject: t("reject"),
        edit: t("edit"),
        menuLabel: t("menuLabel"),
        showHistory: t("showHistory"),
        retire: t("retire"),
    }
    return { pick, drawer }
}
