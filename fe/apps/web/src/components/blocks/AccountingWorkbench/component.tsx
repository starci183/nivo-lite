import type { ReactElement } from "react"
import { type AccountingWorkbenchDataView, type AccountingWorkbenchActions, ACCOUNTING_TABS } from "@/modules/types"
import { AccountingRecordSection } from "@/components/frames/AccountingRecordSection"
import { AccountingBlock } from "@/components/frames/AccountingBlock"
import { AccountingRecordList } from "@/components/leaves/AccountingRecordList"
import { AccountingAdjustment } from "@/components/branches/AccountingAdjustment"
import { AccountingEvidence, AccountingEvidenceForm } from "@/components/composites/AccountingEvidence"
import { AccountingLedger, AccountingLedgerLineage } from "@/components/composites/AccountingLedger"
import { Button, Grid, Stack, Tabs, Text } from "@starci/grammar/common"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AccountingOverview } from "@/components/composites/AccountingOverview"
import { AccountingQuestions } from "@/components/composites/AccountingQuestions"
import { AccountingUpcomingRows } from "@/components/composites/AccountingUpcomingRows"
import { AccountingWaitingRows } from "@/components/composites/AccountingWaitingRows"

/** The real Accounting areas and the explanation arrangement. */
export const ACCOUNTING_WORKBENCH_SHAPES: readonly [...typeof ACCOUNTING_TABS, "explanation"] = [
    ...ACCOUNTING_TABS,
    "explanation",
]
type AccountingWorkbenchShape = (typeof ACCOUNTING_WORKBENCH_SHAPES)[number]

/** Resolved read models and atomic commands; no render tree crosses the block boundary. */
export interface AccountingWorkbenchBaseProps {
    readonly shape: AccountingWorkbenchShape
    readonly props: AccountingWorkbenchDataView
    readonly on: AccountingWorkbenchActions
}

const panelId = (id: string): string => `agent-dashboard-panel-${id}`

const EvidencePanel = (props: Omit<AccountingWorkbenchBaseProps, "shape">) => (
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
        case "explanation":
            return null
    }
}

const DashboardCards = (props: Omit<AccountingWorkbenchBaseProps, "shape">) => {
    const regions = props.props.regions
    return (
        <Grid kind="cards" columns={3}>
            <SlotView
                {...regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <DoneRegion label={regions.done.label} view={done} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.connections}
                onRetry={props.on.retryDashboard}
                render={(connections, isLoading) => (
                    <ConnectionsRegion label={regions.connections.label} view={connections} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.knowledge}
                onRetry={props.on.retryDashboard}
                render={(knowledge, isLoading) => (
                    <KnowledgeRegion label={regions.knowledge.label} view={knowledge} isLoading={isLoading} />
                )}
            />
        </Grid>
    )
}

const Overview = (props: AccountingWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <SlotView
                {...view.waiting}
                empty="collapse"
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
            <SlotView
                {...view.ribbon}
                onRetry={props.on.retry}
                render={(items, isLoading) => (
                    <FiguresStrip label={view.ribbon.label} items={items} isLoading={isLoading} />
                )}
            />
            <Tabs
                label={view.tabsLabel}
                selectedKey={view.selectedTab}
                inset="none"
                labelVisibility="always"
                items={view.tabs}
                panelId={panelId}
                onSelect={props.on.selectTab}
            />
            <div role="tabpanel" id={panelId(view.selectedTab)}>
                <ModulePanel {...props} />
            </div>
            <DashboardCards props={props.props} on={props.on} />
        </Stack>
    )
}

const Explanation = (props: Omit<AccountingWorkbenchBaseProps, "shape">) => {
    const view = props.props
    const why = view.why
    return (
        <WorkbenchWhyFrame
            label={why.paneLabel}
            listLabel={why.listLabel}
            openLabel={why.openLabel}
            closeLabel={why.closeLabel}
            view={why.view}
            labels={why.labels}
            onClose={props.on.closeWhy}
        >
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.waiting.label}
                        rows={waiting.rows}
                        openLabel={waiting.openLabel}
                        isLoading={isLoading}
                    />
                )}
            />
            <SlotView
                {...view.regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.done.label}
                        rows={done.rows}
                        openLabel={null}
                        isLoading={isLoading}
                    />
                )}
            />
        </WorkbenchWhyFrame>
    )
}

/** Draws each Accounting area or its explanation from the same module-owned world. */
export const AccountingWorkbenchBase = (props: AccountingWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "overview":
        case "evidence":
        case "questions":
        case "ledger":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
