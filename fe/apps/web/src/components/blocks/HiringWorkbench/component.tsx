import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AgentDashboardFrame } from "@/components/blocks/AgentDashboardFrame"
import { HiringAvailability } from "@/components/blocks/HiringAvailability"
import { HiringCandidate } from "@/components/blocks/HiringCandidate"
import { HiringInterviews } from "@/components/blocks/HiringInterviews"
import { HiringJobs } from "@/components/blocks/HiringJobs"
import { HiringOffers } from "@/components/blocks/HiringOffers"
import { HiringOnboarding } from "@/components/blocks/HiringOnboarding"
import { HiringPipeline } from "@/components/blocks/HiringPipeline"
import { HiringSettings } from "@/components/blocks/HiringSettings"
import type { CandidateView, HiringWorkbenchData } from "@/hooks/hiringWire"
import { PAGE_CLASS_NAME } from "./classNames"

/** One tab of the workbench: its id and its name with the count beside it. */
export interface HiringTabView {
    readonly id: string
    readonly label: string
}

/** What the connected block settled: the state of the read, the ribbon, the tabs, the data and what is open. */
export interface HiringWorkbenchBaseProps {
    readonly props: {
        readonly installationId: string | null
        readonly state: "loading" | "forbidden" | "failed" | "ready"
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: ReadonlyArray<HiringTabView>
        readonly tab: string
        readonly data: HiringWorkbenchData | undefined
        readonly jobId: string
        readonly opened: CandidateView | undefined
        readonly failedTitle: string
        readonly failedBody: string
        readonly forbiddenTitle: string
        readonly forbiddenBody: string
    }
    readonly on: {
        readonly tab: (id: string) => void
        readonly openPipeline: (jobId: string) => void
        readonly job: (jobId: string) => void
        readonly open: (candidateId: string) => void
        readonly openAndShow: (candidateId: string) => void
        readonly close: () => void
    }
}

/** Draws the Hiring workbench: the agent dashboard frame around the six Hiring surfaces and the candidate drawer. */
export const HiringWorkbenchBase = (props: HiringWorkbenchBaseProps) => {
    const { installationId, state, figures, tabs, tab, data, jobId, opened } = props.props
    const { on } = props
    if (state === "forbidden") {
        return (
            <div className={PAGE_CLASS_NAME}>
                <SurfaceCard ariaLabel={props.props.forbiddenTitle}>
                    <EmptyNotice message={props.props.forbiddenTitle} description={props.props.forbiddenBody} />
                </SurfaceCard>
            </div>
        )
    }
    const contentOf = (id: string) => {
        if (data === undefined) return undefined
        if (id === "candidates") return <HiringPipeline data={data} jobId={jobId} onJob={on.job} onOpen={on.open} />
        if (id === "interviews") return <HiringInterviews data={data} onOpen={on.openAndShow} />
        if (id === "offers") return <HiringOffers data={data} onOpen={on.openAndShow} />
        if (id === "onboarding") return <HiringOnboarding data={data} />
        if (id === "settings") {
            return (
                <>
                    <HiringSettings data={data} />
                    <HiringAvailability data={data} />
                </>
            )
        }
        return <HiringJobs data={data} onOpenPipeline={on.openPipeline} />
    }
    return (
        <>
            <AgentDashboardFrame
                module="hiring"
                installationId={installationId}
                isLoading={state === "loading"}
                figures={figures}
                figuresFailed={state === "failed"}
                tab={tab}
                onTabChange={on.tab}
                tabs={
                    state === "failed"
                        ? [
                              {
                                  id: "jobs",
                                  label: tabs[0]?.label ?? "",
                                  content: (
                                      <SurfaceCard ariaLabel={props.props.failedTitle}>
                                          <EmptyNotice
                                              message={props.props.failedTitle}
                                              description={props.props.failedBody}
                                          />
                                      </SurfaceCard>
                                  ),
                              },
                          ]
                        : tabs.map((entry) => ({ id: entry.id, label: entry.label, content: contentOf(entry.id) }))
                }
            />
            {opened === undefined || data === undefined ? null : (
                <HiringCandidate key={opened.id} candidate={opened} data={data} onClose={on.close} />
            )}
        </>
    )
}
