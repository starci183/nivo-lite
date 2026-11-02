import { Alert, DescriptionList, EmptyNotice, Section, Meter, SurfaceCard, Text, Stack } from "@starci/grammar/common"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { UsageCardData, UsageCardView } from "@/hooks/usageCard"
import { CHART_AXIS_CLASS_NAME, CHART_CLASS_NAME } from "./classNames"

/** The usage figures (or their placeholder while the read is on its way), the waiting flag and the interaction callbacks. */
interface UsageCardProps {
    readonly view: UsageCardData
    /** True while the usage is read: the card keeps its title and rests as a line of skeleton text. */
    readonly isLoading: boolean
    readonly on: UsageCardView["on"]
}

/** Monthly allowance, remaining credits, agent totals and daily usage; while the read is on its way only the title and one line draw. */
export const UsageCard = (props: UsageCardProps) => {
    const { view } = props
    return (
        <SurfaceCard label={view.title} headingLevel={2} isLoading={props.isLoading === true}>
            <Stack gap="section">
                <Text size="sm" tone="muted" isLoading={props.isLoading === true}>
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
                ) : null}
                {view.facts.length > 0 ? (
                    <DescriptionList
                        layout="columns"
                        isDivided
                        items={view.facts.map((fact) => ({
                            id: fact.id,
                            term: fact.term,
                            description: <Text isStrong>{fact.value}</Text>,
                        }))}
                    />
                ) : null}
                <UsageCardModules view={view} />
                {view.daily ? renderUsageCardDailyUsage(view.daily, props) : null}
            </Stack>
        </SurfaceCard>
    )
}

type UsageCardModulesProps = { readonly view: UsageCardData }

/** The per-agent usage list of the card, or its empty line. */
const UsageCardModules = (props: UsageCardModulesProps) => {
    const { view } = props
    return (
        <Section
            kind="list"
            title={view.modulesTitle}
            headingLevel={3}
            items={view.modules.map((module) => ({ id: module.id, title: module.label, description: module.reading }))}
            empty={<EmptyNotice message={view.empty} />}
        />
    )
}

/** Renders the UsageCard daily usage section. */
const renderUsageCardDailyUsage = (daily: NonNullable<UsageCardData["daily"]>, props: UsageCardProps) => (
    <Section title={daily.title} headingLevel={3}>
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
    </Section>
)
