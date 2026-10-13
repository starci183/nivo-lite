import { DescriptionList, Meter, SectionHeader, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/leaves/AccountingBlock"
import { AccountingSectionHead } from "@/components/branches/AccountingSectionHead"
import { MEASURE_META_CLASS_NAME, PANEL_CLASS_NAME, WEEKS_CLASS_NAME } from "./classNames"

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
        readonly trendTitle: string
        readonly trendIntro: string
        readonly trendSource: string
        readonly weekMax: number
        readonly weeks: ReadonlyArray<AccountingOverviewWeek>
    }
    readonly on: {
        readonly selectPeriod: (key: string) => void
    }
}

/** The lines under one figure. */
interface MeasureMetaProps {
    readonly hint: string
    readonly lines: ReadonlyArray<string>
    readonly actionLabel: string | null
    readonly actionHref: string | null
}

/** The lines under one figure: what it counts, the live and simulated parts (never added) and where it comes from. */
const MeasureMeta = (props: MeasureMetaProps) => (
    <div className={MEASURE_META_CLASS_NAME}>
        <Text size="xs" tone="muted">
            {props.hint}
        </Text>
        {props.lines.map((line) => (
            <Text key={line} size="xs" tone="muted">
                {line}
            </Text>
        ))}
        {props.actionLabel !== null && props.actionHref !== null ? (
            <TextAction size="xs" href={props.actionHref}>
                {props.actionLabel}
            </TextAction>
        ) : null}
    </div>
)

/** Period selector, four honest measures and the weekly trend. */
export const AccountingOverview = (props: AccountingOverviewProps) => (
    <div className={PANEL_CLASS_NAME}>
        <AccountingSectionHead
            title={props.props.title}
            intro={props.props.intro}
            choiceLabel={props.props.periodLabel}
            choices={props.props.periodItems}
            selectedChoice={props.props.selectedPeriod}
            onChoose={props.on.selectPeriod}
        >
            <SurfaceCard ariaLabel={props.props.title}>
                <DescriptionList
                    layout="stat-strip"
                    isDivided
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
                            />
                        ),
                    }))}
                />
            </SurfaceCard>
            {props.props.excludedNote === null ? null : (
                <Text size="xs" tone="muted">
                    {props.props.excludedNote}
                </Text>
            )}
        </AccountingSectionHead>
        <AccountingBlock label={props.props.trendTitle}>
            <SectionHeader level={2} title={props.props.trendTitle} description={props.props.trendIntro} />
            <SurfaceCard ariaLabel={props.props.trendTitle}>
                <div className={WEEKS_CLASS_NAME}>
                    {props.props.weeks.map((week) => (
                        <Meter
                            key={week.id}
                            label={week.label}
                            value={week.total}
                            maxValue={props.props.weekMax}
                            valueLabel={week.reading}
                        />
                    ))}
                </div>
            </SurfaceCard>
            <Text size="xs" tone="muted">
                {props.props.trendSource}
            </Text>
        </AccountingBlock>
    </div>
)

/** The settled atoms of the AccountingOverview surface. */
export type AccountingOverviewView = AccountingOverviewProps["props"]
