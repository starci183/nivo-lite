import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AccountingAgentFrame } from "@/components/composites/AccountingAgentFrame"
import { AccountingOverview, type AccountingOverviewView } from "@/components/composites/AccountingOverview"
import { AccountingEvidence, type AccountingEvidenceView } from "@/components/composites/AccountingEvidence"
import { AccountingQuestions } from "@/components/composites/AccountingQuestions"
import type { AccountingQuestionsView } from "@/modules/types"
import { AccountingLedger, type AccountingLedgerView } from "@/components/composites/AccountingLedger"
import type { AccountingDashboardView } from "@/modules/types"
import type { AccountingEvidenceValues } from "@/hooks/rhf"

/** Settled atoms and reader actions for the accounting workbench. */
interface AccountingWorkbenchOverviewBaseProps {
    readonly state: { readonly isLoading: boolean; readonly figuresFailed: boolean; readonly selectedTab: string }
    readonly props: {
        readonly view: AccountingDashboardView
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly loadFailedTitle: string
        readonly loadFailedBody: string
        readonly overview: AccountingOverviewView | null
        readonly evidence: AccountingEvidenceView | null
        readonly ledger: AccountingLedgerView | null
        readonly questions: AccountingQuestionsView["props"]
    }
    readonly on: {
        readonly approveQuestion: (id: string) => void
        readonly rejectQuestion: (id: string) => void
        readonly toggleQuestionEdit: (id: string) => void
        readonly changeQuestionDraft: (id: string, value: string) => void
        readonly changeQuestionAmount: (id: string, value: string) => void
        readonly changeQuestionBasis: (id: string, value: string) => void
        readonly changeQuestionCandidate: (id: string, value: string | null) => void
        readonly changeQuestionField: (id: string, name: string, value: string) => void
        readonly retry: () => void
        readonly selectTab: (id: string) => void
        readonly selectPeriod: (key: string) => void
        readonly openEvidence: () => void
        readonly closeEvidence: () => void
        readonly changeEvidenceField: (name: keyof AccountingEvidenceValues, value: string) => void
        readonly submitEvidence: () => void
        readonly selectLedgerFilter: (key: string) => void
        readonly openLedgerEntry: (id: string) => void
        readonly closeLedgerDrawer: () => void
        readonly startAdjust: () => void
        readonly cancelAdjust: () => void
        readonly changeAdjustNote: (value: string) => void
        readonly changeAdjustAmount: (value: string) => void
        readonly submitAdjust: () => void
    }
}

/** Composes the accounting surfaces from settled atoms and reader actions. */
export const AccountingWorkbenchOverviewBase = (props: AccountingWorkbenchOverviewBaseProps) => {
    const firstTab = props.props.tabs[0]
    const tabs = props.state.figuresFailed && firstTab ? [firstTab] : props.props.tabs
    const frameProps = { view: props.props.view, figures: props.props.figures, tabs }
    const frameOn = { retry: props.on.retry, selectTab: props.on.selectTab }
    if (props.state.figuresFailed)
        return (
            <AccountingAgentFrame state={props.state} props={frameProps} on={frameOn}>
                <SurfaceCard ariaLabel={props.props.loadFailedTitle}>
                    <EmptyNotice message={props.props.loadFailedTitle} description={props.props.loadFailedBody} />
                </SurfaceCard>
            </AccountingAgentFrame>
        )
    return (
        <AccountingAgentFrame state={props.state} props={frameProps} on={frameOn}>
            {props.props.overview ? (
                <AccountingOverview props={props.props.overview} on={{ selectPeriod: props.on.selectPeriod }} />
            ) : null}
            {props.props.evidence ? (
                <AccountingEvidence
                    props={props.props.evidence}
                    on={{
                        openForm: props.on.openEvidence,
                        closeForm: props.on.closeEvidence,
                        changeField: props.on.changeEvidenceField,
                        submitForm: props.on.submitEvidence,
                    }}
                />
            ) : null}
            <AccountingQuestions
                props={props.props.questions}
                on={{
                    approve: props.on.approveQuestion,
                    reject: props.on.rejectQuestion,
                    toggleEdit: props.on.toggleQuestionEdit,
                    changeDraft: props.on.changeQuestionDraft,
                    changeAmount: props.on.changeQuestionAmount,
                    changeBasis: props.on.changeQuestionBasis,
                    changeCandidate: props.on.changeQuestionCandidate,
                    changeField: props.on.changeQuestionField,
                }}
            />
            {props.props.ledger ? (
                <AccountingLedger
                    props={props.props.ledger}
                    on={{
                        selectFilter: props.on.selectLedgerFilter,
                        openEntry: props.on.openLedgerEntry,
                        closeDrawer: props.on.closeLedgerDrawer,
                        startAdjust: props.on.startAdjust,
                        cancelAdjust: props.on.cancelAdjust,
                        changeNote: props.on.changeAdjustNote,
                        changeAmount: props.on.changeAdjustAmount,
                        submitAdjust: props.on.submitAdjust,
                    }}
                />
            ) : null}
        </AccountingAgentFrame>
    )
}
