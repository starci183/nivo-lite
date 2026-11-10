import { Alert, EmptyNotice, Meter, SurfaceCard, Text, Stack } from "@starci/grammar/common"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { UsageCardData, UsageCardView } from "@/hooks/usageCard"
import { CHART_CLASS_NAME } from "./classNames"

/** The usage figures (or their placeholder while the read is on its way), the waiting flag and the interaction callbacks. */
interface UsageCardProps {
    readonly view: UsageCardData
    /** True while the usage is read: the card keeps its title and rests as a line of skeleton text. */
    readonly isLoading: boolean
    readonly on: UsageCardView["on"]
}

/** Monthly allowance, remaining credits, agent totals and daily usage: one card per content (meters, facts, agents, days). */
export const UsageCard = (props: UsageCardProps) => {
    const { view } = props
    const isLoading = props.isLoading === true
    return (
        <Stack gap="region">
            {view.alert ? (
                <Alert
                    tone={view.alert.tone}
                    title={view.alert.title}
                    action={{ label: view.alert.actionLabel, onAction: props.on.openCredits }}
                />
            ) : null}
            <SurfaceCard label={view.title} headingLevel={2} isLoading={isLoading} note={view.description}>
                <Stack gap="row">
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
                </Stack>
            </SurfaceCard>
            {view.facts.length > 0 ? (
                <SurfaceCard
                    kind="details"
                    ariaLabel={view.title}
                    items={view.facts.map((fact) => ({
                        id: fact.id,
                        term: fact.term,
                        description: <Text isStrong>{fact.value}</Text>,
                    }))}
                />
            ) : null}
            <SurfaceCard
                kind="list"
                label={view.modulesTitle}
                headingLevel={2}
                items={view.modules.map((module) => ({ id: module.id, title: module.label, description: module.reading }))}
                empty={<EmptyNotice message={view.empty} />}
            />
            {view.daily ? renderUsageCardDailyUsage(view.daily, props) : null}
        </Stack>
    )
}

/** Renders the UsageCard daily usage section. */
const renderUsageCardDailyUsage = (daily: NonNullable<UsageCardData["daily"]>, props: UsageCardProps) => (
    <SurfaceCard label={daily.title} headingLevel={2} note={`${daily.firstDay} – ${daily.lastDay}`}>
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
    </SurfaceCard>
)
