import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { HiringAvailability } from "@/components/blocks/HiringAvailability"
import { HiringCandidate } from "@/components/blocks/HiringCandidate"
import { HiringFigures } from "@/components/blocks/HiringFigures"
import { HiringInterviews } from "@/components/blocks/HiringInterviews"
import { HiringJobs } from "@/components/blocks/HiringJobs"
import { HiringOffers } from "@/components/blocks/HiringOffers"
import { HiringOnboarding } from "@/components/blocks/HiringOnboarding"
import { HiringPipeline } from "@/components/blocks/HiringPipeline"
import { HiringSettings } from "@/components/blocks/HiringSettings"

/** The words of the page: the tab names (the figures block words its own figures). */
interface HiringWorkbenchLabels {
    readonly jobs: string
    readonly candidates: string
    readonly interviewsTab: string
    readonly offersTab: string
    readonly onboarding: string
    readonly settings: string
}

/** Props for {@link HiringWorkbenchPageBase}. */
export interface HiringWorkbenchPageBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly tab: string | null
        readonly focus: string | null
        readonly labels: HiringWorkbenchLabels
    }
}

/**
 * Draws the Hiring workbench: the agent dashboard frame around the six Hiring surfaces. Every surface is a self-connected block that
 * reads the board itself; the connected figures block fills the frame ribbon.
 */
export const HiringWorkbenchPageBase = (props: HiringWorkbenchPageBaseProps) => {
    const { installationId, tab, focus, labels } = props.props
    return (
        <AgentDashboardFrame
            module="hiring"
            installationId={installationId}
            initialTab={tab}
            ribbon={<HiringFigures />}
            tabs={[
                {
                    id: "jobs",
                    label: labels.jobs,
                    content: <HiringJobs />,
                },
                { id: "candidates", label: labels.candidates, content: <HiringPipeline /> },
                { id: "interviews", label: labels.interviewsTab, content: <HiringInterviews /> },
                { id: "offers", label: labels.offersTab, content: <HiringOffers /> },
                { id: "onboarding", label: labels.onboarding, content: <HiringOnboarding /> },
                {
                    id: "settings",
                    label: labels.settings,
                    content: (
                        <>
                            <HiringSettings />
                            <HiringAvailability />
                        </>
                    ),
                },
            ]}
        >
            <HiringCandidate focus={focus} />
        </AgentDashboardFrame>
    )
}
