import { Children, type ReactNode } from "react"
import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    SectionHeader,
    SurfaceCard,
    SurfaceListCard,
    Tabs,
} from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { AccountingDashboardSection } from "@/components/branches/AccountingDashboardSection"
import type { AccountingDashboardView } from "@/modules/types"
import {
    FRAME_CLASS_NAME,
    HEAD_CLASS_NAME,
    PANEL_CLASS_NAME,
    SIDE_COLUMN_CLASS_NAME,
    SIDE_GRID_CLASS_NAME,
} from "./classNames"

/** The stable identity and settled label of one accounting workbench area. */
interface AccountingAgentTab {
    readonly id: string
    readonly label: string
}

/** Settled accounting frame copy and content, controlled selection, and the reader's actions. */
interface AccountingAgentFrameProps {
    readonly children: ReactNode
    readonly state: {
        readonly isLoading: boolean
        readonly figuresFailed: boolean
        readonly selectedTab: string
    }
    readonly props: {
        readonly view: AccountingDashboardView
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly tabs: ReadonlyArray<AccountingAgentTab>
    }
    readonly on: {
        readonly retry: () => void
        readonly selectTab: (id: string) => void
    }
}

const panelIdOf = (id: string): string => `accounting-dashboard-panel-${id}`

/** Draws the accounting agent's shared dashboard anatomy around the selected workbench area. */
export const AccountingAgentFrame = (props: AccountingAgentFrameProps) => {
    const { view, figures, tabs } = props.props
    const { isLoading, figuresFailed, selectedTab } = props.state
    const selectedIndex = Math.max(
        0,
        tabs.findIndex((tab) => tab.id === selectedTab),
    )
    const active = tabs[selectedIndex]
    const selected = active?.id ?? ""
    const hasTabs = tabs.length > 1
    const sectionState = { isLoading }
    const sectionOn = { retry: props.on.retry }
    const sectionCopy = { failureTitle: view.labels.failure, retryLabel: view.labels.retry }
    let content = Children.toArray(props.children)[selectedIndex]
    if (isLoading) {
        content = <SurfaceListCard ariaLabel={active?.label ?? view.labels.tabs} isLoading />
    }
    return (
        <div className={FRAME_CLASS_NAME}>
            <div className={HEAD_CLASS_NAME}>
                <SectionHeader
                    level={2}
                    title={view.heading}
                    isSkeleton={isLoading}
                    meta={
                        view.mode === null ? undefined : (
                            <Badge tone={view.mode.tone} isDot>
                                {view.mode.label}
                            </Badge>
                        )
                    }
                    action={
                        view.chat === null ? undefined : (
                            <Button variant="primary" href={view.chat.href}>
                                {view.chat.label}
                            </Button>
                        )
                    }
                />
            </div>
            {figuresFailed ? (
                <Alert
                    tone="negative"
                    title={view.labels.failure}
                    description={view.labels.failureBody}
                    action={{ label: view.labels.retry, onAction: props.on.retry }}
                />
            ) : (
                <SurfaceCard ariaLabel={view.labels.ribbon}>
                    <DescriptionList layout="stat-strip" isDivided isLoading={isLoading} items={figures} />
                </SurfaceCard>
            )}
            <AccountingDashboardSection
                state={sectionState}
                props={{ ...sectionCopy, view: view.waiting }}
                on={sectionOn}
            />
            <div className={SIDE_GRID_CLASS_NAME}>
                <AccountingDashboardSection
                    state={sectionState}
                    props={{ ...sectionCopy, view: view.done }}
                    on={sectionOn}
                />
                <AccountingDashboardSection
                    state={sectionState}
                    props={{ ...sectionCopy, view: view.connections }}
                    on={sectionOn}
                />
                <div className={SIDE_COLUMN_CLASS_NAME}>
                    <AccountingDashboardSection
                        state={sectionState}
                        props={{ ...sectionCopy, view: view.knowledge }}
                        on={sectionOn}
                    />
                    {view.gaps === null ? null : (
                        <AccountingDashboardSection
                            state={sectionState}
                            props={{ ...sectionCopy, view: view.gaps }}
                            on={sectionOn}
                        />
                    )}
                </div>
            </div>
            {hasTabs ? (
                <Tabs
                    variant="primary"
                    label={view.labels.tabs}
                    selectedKey={selected}
                    items={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
                    inset="none"
                    labelVisibility="always"
                    panelId={panelIdOf}
                    onSelect={props.on.selectTab}
                />
            ) : null}
            <div
                className={PANEL_CLASS_NAME}
                role={hasTabs ? "tabpanel" : undefined}
                id={hasTabs ? panelIdOf(selected) : undefined}
            >
                {content}
            </div>
        </div>
    )
}
