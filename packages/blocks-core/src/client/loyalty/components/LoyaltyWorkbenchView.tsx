import { Alert, Stack, Tabs } from "@starci/grammar/common"
import { LoyaltyMembers } from "./LoyaltyMembers"
import { LoyaltyPromo } from "./LoyaltyPromo"
import { LoyaltyRewards } from "./LoyaltyRewards"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FiguresStrip, WaitingRegion, WorkbenchDashboardCards, WorkbenchExplanation } from "../legacy"
import { LoyaltyCampaignMessage } from "./LoyaltyCampaignMessage"
import { LoyaltyCampaignSegment } from "./LoyaltyCampaignSegment"
import { LoyaltyMemberPanel } from "./LoyaltyMemberPanel"
import { LoyaltyOverview } from "./LoyaltyOverview"
import { LoyaltyPending } from "./LoyaltyPending"
import { LoyaltyPromoOutcome } from "./LoyaltyPromoOutcome"
import { LoyaltyPromoPreview } from "./LoyaltyPromoPreview"
import type { ReactNode } from "react"
import type { LoyaltyWorkbenchData, LoyaltyWorkbenchOn } from "../types"

/** One arrangement of the Loyalty workbench: its five panels and the recorded explanation. */
export type LoyaltyWorkbenchShape = "overview" | "members" | "rewards" | "promo" | "decisions" | "explanation"

/** The existing native presentation contract, with pure fields and actions owned separately. */
export interface LoyaltyWorkbenchViewProps {
    readonly shape: LoyaltyWorkbenchShape
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

const Members = (props: Omit<LoyaltyWorkbenchViewProps, "shape">) => {
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

const Promotion = (props: Omit<LoyaltyWorkbenchViewProps, "shape">) => {
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
                                        result={outcome.result}
                                        failureMessage={outcome.failure}
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

const ModulePanel = (props: LoyaltyWorkbenchViewProps) => {
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

const Overview = (props: LoyaltyWorkbenchViewProps) => {
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
                    <FiguresStrip
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
            <WorkbenchDashboardCards regions={view.regions} onRetry={props.on.retryDashboard} />
        </Stack>
    )
}

/** All real module and explanation arrangements, with each read failing and retrying in its own region. */
export const LoyaltyWorkbenchView = (props: LoyaltyWorkbenchViewProps): ReactNode => {
    switch (props.shape) {
        case "overview":
        case "members":
        case "rewards":
        case "promo":
        case "decisions":
            return <Overview {...props} />
        case "explanation":
            return (
                <WorkbenchExplanation
                    why={props.props.why}
                    regions={props.props.regions}
                    onClose={props.on.closeWhy}
                    onRetry={props.on.retryDashboard}
                />
            )
    }
}
