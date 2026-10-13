import type { DescriptionListStatItem } from "@starci/grammar/common"
import type { AccountingMeasure, AccountingWorkbenchData } from "@/modules/types"
import { moneyOf } from "@/modules/utils"
import type { AccountingFormat, AccountingTranslator } from "@/modules/utils"

/** Presents the backend-calculated monthly figures in the reader's locale. */
export const accountingFiguresOf = (
    data: AccountingWorkbenchData,
    format: AccountingFormat,
    t: AccountingTranslator,
): ReadonlyArray<DescriptionListStatItem> => {
    const moneyItem = (
        id: string,
        term: string,
        measure: AccountingMeasure,
        unit: "countInvoices" | "countPayments",
    ) => ({
        id,
        term,
        description: moneyOf(format, measure.vnd.live),
        meta: [
            t(unit, { n: measure.count.live }),
            measure.count.simulated > 0 ? `${t("originSimulated")}: ${moneyOf(format, measure.vnd.simulated)}` : "",
        ]
            .filter(Boolean)
            .join(" · "),
    })
    const slots = [data.ageing.d0, data.ageing.d30, data.ageing.d60]
    const simulatedOpen = slots.reduce((sum, slot) => sum + slot.vnd.simulated, 0)
    return [
        moneyItem("income", t("mIncome"), data.periods.this.income, "countInvoices"),
        moneyItem("receivable", t("mReceivable"), data.periods.this.receivable, "countInvoices"),
        moneyItem("unmatched", t("mUnmatched"), data.periods.this.unmatched, "countPayments"),
        {
            id: "ageing",
            term: t("mAgeing"),
            description: slots.map((slot) => slot.count.live).join(" / "),
            meta: [
                slots.map((slot) => moneyOf(format, slot.vnd.live)).join(" · "),
                simulatedOpen > 0 ? `${t("originSimulated")}: ${moneyOf(format, simulatedOpen)}` : "",
            ]
                .filter(Boolean)
                .join(" · "),
        },
    ]
}
