import { Alert, Grid, Stack, Tabs } from "@starci/grammar/common"
import { LoyaltyMembers } from "@/components/frames/LoyaltyMembers"
import { LoyaltyPromo } from "@/components/frames/LoyaltyPromo"
import { LoyaltyRewards } from "@/components/frames/LoyaltyRewards"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { FiguresRibbon } from "@/components/composites/FiguresRibbon"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { LoyaltyCampaignMessage } from "@/components/composites/LoyaltyCampaignMessage"
import { LoyaltyCampaignSegment } from "@/components/composites/LoyaltyCampaignSegment"
import { LoyaltyMemberPanel } from "@/components/composites/LoyaltyMemberPanel"
import { LoyaltyOverview } from "@/components/composites/LoyaltyOverview"
import { LoyaltyPending } from "@/components/composites/LoyaltyPending"
import { LoyaltyPromoOutcome } from "@/components/composites/LoyaltyPromoOutcome"
import { LoyaltyPromoPreview } from "@/components/composites/LoyaltyPromoPreview"
import { SlotView } from "@/components/composites/SlotView"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import type { LoyaltyWorkbenchData, LoyaltyWorkbenchOn } from "@/modules/types"

/** The actual five Loyalty panels and the existing recorded explanation arrangement. */
export const LOYALTY_WORKBENCH_SHAPES = ["overview", "members", "rewards", "promo", "decisions", "explanation"] as const
/** Every read remains a slot; only actions cross the separate command carrier. */
/** The existing native presentation contract, with pure fields and actions owned separately. */
export interface LoyaltyWorkbenchBaseProps {
    readonly shape: (typeof LOYALTY_WORKBENCH_SHAPES)[number]
    readonly props: LoyaltyWorkbenchData
    readonly on: LoyaltyWorkbenchOn
}

const ROWS_EMPTY = { rows: [] }
const OVERVIEW_EMPTY = { tiers: [], stats: [], linkUrl: "" }
const MEMBER_EMPTY = {
    identity: { name: "", points: "", contact: "", spentLine: "", joinedLine: "", nextTierLine: "", asOf: "" },
    rewardRows: [],
    ledgerRows: [],
}
const panelId = (id: string): string => `agent-dashboard-panel-${id}`

const Members = (props: Omit<LoyaltyWorkbenchBaseProps, "shape">) => {
    const { members } = props.props
    const on = props.on.members
    return (
        <SlotView
            {...members}
            placeholder={ROWS_EMPTY}
            onRetry={on.retry}
            render={(view, isLoading) => (
                <LoyaltyMembers {...members.copy} rows={view.rows} on={on} isLoading={isLoading}>
                    <SlotView
                        {...members.detail}
                        placeholder={MEMBER_EMPTY}
                        onRetry={on.detail.retry}
                        render={(member, isLoading) => (
                            <LoyaltyMemberPanel
                                {...member.identity}
                                {...members.detail.copy}
                                rewards={{ ...members.detail.copy.rewards, rows: member.rewardRows }}
                                ledger={{ ...members.detail.copy.ledger, rows: member.ledgerRows }}
                                isLoading={isLoading}
                                onClose={() => on.select(null)}
                                onEdit={on.detail.edit}
                                onAdjust={on.detail.adjust}
                                onRedeem={on.detail.redeem}
                            />
                        )}
                    />
                </LoyaltyMembers>
            )}
        />
    )
}

