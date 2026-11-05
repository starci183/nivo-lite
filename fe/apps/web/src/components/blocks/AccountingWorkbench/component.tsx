import type { ReactElement } from "react"
import type { AccountingWorkbenchDataView, AccountingWorkbenchActions } from "@/modules/types"
import { AccountingRecordSection } from "@/components/frames/AccountingRecordSection"
import { AccountingBlock } from "@/components/frames/AccountingBlock"
import { AccountingRecordList } from "@/components/leaves/AccountingRecordList"
import { AccountingAdjustment } from "@/components/branches/AccountingAdjustment"
import { AccountingEvidence, AccountingEvidenceForm } from "@/components/composites/AccountingEvidence"
import { AccountingLedger, AccountingLedgerLineage } from "@/components/composites/AccountingLedger"
import { Button, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AccountingOverview } from "@/components/composites/AccountingOverview"
import { AccountingQuestions } from "@/components/composites/AccountingQuestions"
import { AccountingUpcomingRows } from "@/components/composites/AccountingUpcomingRows"
import { AccountingWaitingRows } from "@/components/composites/AccountingWaitingRows"
import { WorkbenchOverview } from "@/components/frames/WorkbenchOverview"

/** The four Accounting areas, each a tab of the one workbench. */
type AccountingWorkbenchShape = "overview" | "evidence" | "questions" | "ledger"

/** Resolved read models and atomic commands; no render tree crosses the block boundary. */
export interface AccountingWorkbenchBaseProps {
    readonly shape: AccountingWorkbenchShape
    readonly props: AccountingWorkbenchDataView
    readonly on: AccountingWorkbenchActions
}

/** What a panel reads: the view and the commands of the desk. */
type PanelProps = Pick<AccountingWorkbenchBaseProps, "props" | "on">

const EvidencePanel = (props: PanelProps) => (
    <SlotView
        {...props.props.evidence}
        onRetry={props.on.retry}
        render={(evidence, isLoading) => (
            <AccountingEvidence
                props={evidence}
                isLoading={isLoading}
                credits={
                    <AccountingRecordSection
                        title={evidence.creditsTitle}
                        intro={evidence.creditsIntro}
                        records={<AccountingRecordList {...evidence.lists.credits} isLoading={isLoading} />}
                        action={
                            evidence.isFormOpen ? undefined : (
                                <Button intent="neutral" isLoading={isLoading} onPress={props.on.evidence.openForm}>
                                    {evidence.formOpenLabel}
                                </Button>
                            )
                        }
                    >
                        {evidence.isFormOpen ? (
                            <AccountingEvidenceForm form={evidence.form} on={props.on.evidence} />
                        ) : null}
                    </AccountingRecordSection>
                }
                invoices={
                    <AccountingRecordSection
                        title={evidence.invoicesTitle}
                        intro={evidence.invoicesIntro}
                        records={<AccountingRecordList {...evidence.lists.invoices} isLoading={isLoading} />}
                        note={
                            <Text size="xs" tone="muted" isLoading={isLoading}>
                                {evidence.internalNote}
                            </Text>
                        }
                    />
                }
                orders={
                    <AccountingRecordSection
                        title={evidence.ordersTitle}
                        intro={evidence.ordersIntro}
                        records={<AccountingRecordList {...evidence.lists.orders} isLoading={isLoading} />}
                    />
                }
            />
        )}
    />
)

const ModulePanel = (props: AccountingWorkbenchBaseProps) => {
    const view = props.props
    switch (props.shape) {
        case "overview":
            return (
                <>
                    <SlotView
                        {...view.upcoming}
                        onRetry={props.on.retry}
                        render={(upcoming, isLoading) => (
                            <AccountingUpcomingRows
                                view={upcoming}
                                isLoading={isLoading}
                                onOpenBrain={props.on.upcoming.openBrain}
                            />
                        )}
                    />
                    <SlotView
                        {...view.overview}
                        onRetry={props.on.retry}
                        render={(overview, isLoading) => (
                            <AccountingOverview props={overview} on={props.on.overview} isLoading={isLoading} />
                        )}
                    />
                </>
            )
        case "evidence":
            return <EvidencePanel props={props.props} on={props.on} />
        case "questions":
            return (
                <SlotView
                    {...view.questions}
                    onRetry={props.on.retry}
                    render={(questions, isLoading) => (
                        <AccountingQuestions props={questions} on={props.on.questions} isSkeleton={isLoading} />
                    )}
                />
            )
        case "ledger":
            return (
                <SlotView
                    {...view.ledger}
                    onRetry={props.on.retry}
                    render={(ledger, isLoading) => (
                        <AccountingLedger
                            props={ledger}
                            on={props.on.ledger}
                            isLoading={isLoading}
                            lineage={
                                <AccountingBlock
                                    label={ledger.drawer.lineageTitle}
                                    description={ledger.drawer.lineageIntro}
                                >
                                    <AccountingLedgerLineage
                                        title={ledger.drawer.lineageTitle}
                                        lineage={ledger.drawer.lineage}
                                    />
                                </AccountingBlock>
                            }
                            adjustment={
                                <AccountingBlock label={ledger.drawer.adjustTitle}>
                                    <AccountingAdjustment props={ledger.drawer} on={props.on.ledger} />
                                </AccountingBlock>
                            }
                        />
                    )}
                />
            )
    }
}

/** The Accounting workbench: the tabs and the chosen area beside the waiting questions, or beside the explanation of one. */
export const AccountingWorkbenchBase = (props: AccountingWorkbenchBaseProps): ReactElement => {
    const view = props.props
    return (
        <WorkbenchOverview
            view={view}
            ribbon={view.ribbon}
            on={{ ...props.on, retryRibbon: props.on.retry }}
            aside={{ view: view.aside, on: props.on.aside }}
            waiting={
                <SlotView
                    {...view.waiting}
                    emptyDescription={view.waiting.placeholder.emptyBody}
                    onRetry={props.on.retry}
                    render={(waiting, isLoading) => (
                        <AccountingWaitingRows
                            view={waiting}
                            isLoading={isLoading}
                            onApprove={props.on.waiting.approve}
                            onReject={props.on.waiting.reject}
                            onChangeBasis={props.on.waiting.changeBasis}
                        />
                    )}
                />
            }
        >
            <ModulePanel {...props} />
        </WorkbenchOverview>
    )
}
