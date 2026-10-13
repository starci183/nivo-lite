import { Alert, DescriptionList, Heading, List, ListItem, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { UsageCardView } from "@/hooks/usageCard"
import {
    CHART_AXIS_CLASS_NAME,
    CHART_CLASS_NAME,
    MODULE_LIST_CLASS_NAME,
    MODULE_ROW_CLASS_NAME,
    STACK_CLASS_NAME,
    USAGE_BLOCK_CLASS_NAME,
} from "./classNames"

/** The presentation receives prepared words and figures with explicit interaction callbacks. */
interface UsageCardProps {
    readonly state: UsageCardView["state"]
    readonly props: UsageCardView["props"]
    readonly on: UsageCardView["on"]
}

/** Monthly allowance, remaining credits, agent totals and daily usage, including its read state. */
export const UsageCard = (props: UsageCardProps) => {
    const view = props.props
    if (props.state.error) {
        return (
            <SurfaceCard label={view.title} headingLevel={2}>
                <Alert tone="negative" title={view.errorTitle} description={props.state.error} />
            </SurfaceCard>
        )
    }
    if (props.state.isLoading) {
        return (
            <SurfaceCard label={view.title} headingLevel={2}>
                <Text tone="muted">{view.loading}</Text>
            </SurfaceCard>
        )
    }
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
                            {view.modules.map((module) => (
                                <ListItem key={module.id} className={MODULE_ROW_CLASS_NAME}>
                                    <Text weight="medium">{module.label}</Text>
                                    <Text size="sm" tone="muted">
                                        {module.reading}
                                    </Text>
                                </ListItem>
                            ))}
                        </List>
                    ) : (
                        <Text tone="muted">{view.empty}</Text>
                    )}
                </div>
                {view.daily ? (
                    <div className={USAGE_BLOCK_CLASS_NAME}>
                        <Heading level={3}>{view.daily.title}</Heading>
                        <div className={CHART_CLASS_NAME} role="img" aria-label={view.daily.accessibleLabel}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={view.daily.series} accessibilityLayer={false}>
                                    <XAxis hide dataKey="day" />
                                    <YAxis hide domain={[0, view.daily.maximum]} />
                                    <Tooltip labelFormatter={props.on.formatDay} formatter={props.on.formatCredits} />
                                    <Bar
                                        dataKey="credits"
                                        name={view.daily.creditsLabel}
                                        fill="currentColor"
                                        minPointSize={props.on.minimumBarSize}
                                        isAnimationActive={false}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className={CHART_AXIS_CLASS_NAME}>
                            <Text size="sm" tone="muted">
                                {view.daily.firstDay}
                            </Text>
                            <Text size="sm" tone="muted">
                                {view.daily.lastDay}
                            </Text>
                        </div>
                    </div>
                ) : null}
            </div>
        </SurfaceCard>
    )
}
