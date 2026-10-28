import { Page } from "@starci/grammar/common"
import { MarketingReport } from "@/components/blocks/MarketingReport"

/** Draws the Performance tab of the AI Marketing agent: the weekly report, read and posted in the browser, in one Page. */
export const MarketingPerformancePageBase = () => (
    <Page measure="product">
        <MarketingReport />
    </Page>
)
