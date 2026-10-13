import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AccountingEvidence } from "@/components/blocks/AccountingEvidence"
import { AccountingLedger } from "@/components/blocks/AccountingLedger"
import { AccountingOverview } from "@/components/blocks/AccountingOverview"
import { AccountingQuestions } from "@/components/blocks/AccountingQuestions"
import { AgentDashboardFrame } from "@/features/agent-dashboard"
import type { AgentDashboardData } from "@/lib/agent-dashboard-shared"
import type { AccountingWorkbenchData } from "@/modules/types"

/** The words of the tabs and of the failure view. */
interface AccountingWorkbenchLabels {
    readonly overview: string
    readonly evidence: string
    readonly questions: string
    readonly ledger: string
    readonly loadFailedTitle: string
    readonly loadFailedBody: string
}

/** The workbench data, or null when the workbench could not be read, with the words and the frame's common regions. */
interface AccountingWorkbenchBaseProps {
    readonly props: {
        readonly data: AccountingWorkbenchData | null
        /** The frame's common regions (waiting, done, connections, knowledge), loaded on the server. */
        readonly dashboard: AgentDashboardData
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly labels: AccountingWorkbenchLabels
        /** The tab named in `?tab=`, already read on the server. */
        readonly initialTab: string | null
        readonly questionsHref: string
    }
}

/** The Accounting workbench: the agent dashboard frame around the four Accounting surfaces as tabs. */
export const AccountingWorkbenchBase = (props: AccountingWorkbenchBaseProps) => {
    const { data, labels } = props.props
    if (data === null) {
        return (
            <AgentDashboardFrame
                module="accounting"
                data={props.props.dashboard}
                figures={[]}
                figuresFailed
                tabs={[
                    {
                        id: "overview",
                        label: labels.overview,
                        content: (
                            <SurfaceCard ariaLabel={labels.loadFailedTitle}>
                                <EmptyNotice message={labels.loadFailedTitle} description={labels.loadFailedBody} />
                            </SurfaceCard>
                        ),
                    },
                ]}
            />
        )
    }
    const questionCount = data.questions.length
    return (
        <AgentDashboardFrame
            key={props.props.initialTab ?? "overview"}
            module="accounting"
            data={props.props.dashboard}
            figures={props.props.figures}
            initialTab={props.props.initialTab}
            tabs={[
                {
                    id: "overview",
                    label: labels.overview,
                    content: (
                        <AccountingOverview
                            periods={data.periods}
                            waiting={data.waiting}
                            excludedTest={data.excludedTest}
                            questionsHref={props.props.questionsHref}
                        />
                    ),
                },
                {
                    id: "evidence",
                    label: labels.evidence,
                    content: (
                        <AccountingEvidence
                            credits={data.credits}
                            invoices={data.invoices}
                            orders={data.ordersWithoutInvoice}
                        />
                    ),
                },
                {
                    id: "questions",
                    label: questionCount > 0 ? `${labels.questions} (${questionCount})` : labels.questions,
                    content: (
                        <AccountingQuestions questions={data.questions} staff={data.staff} ownerName={data.ownerName} />
                    ),
                },
                {
                    id: "ledger",
                    label: labels.ledger,
                    content: (
                        <AccountingLedger
                            entries={data.ledger}
                            canAdjust={data.canAdjust}
                            adjustmentsReady={data.adjustmentsReady}
                        />
                    ),
                },
            ]}
        />
    )
}
