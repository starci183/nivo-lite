import { Meter, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { AccountingSectionHead } from "@/components/branches/AccountingSectionHead"

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
        readonly excludedNote: string | null
        /** The ageing card names its moment; it is not a period of the selector. */
        readonly ageingTitle: string
        readonly ageingIntro: string
        /** The one line that stands in for the ageing gauges while nothing is owed. */
        readonly ageingEmpty: string
        readonly ageingMax: number
        readonly ageing: ReadonlyArray<AccountingOverviewAgeing>
        /** The weekly card names the period it covers. */
        readonly trendTitle: string
        readonly trendIntro: string
        readonly trendSource: string
        /** The one line that stands in for the weekly gauges while the period has no income. */
        readonly trendEmpty: string
        readonly weekMax: number
        readonly weeks: ReadonlyArray<AccountingOverviewWeek>
    }
    readonly on: {
        readonly selectPeriod: (key: string) => void
    }
    /** The panel is drawn from placeholders: its leaves draw as skeleton. */
    readonly isLoading: boolean
}

/** A titled card of gauges, one per row, with an optional line saying where the figures come from. */
interface MeterBlockProps {
    readonly title: string
    readonly intro: string
    /** The line drawn instead of the card while every gauge would stand at zero. */
    readonly empty: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly total: number
        readonly reading: string
        readonly tone?: AccountingOverviewAgeing["tone"]
    }>
    readonly max: number
    readonly source?: string
    readonly isLoading: boolean
}

/** One region of gauges: the ageing buckets or the weeks of income. With nothing to measure it is one line until there is data. */
const MeterBlock = (props: MeterBlockProps) => {
    if (props.max === 0) {
        return (
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {`${props.title}: ${props.empty}`}
            </Text>
        )
    }
    return (
        <SurfaceCard label={props.title} headingLevel={2}>
            <Stack gap="section">
                <Text size="sm" tone="muted" isLoading={props.isLoading}>
                    {props.intro}
                </Text>
                {props.rows.map((row) => (
                    <Meter
                        key={row.id}
                        label={row.label}
                        value={row.total}
                        maxValue={props.max}
                        valueLabel={row.reading}
                        {...(row.tone === undefined ? {} : { tone: row.tone })}
                        isLoading={props.isLoading}
                    />
                ))}
                {props.source === undefined ? null : (
                    <Text size="xs" tone="muted" isLoading={props.isLoading}>
                        {props.source}
                    </Text>
                )}
            </Stack>
        </SurfaceCard>
    )
}

/**
 * Period selector, the receivable ageing and the weekly trend. The figures of the period (income, receivable, unmatched) are the
 * ribbon above every tab: this tab never draws them a second time.
 */
export const AccountingOverview = (props: AccountingOverviewProps) => {
    const isLoading = props.isLoading
    return (
        <Stack gap="section">
            <AccountingSectionHead
                title={props.props.title}
                intro={props.props.intro}
                choiceLabel={props.props.periodLabel}
                choices={props.props.periodItems}
                selectedChoice={props.props.selectedPeriod}
                onChoose={props.on.selectPeriod}
                isLoading={isLoading}
                body={
                    props.props.excludedNote === null ? null : (
                        <Text size="xs" tone="muted" isLoading={isLoading}>
                            {props.props.excludedNote}
                        </Text>
                    )
                }
            />
            <MeterBlock
                title={props.props.ageingTitle}
                intro={props.props.ageingIntro}
                empty={props.props.ageingEmpty}
                rows={props.props.ageing}
                max={props.props.ageingMax}
                isLoading={isLoading}
            />
            <MeterBlock
                title={props.props.trendTitle}
                intro={props.props.trendIntro}
                empty={props.props.trendEmpty}
                rows={props.props.weeks}
                max={props.props.weekMax}
                source={props.props.trendSource}
                isLoading={isLoading}
            />
        </Stack>
    )
}
