import { IconTile } from "@starci/grammar/common"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"
import type { AutomationIconWord } from "@/modules/types"

/** Template icon word -> the app glyph names. */
const ICONS: Record<AutomationIconWord, IconName> = {
    payment: "wallet",
    leads: "account",
    report: "overview",
    review: "review",
    debt: "credit",
    winback: "retry",
    moon: "dark",
    sheet: "blog",
    calendar: "streak",
    cart: "cart",
    contract: "saved",
    truck: "servers",
    receipt: "wallet",
    ledger: "saved",
}

/** The icon word of the automation's template. */
interface AutomationMarkProps {
    readonly icon: AutomationIconWord
}

/** The mark of an automation: its template's glyph on a neutral tile. */
export const AutomationMark = (props: AutomationMarkProps) => (
    <IconTile source={nivoIconSource(ICONS[props.icon] ?? "apps", "leading")} tone="neutral" />
)
