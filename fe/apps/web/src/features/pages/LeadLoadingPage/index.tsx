import { LeadContext } from "@/components/blocks/LeadContext"
import { LeadExecution } from "@/components/blocks/LeadExecution"
import { LeadHeader } from "@/components/blocks/LeadHeader"
import { LeadHistory } from "@/components/blocks/LeadHistory"
import { LeadOutcome } from "@/components/blocks/LeadOutcome"
import { LeadPreviousSteps } from "@/components/blocks/LeadPreviousSteps"
import { LeadResponsibility } from "@/components/blocks/LeadResponsibility"
import { LeadWorkFlow } from "@/components/blocks/LeadWorkFlow"
import { LeadPageLayout } from "@/components/composites/LeadPageLayout"

/** The lead page with no data yet: the same trail, panels and section titles, every value a skeleton. */
export const LeadLoadingPage = () => (
    <LeadPageLayout
        header={<LeadHeader />}
        primary={
            <>
                <LeadExecution />
                <LeadWorkFlow />
                <LeadHistory />
            </>
        }
        rail={
            <>
                <LeadResponsibility />
                <LeadPreviousSteps />
                <LeadContext />
                <LeadOutcome />
            </>
        }
    />
)
