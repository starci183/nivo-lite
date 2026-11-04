import { Alert, Avatar, Page, Pane, PaneGrid, Stack } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneHead } from "@/components/composites/PaneHead"
import { LeadApprovalSection } from "@/components/frames/LeadApprovalSection"
import { LeadAsideHead } from "@/components/frames/LeadAsideHead"
import { LeadContextSection } from "@/components/frames/LeadContextSection"
import { LeadFlowSection } from "@/components/frames/LeadFlowSection"
import { LeadHeadBand } from "@/components/frames/LeadHeadBand"
import { LeadCreateDialog } from "@/components/frames/LeadCreateDialog"
import { LeadListHead } from "@/components/frames/LeadListHead"
import { LeadOutcomeDialog } from "@/components/frames/LeadOutcomeDialog"
import { LeadOutcomeSection } from "@/components/frames/LeadOutcomeSection"
import { LeadStepDialog } from "@/components/frames/LeadStepDialog"
import { LeadStepSection } from "@/components/frames/LeadStepSection"
import { LeadTimelineSection } from "@/components/frames/LeadTimelineSection"
import { PaneBody } from "@/components/frames/PaneBody"
import { PaneList } from "@/components/frames/PaneList"
import { nivoIconSource } from "@/components/leaves/Icon"
import type {
    LeadCreateDialogProps,
    LeadDetailPaneView,
    LeadListPaneView,
    LeadPanesCopy,
    LeadPanesOn,
    LeadRowView,
    PaneGridLayout,
} from "@/modules/types"

/** The words, data and commands of the lead panes: the list, the open lead when there is one, and the new-lead dialog. */
export interface LeadPanesBaseProps {
    readonly props: {
        readonly copy: LeadPanesCopy
        readonly list: LeadListPaneView
        readonly grid: PaneGridLayout
        readonly detail: LeadDetailPaneView | null
        /** The address names a lead that does not exist: the main pane says so and offers the way back. */
        readonly isMissing: boolean
        readonly create: LeadCreateDialogProps["props"]
    }
    readonly on: LeadPanesOn
}

/** What the panes of an open lead draw below their heads. */
interface DetailBodyProps {
    readonly detail: LeadDetailPaneView
    readonly on: LeadPanesOn
}

/** The rows: the name over the company, channel and age, the stage chip and the owner at the end. A narrow list names the company alone. */
const itemsOf = (rows: ReadonlyArray<LeadRowView>, isCompact: boolean): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.name,
        description: isCompact ? row.company : row.line,
        descriptionLines: 2 as const,
        leading: <Avatar name={row.name} size="sm" />,
        trailing: <RowTrailing order="badge-first" badge={row.badge} {...(isCompact ? {} : { meta: row.owner })} />,
    }))

/** The list pane body through the slot's one status recipe: skeleton, first-run notice, failure band, or the filter group and rows, then the closing lines. */
const ListBody = (props: LeadPanesBaseProps) => {
    const { copy, list } = props.props
    const { on } = props
    return (
        <Stack gap="row">
            <SlotView
                slot={list.slot}
                placeholder={list.placeholder}
                labels={list.labels}
                errorDescription={copy.errorBody}
                emptyDescription={copy.emptyBody}
                emptyIconSource={nivoIconSource("account", "leading")}
                emptyAction={{ label: copy.newLead, onAction: on.newLead }}
                onRetry={on.retry}
                render={(view, isLoading) => (
                    <PaneList
                        label={copy.listLabel}
                        search={{
                            label: copy.searchLabel,
                            placeholder: copy.searchPlaceholder,
                            clearLabel: copy.clearSearch,
                            value: list.query,
                            onChange: on.query,
                        }}
                        choice={{
                            label: copy.tabsLabel,
                            options: view.tabs,
                            value: list.stage,
                            onChange: on.stage,
                        }}
                        items={itemsOf(view.rows, list.selectedId !== null)}
                        selectedId={list.selectedId}
                        onSelect={on.open}
                        empty={{
                            message: copy.noMatchTitle,
                            description: copy.noMatchBody,
                            actionLabel: copy.clearFilters,
                            onAction: on.clear,
                        }}
                        {...(list.pagination.loadedHint === null ? {} : { footer: list.pagination.loadedHint })}
                        {...(list.pagination.hasNextPage || list.pagination.loadMoreError !== null
                            ? {
                                  footerAction: {
                                      label: list.pagination.loadMoreError === null ? copy.loadMore : copy.retry,
                                      onPress: list.pagination.loadMoreError === null ? on.loadMore : on.retry,
                                      isPending: list.pagination.isPending,
                                      ...(list.pagination.loadMoreError === null
                                          ? {}
                                          : { error: list.pagination.loadMoreError }),
                                  },
                              }
                            : {})}
                        isLoading={isLoading}
                    />
                )}
            />
        </Stack>
    )
}

/** The head of the main pane: the open lead's band, or the page title when nothing (or nothing real) is open. */
const MainHead = (props: LeadPanesBaseProps) => {
    const { copy, detail, isMissing } = props.props
    const { on } = props
    if (detail === null) {
        return (
            <PaneHead
                title={isMissing ? copy.missingTitle : copy.title}
                headingLevel={1}
                {...(isMissing ? {} : { description: copy.pageBody })}
                back={{ label: copy.back, onPress: on.back }}
            />
        )
    }
    return (
        <LeadHeadBand
            pane={detail.head}
            labels={detail.headLabels}
            isInfoOpen={detail.isInfoOpen}
            hasBrief={detail.hasBrief}
            backLabel={copy.back}
            on={on}
        />
    )
}

