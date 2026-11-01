import { DescriptionList, Meter, SectionHeader, Stack, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/leaves/AccountingBlock"
import { AccountingSectionHead } from "@/components/branches/AccountingSectionHead"

/** One figure of the strip: label, value, what it counts, the lines that say where it comes from and an optional action. */
interface AccountingOverviewMeasure {
    readonly id: string
    readonly term: string
    readonly value: string
    readonly hint: string
    readonly lines: ReadonlyArray<string>
    readonly actionLabel: string | null
    readonly actionHref: string | null
}

/** One week of paid income. */
interface AccountingOverviewWeek {
    readonly id: string
    readonly label: string
    readonly total: number
    readonly reading: string
}

/** One ageing bucket: the money owed at that age, with the judgement of how late it is. */
interface AccountingOverviewAgeing {
    readonly id: string
    readonly label: string
    readonly total: number
    readonly reading: string
    readonly tone: "neutral" | "cautionary" | "negative"
}

/** The resolved words and figures of the Period overview. */
interface AccountingOverviewProps {
    readonly props: {
        readonly title: string
        readonly intro: string
        readonly periodLabel: string
        readonly periodItems: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly selectedPeriod: string
        readonly measures: ReadonlyArray<AccountingOverviewMeasure>
        readonly excludedNote: string | null
        readonly ageingTitle: string
        readonly ageingIntro: string
        readonly ageingMax: number
        readonly ageing: ReadonlyArray<AccountingOverviewAgeing>
        readonly trendTitle: string
        readonly trendIntro: string
        readonly trendSource: string
        readonly weekMax: number
        readonly weeks: ReadonlyArray<AccountingOverviewWeek>
    }
    readonly on: {
        readonly selectPeriod: (key: string) => void
    }
    /** The panel is drawn from placeholders: its leaves draw as skeleton. */
    readonly isSkeleton: boolean
}

/** The lines under one figure. */
interface MeasureMetaProps {
    readonly isSkeleton: boolean
    readonly hint: string
    readonly lines: ReadonlyArray<string>
    readonly actionLabel: string | null
    readonly actionHref: string | null
}

/** The lines under one figure: what it counts and where it comes from. */
const MeasureMeta = (props: MeasureMetaProps) => (
    <Stack gap="identity">
        <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
            {props.hint}
        </Text>
        {props.lines.map((line) => (
            <Text key={line} size="xs" tone="muted" isSkeleton={props.isSkeleton}>
                {line}
            </Text>
        ))}
        {props.actionLabel !== null && props.actionHref !== null ? (
            <TextAction size="xs" href={props.actionHref} isSkeleton={props.isSkeleton}>
                {props.actionLabel}
            </TextAction>
        ) : null}
    </Stack>
)

/** A titled card of gauges, one per row, with an optional line saying where the figures come from. */
interface MeterBlockProps {
    readonly title: string
    readonly intro: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly total: number
        readonly reading: string
        readonly tone?: AccountingOverviewAgeing["tone"]
    }>
    readonly max: number
    readonly source?: string
    readonly isSkeleton: boolean
}

/** One region of gauges: the ageing buckets or the weeks of income. */
const MeterBlock = (props: MeterBlockProps) => (
    <AccountingBlock label={props.title}>
        <SectionHeader level={2} title={props.title} description={props.intro} isSkeleton={props.isSkeleton} />
        <SurfaceCard ariaLabel={props.title}>
            <Stack gap="section">
                {props.rows.map((row) => (
                    <Meter
                        key={row.id}
                        label={row.label}
                        value={row.total}
                        maxValue={props.max}
                        valueLabel={row.reading}
                        {...(row.tone === undefined ? {} : { tone: row.tone })}
                        isSkeleton={props.isSkeleton}
                    />
                ))}
            </Stack>
        </SurfaceCard>
        {props.source === undefined ? null : (
            <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
                {props.source}
            </Text>
        )}
    </AccountingBlock>
)

/** Period selector, four honest measures, the receivable ageing and the weekly trend. */
export const AccountingOverview = (props: AccountingOverviewProps) => {
    const isSkeleton = props.isSkeleton
    return (
        <Stack gap="section">
            <AccountingSectionHead
                title={props.props.title}
                intro={props.props.intro}
                choiceLabel={props.props.periodLabel}
                choices={props.props.periodItems}
                selectedChoice={props.props.selectedPeriod}
                onChoose={props.on.selectPeriod}
                isSkeleton={isSkeleton}
            >
                <SurfaceCard ariaLabel={props.props.title}>
                    <DescriptionList
                        layout="stat-strip"
                        isDivided
                        isLoading={isSkeleton}
                        items={props.props.measures.map((measure) => ({
                            id: measure.id,
                            term: measure.term,
                            description: measure.value,
                            meta: (
                                <MeasureMeta
                                    hint={measure.hint}
                                    lines={measure.lines}
                                    actionLabel={measure.actionLabel}
                                    actionHref={measure.actionHref}
                                    isSkeleton={isSkeleton}
                                />
                            ),
                        }))}
                    />
                </SurfaceCard>
                {props.props.excludedNote === null ? null : (
                    <Text size="xs" tone="muted" isSkeleton={isSkeleton}>
                        {props.props.excludedNote}
                    </Text>
                )}
            </AccountingSectionHead>
            <MeterBlock
                title={props.props.ageingTitle}
                intro={props.props.ageingIntro}
                rows={props.props.ageing}
                max={props.props.ageingMax}
                isSkeleton={isSkeleton}
            />
            <MeterBlock
                title={props.props.trendTitle}
                intro={props.props.trendIntro}
                rows={props.props.weeks}
                max={props.props.weekMax}
                source={props.props.trendSource}
                isSkeleton={isSkeleton}
            />
        </Stack>
    )
}

/** The settled atoms of the AccountingOverview surface. */
export type AccountingOverviewView = AccountingOverviewProps["props"]

/** What the overview does, handed in by its panel. */
export type AccountingOverviewOn = AccountingOverviewProps["on"]
