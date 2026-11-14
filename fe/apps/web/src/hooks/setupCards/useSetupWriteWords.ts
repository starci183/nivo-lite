"use client"

import { useTranslations } from "next-intl"
import { sameValue } from "@/modules/brain"
import type { FactScope, SetupWriteWords } from "@/modules/types"
import { WRITE_SCOPE_KEY, setupWriteDecidedOf } from "./setupCards.shared"

/** The words and the small formatters of the confirm cards of the setup chat, in the reader language. */
export const useSetupWriteWords = (): SetupWriteWords => {
    const t = useTranslations("moduleSetup")
    const words: Omit<SetupWriteWords, "decidedOf"> = {
        factTitle: t("wFactTitle"),
        gap: t("wGap"),
        subject: t("wSubject"),
        attribute: t("wAttribute"),
        value: t("wValue"),
        scope: t("wScope"),
        forLabel: t("wFor"),
        conflictTitle: t("wConflictTitle"),
        situation: t("wSituation"),
        confirm: t("wConfirm"),
        edit: t("wEdit"),
        editDone: t("wEditDone"),
        reject: t("wReject"),
        applied: t("wApplied"),
        rejected: t("wRejected"),
        kept: t("wKept"),
        replace: t("wReplace"),
        keep: t("wKeep"),
        both: t("wBoth"),
        conflictBody: (current: string) => t("wConflictBody", { current }),
        scopeLabel: (scope: FactScope) => t(WRITE_SCOPE_KEY[scope]),
        forAll: (typeName: string) => t("wForAll", { type: typeName }),
        forThis: (name: string) => t("wForThis", { name }),
        isSameValue: sameValue,
    }
    return { ...words, decidedOf: (write) => setupWriteDecidedOf(write, words) }
}