/** The main pane of an open lead: the last notice, the approval, then the activity trail. */
const MainBody = (props: DetailBodyProps) => (
    <>
        {props.detail.head.notice === null ? null : (
            <Alert tone="informative" title={props.detail.copy.noticeTitle} description={props.detail.head.notice} />
        )}
        <LeadApprovalSection pane={props.detail.approval} on={props.on} />
        <LeadTimelineSection slot={props.detail.timeline.slot} labels={props.detail.timeline.labels} on={props.on} />
    </>
)

/** The aside of an open lead: next step, context, outcome, orders and payments. */
const AsideBody = (props: DetailBodyProps) => (
    <>
        <LeadStepSection pane={props.detail.step} on={props.on} />
        <LeadContextSection pane={props.detail.context} on={props.on} />
        <LeadOutcomeSection pane={props.detail.outcome} on={props.on} />
        <LeadFlowSection
            slot={props.detail.flow.slot}
            labels={props.detail.flow.labels}
            emptyText={props.detail.copy.flowNone}
            on={props.on}
        />
    </>
)

/** The dialogs of the page, kept inside the list pane so the page stays one grid: the new lead, and for an open lead its step and outcome. */
const Dialogs = (props: LeadPanesBaseProps) => {
    const { detail, create } = props.props
    const { on } = props
    return (
        <>
            <LeadCreateDialog
                props={create}
                on={{ change: on.createChange, submit: on.createSubmit, close: on.createClose }}
            />
            {detail === null ? null : (
                <>
                    <LeadStepDialog
                        form={detail.step.form}
                        labels={detail.step.labels.form}
                        isPending={detail.step.isPending}
                        on={{
                            change: on.stepChange,
                            changeDue: on.stepChangeDue,
                            submit: on.stepSubmit,
                            close: on.stepClose,
                        }}
                    />
                    <LeadOutcomeDialog
                        pane={detail.outcome}
                        on={{
                            close: on.outcomeClose,
                            stage: on.outcomeStage,
                            evidence: on.outcomeEvidence,
                            submit: on.outcomeSubmit,
                        }}
                    />
                </>
            )}
        </>
    )
}

/** Draws the leads as the chat pattern: the list beside the open customer (approval and activity, and an aside of facts), with the dialogs that edit one. */
export const LeadPanesBase = (props: LeadPanesBaseProps) => {
    const { copy, grid, detail, isMissing, list } = props.props
    const { on } = props
    const draftId = detail?.head.primary === "draft" ? detail.head.responsibilityId : null
    const phonePrimary =
        detail === null || draftId === null
            ? undefined
            : { label: detail.headLabels.draft, onPress: () => on.draft(draftId) }
    return (
        <Page chrome="panes">
            <PaneGrid label={copy.grid} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="listHead" surface>
                    <LeadListHead
                        title={copy.title}
                        newLead={copy.newLead}
                        isFirstRun={"isEmpty" in list.slot}
                        isLeadOpen={list.selectedId !== null}
                        onNewLead={on.newLead}
                    />
                </Pane>
                <Pane area="list" surface scroll label={copy.listLabel}>
                    <PaneBody>
                        <ListBody {...props} />
                        <Dialogs {...props} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <MainHead {...props} />
                </Pane>
                {detail === null ? (
                    <Pane area="main" label={copy.detailLabel}>
                        <PaneBlank
                            message={isMissing ? copy.missingTitle : copy.pickTitle}
                            description={isMissing ? copy.missingBody : copy.pickBody}
                            iconSource={nivoIconSource("account", "leading")}
                            {...(isMissing ? { actionLabel: copy.missingBack, onAction: on.back } : {})}
                        />
                    </Pane>
                ) : (
                    <Pane area="main" scroll label={copy.detailLabel}>
                        <PaneBody {...(phonePrimary === undefined ? {} : { phonePrimary })}>
                            <MainBody detail={detail} on={on} />
                        </PaneBody>
                    </Pane>
                )}
                {detail?.isInfoOpen === true ? (
                    <Pane area="asideHead" surface>
                        <LeadAsideHead
                            title={detail.copy.infoTitle}
                            closeLabel={detail.copy.infoClose}
                            onClose={on.toggleInfo}
                        />
                    </Pane>
                ) : null}
                {detail === null ? null : (
                    <Pane
                        area="aside"
                        surface
                        scroll
                        label={detail.copy.infoTitle}
                        collapse="drawer"
                        collapseLabel={detail.copy.infoTitle}
                        openLabel={detail.headLabels.infoOpen}
                        closeLabel={detail.copy.infoClose}
                        isOpen={detail.isDrawerOpen}
                        onOpenChange={on.drawer}
                    >
                        <PaneBody>
                            <AsideBody detail={detail} on={on} />
                        </PaneBody>
                    </Pane>
                )}
            </PaneGrid>
        </Page>
    )
}
