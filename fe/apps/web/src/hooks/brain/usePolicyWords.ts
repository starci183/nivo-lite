import { useFormatter, useTranslations } from "next-intl"
import { SHOP_TIME_ZONE, type PolicyWords } from "@/modules/brain"

/** The source kinds that have their own word; any other kind reads its label. */
const KIND_KEYS = {
    document: "kindDocument",
    chat: "kindChat",
    learning: "kindLearning",
    owner_edit: "kindOwner",
    manager_edit: "kindManager",
} as const

/** The words (and the day format) the rows and the drawer of the policies tab are made of, resolved once. */
export const usePolicyWords = (): PolicyWords => {
    const p = useTranslations("brainPolicies")
    const format = useFormatter()
    return {
        unset: p("unset"),
        noSource: p("noSource"),
        pending: (n) => p("pending", { n }),
        scheduled: (date, value) => p("scheduled", { date, value }),
        document: (label) => p("srcDocument", { label }),
        chat: (date) => p("srcChat", { date }),
        learning: (count) => p("srcLearning", { count }),
        owner: (date) => p("srcOwner", { date }),
        manager: (date) => p("srcManager", { date }),
        readCustomers: p("readCustomers"),
        readAll: p("readAll"),
        readModules: (names) => p("readModules", { names }),
        historyTitle: (value, version) => p("historyTitle", { value, version }),
        historyScheduled: (value) => p("historyScheduled", { value }),
        sourceKind: (kind, label) => {
            const key = Object.entries(KIND_KEYS).find(([one]) => one === kind)?.[1]
            return key === undefined ? label : p(key)
        },
        dayMonth: (iso) =>
            iso === null || iso === undefined || iso === ""
                ? ""
                : // The shop writes a day as dd/MM; the locale's own short form joins the two with a dash.
                  format
                      .dateTime(new Date(iso), { day: "2-digit", month: "2-digit", timeZone: SHOP_TIME_ZONE })
                      .replace("-", "/"),
        yes: p("yes"),
        no: p("no"),
    }
}