const Promotion = (props: Omit<LoyaltyWorkbenchBaseProps, "shape">) => {
    const { promo } = props.props
    const on = props.on.promo
    return (
        <SlotView
            {...promo}
            placeholder={ROWS_EMPTY}
            onRetry={on.retry}
            render={(view, isLoading) => (
                <LoyaltyPromo {...promo.copy} rows={view.rows} isLoading={isLoading}>
                    <LoyaltyCampaignSegment {...promo.copy} on={on} isLoading={isLoading} />
                    <div aria-live="polite">
                        <SlotView
                            {...promo.preview}
                            placeholder={[
                                { id: "audience", text: promo.preview.loadingLabel, emphasis: true },
                                { id: "who", text: promo.preview.audienceLabel, emphasis: false },
                            ]}
                            onRetry={on.retryPreview}
                            render={(lines, isLoading) => <LoyaltyPromoPreview lines={lines} isLoading={isLoading} />}
                        />
                    </div>
                    <LoyaltyCampaignMessage {...promo.copy} on={on} isLoading={isLoading} />
                    <div aria-live="polite">
                        {promo.campaign.hasCampaign ? (
                            <SlotView
                                {...promo.campaign}
                                placeholder={{ result: undefined, failure: undefined }}
                                onRetry={on.retryCampaign}
                                render={(outcome, isLoading) => (
                                    <LoyaltyPromoOutcome
                                        {...outcome}
                                        failureTitle={promo.copy.copy.failedTitle}
                                        draftLabel={promo.copy.copy.draftLabel}
                                        isLoading={isLoading}
                                    />
                                )}
                            />
                        ) : null}
                    </div>
                </LoyaltyPromo>
            )}
        />
    )
}

const ModulePanel = (props: LoyaltyWorkbenchBaseProps) => {
    const { overview, rewards, pending } = props.props
    const on = props.on
    switch (props.shape) {
        case "overview":
            return (
                <>
                    <div aria-live="polite">
                        {overview.syncNote === undefined ? null : <Alert {...overview.syncNote} tone="affirmative" />}
                    </div>
                    <SlotView
                        {...overview}
                        placeholder={OVERVIEW_EMPTY}
                        onRetry={on.overview.retry}
                        render={(data, isLoading) => (
                            <LoyaltyOverview
                                {...overview.copy}
                                tiers={{ ...overview.copy.tiers, rows: data.tiers }}
                                stats={{ ...overview.copy.stats, items: data.stats }}
                                link={{ ...overview.copy.link, url: data.linkUrl }}
                                on={on.overview}
                                isSyncing={overview.isSyncing}
                                isLoading={isLoading}
                            />
                        )}
                    />
                </>
            )
        case "members":
            return <Members props={props.props} on={props.on} />
        case "rewards":
            return (
                <SlotView
                    {...rewards}
                    placeholder={ROWS_EMPTY}
                    onRetry={on.rewards.retry}
                    render={(data, isLoading) => (
                        <LoyaltyRewards {...rewards.copy} rows={data.rows} on={on.rewards} isLoading={isLoading} />
                    )}
                />
            )
        case "promo":
            return <Promotion props={props.props} on={props.on} />
        case "decisions":
            return (
                <SlotView
                    {...pending}
                    placeholder={ROWS_EMPTY}
                    onRetry={on.pending.retry}
                    render={(data, isLoading) => (
                        <LoyaltyPending {...pending.copy} rows={data.rows} on={on.pending} isLoading={isLoading} />
                    )}
                />
            )
        case "explanation":
            return null
    }
}

const DashboardCards = (props: Omit<LoyaltyWorkbenchBaseProps, "shape">) => {
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

const Overview = (props: LoyaltyWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WaitingRegion label={view.regions.waiting.label} view={waiting} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...view.ribbon}
                placeholder={[]}
                onRetry={props.on.ribbon.retry}
                forbidden="notice"
                render={(items, isLoading) => (
                    <FiguresRibbon
                        label={view.ribbon.label}
                        items={view.ribbon.captions.map((caption) => {
                            const value = items.find((item) => item.id === caption.id)
                            return { ...caption, value: value?.value ?? "", meta: value?.meta ?? "" }
                        })}
                        isLoading={isLoading}
                    />
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

const Explanation = (props: Omit<LoyaltyWorkbenchBaseProps, "shape">) => {
    const view = props.props
    return (
        <WorkbenchWhyFrame {...view.why} onClose={props.on.closeWhy}>
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

/** All real module and explanation arrangements, with each read failing and retrying in its own region. */
export const LoyaltyWorkbenchBase = (props: LoyaltyWorkbenchBaseProps) => {
    switch (props.shape) {
        case "overview":
        case "members":
        case "rewards":
        case "promo":
        case "decisions":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
