import {
    Alert,
    DescriptionList,
    Divider,
    Heading,
    List,
    ListItem,
    Meter,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { SlotView } from "@/components/composites/SlotView"
import type { UsageCardData, UsageCardView } from "@/hooks/usageCard"
import type { SlotLabels } from "@/modules/types"
import {
    CHART_AXIS_CLASS_NAME,
    CHART_CLASS_NAME,
    MODULE_LINE_CLASS_NAME,
    MODULE_LIST_CLASS_NAME,
    MODULE_ROW_CLASS_NAME,
    STACK_CLASS_NAME,
    USAGE_BLOCK_CLASS_NAME,
} from "./classNames"

/** The presentation receives the usage slot with its placeholder and labels, and explicit interaction callbacks. */
interface UsageCardProps {
    readonly slot: UsageCardView["slot"]
    readonly placeholder: UsageCardView["placeholder"]
    readonly labels: SlotLabels
    readonly on: UsageCardView["on"]
}

/** Monthly allowance, remaining credits, agent totals and daily usage; the read's status is drawn through SlotView. */
export const UsageCard = (props: UsageCardProps) => (
    <SlotView
        slot={props.slot}
        placeholder={props.placeholder}
        labels={props.labels}
        forbidden="hide"
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) =>
            isSkeleton ? <UsageCardSkeleton view={view} /> : <UsageCardReady view={view} on={props.on} />
        }
    </SlotView>
)

/** The card while the usage is read: its title and one line of text as skeleton. */
const UsageCardSkeleton = (props: { readonly view: UsageCardData }) => (
    <SurfaceCard label={props.view.title} headingLevel={2}>
        <Text tone="muted" isSkeleton>
            {props.view.loading}
        </Text>
    </SurfaceCard>
)

type UsageCardReadyProps = { readonly view: UsageCardData; readonly on: UsageCardView["on"] }

/** The card once the usage is read. */
const UsageCardReady = (props: UsageCardReadyProps) => {
    const { view } = props
    return (
        <SurfaceCard label={view.title} headingLevel={2}>
            <div className={STACK_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {view.description}
                </Text>
                {view.alert ? (
                    <Alert
                        tone={view.alert.tone}
                        title={view.alert.title}
                        action={{ label: view.alert.actionLabel, onAction: props.on.openCredits }}
                    />
                ) : null}
                {view.meters.length > 0 ? (
                    <div className={USAGE_BLOCK_CLASS_NAME}>
                        {view.meters.map((meter) => (
                            <Meter
                                key={meter.id}
                                label={meter.label}
                                value={meter.value}
                                minValue={0}
                                maxValue={meter.maximum}
                                valueLabel={meter.reading}
                                tone={meter.tone}
                            />
                        ))}
                    </div>
                ) : null}
                {view.facts.length > 0 ? (
                    <DescriptionList
                        layout="columns"
                        isDivided
                        items={view.facts.map((fact) => ({
                            id: fact.id,
                            term: fact.term,
                            description: <Text weight="semibold">{fact.value}</Text>,
                        }))}
                    />
                ) : null}
                <div className={USAGE_BLOCK_CLASS_NAME}>
                    <Heading level={3}>{view.modulesTitle}</Heading>
                    {view.modules.length > 0 ? (
                        <List className={MODULE_LIST_CLASS_NAME} label={view.modulesTitle}>
                            {view.modules.map((module, index) => (
                                <ListItem key={module.id} className={MODULE_ROW_CLASS_NAME}>
                                    {index > 0 ? <Divider semantics="presentation" /> : null}
                                    <div className={MODULE_LINE_CLASS_NAME}>
                                        <Text weight="medium">{module.label}</Text>
                                        <Text size="sm" tone="muted">
                                            {module.reading}
                                        </Text>
                                    </div>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Text tone="muted">{view.empty}</Text>
                    )}
                </div>
                {view.daily ? renderUsageCardDailyUsage(view.daily, props) : null}
            </div>
        </SurfaceCard>
    )
}

/** Renders the UsageCard daily usage section. */
const renderUsageCardDailyUsage = (daily: NonNullable<UsageCardData["daily"]>, props: UsageCardReadyProps) => (
    <div className={USAGE_BLOCK_CLASS_NAME}>
        <Heading level={3}>{daily.title}</Heading>
        <div className={CHART_CLASS_NAME} role="img" aria-label={daily.accessibleLabel}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={daily.series} accessibilityLayer={false}>
                    <XAxis hide dataKey="day" />
                    <YAxis hide domain={[0, daily.maximum]} />
                    <Tooltip labelFormatter={props.on.formatDay} formatter={props.on.formatCredits} />
                    <Bar
                        dataKey="credits"
                        name={daily.creditsLabel}
                        fill="var(--accent)"
                        minPointSize={props.on.minimumBarSize}
                        isAnimationActive={false}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <div className={CHART_AXIS_CLASS_NAME}>
            <Text size="sm" tone="muted">
                {daily.firstDay}
            </Text>
            <Text size="sm" tone="muted">
                {daily.lastDay}
            </Text>
        </div>
    </div>
)
