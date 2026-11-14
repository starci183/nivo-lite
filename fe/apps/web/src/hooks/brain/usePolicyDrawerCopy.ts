import { useTranslations } from "next-intl"
import type { PolicyDrawerCopy } from "@/modules/types"

/** The words of the drawer that edits one shop rule. */
export const usePolicyDrawerCopy = (): PolicyDrawerCopy => {
    const p = useTranslations("brainPolicies")
    return {
        closeLabel: p("close"),
        cancelLabel: p("cancel"),
        saveLabel: p("save"),
        valueLabel: p("valueLabel"),
        yes: p("yes"),
        no: p("no"),
        fromTime: p("fromTime"),
        toTime: p("toTime"),
        durationUnit: p("durationUnit"),
        unitOptions: [
            { id: "minutes", label: p("minutes") },
            { id: "hours", label: p("hours") },
            { id: "days", label: p("days") },
        ],
        audienceLabel: p("audienceLabel"),
        customersLabel: p("customersLabel"),
        customersHint: p("customersHint"),
        effectiveLabel: p("effectiveLabel"),
        effectiveOptions: [
            { id: "now", label: p("effectiveNow") },
            { id: "from", label: p("effectiveFrom") },
        ],
        fromDateLabel: p("fromDateLabel"),
        proposalsLabel: p("proposalsLabel"),
        use: p("use"),
        reject: p("reject"),
        historyLabel: p("historyLabel"),
        historyEmpty: p("historyEmpty"),
        failTitle: p("failTitle"),
        loadFailed: p("drawerLoadFailed"),
    }
}
