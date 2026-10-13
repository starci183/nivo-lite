import { useFormatter, useLocale, useTranslations } from "next-intl"
import { sameValue } from "@/modules/brain"
import type { FactScope, FlowRuleMode } from "@/modules/types"
import { actionDef, isActionKey, pickCopy } from "@/modules/catalog"
import type { SetupWriteWords } from "@/modules/types"
import { SCOPE_KEY } from "./setupCards.shared"

/** The words and the small formatters of the confirm cards of the setup chat, in the reader language. */
export const useSetupWriteWords = (): SetupWriteWords => {
    const t = useTranslations("moduleSetup")
    const locale = useLocale() === "en" ? "en" : "vi"
    const format = useFormatter()
    return {
        factTitle: t("wFactTitle"),
        ruleTitle: t("wRuleTitle"),
        gap: t("wGap"),
        subject: t("wSubject"),
        attribute: t("wAttribute"),
        value: t("wValue"),
        scope: t("wScope"),
        forLabel: t("wFor"),
        action: t("wAction"),
        mode: t("wMode"),
        limit: t("wLimit"),
        now: t("wNow"),
        nowNone: t("wNowNone"),
        conflictTitle: t("wConflictTitle"),
        situation: t("wSituation"),
        confirm: t("wConfirm"),
        edit: t("wEdit"),
        editDone: t("wEditDone"),
        reject: t("wReject"),
        applied: t("wApplied"),
        appliedRule: t("wAppliedRule"),
        rejected: t("wRejected"),
        kept: t("wKept"),
        replace: t("wReplace"),
        keep: t("wKeep"),
        both: t("wBoth"),
        conflictBody: (current: string) => t("wConflictBody", { current }),
        scopeLabel: (scope: FactScope) => t(SCOPE_KEY[scope]),
        modeLabel: (mode: FlowRuleMode) => t(`mode_${mode}`),
        money: (amount: number | null) =>
            amount === null
                ? t("wLimitNone")
                : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
        actionLabel: (action: string) => (isActionKey(action) ? pickCopy(actionDef(action).label, locale) : action),
        actionRules: (action: string) =>
            isActionKey(action)
                ? { hasLimit: actionDef(action).amountLimit, allowsAuto: actionDef(action).maxMode === null }
                : { hasLimit: false, allowsAuto: false },
        forAll: (typeName: string) => t("wForAll", { type: typeName }),
        forThis: (name: string) => t("wForThis", { name }),
        isSameValue: sameValue,
        ruleShared: (typeName: string) => t("wRuleShared", { type: typeName }),
    }
}
