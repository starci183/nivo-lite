import type { Bilingual } from "@nivo-lite/agent-sdk/module"
import { messageOf } from "../../messages/catalog"
import { DEFAULT_THRESHOLD_VND } from "../../rules/sales/settings"
import { guidanceOf, vndOf } from "../agent-policy"
import { LEDGER_GUIDANCE } from "./ledger/declaration"

/**
 * The craft of the Sales agent: the words it works under, in the owner's two languages, put in front of every model call of its steps
 * (the plugin's `guidance` function adds the base mindset after them): the sales rules with the default approval threshold named in
 * them, the books' rules (the ledger), then the rules every agent shares.
 */
export const SALES_GUIDANCE: Bilingual = guidanceOf({
    vi: `${messageOf("vi", "policySalesGuidance").replace("{threshold}", vndOf(DEFAULT_THRESHOLD_VND, "vi"))} ${LEDGER_GUIDANCE.vi}`,
    en: `${messageOf("en", "policySalesGuidance").replace("{threshold}", vndOf(DEFAULT_THRESHOLD_VND, "en"))} ${LEDGER_GUIDANCE.en}`,
})
