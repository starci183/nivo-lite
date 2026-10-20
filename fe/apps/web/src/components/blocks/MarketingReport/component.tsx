import { Alert, Button, DescriptionList, Meter, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { MarketingReportView } from "@/hooks/content"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { BODY, DAYS, STACK } from "./classNames"

/** The words of the Performance tab. */
export interface MarketingReportWords {
    readonly title: string
    readonly description: string
    readonly chartTitle: string
    readonly chartNote: string
    readonly channelsTitle: string
    readonly insightTitle: string
    readonly postLabel: string
    readonly postHint: string
}

/** The report as a slot, its words, and the command that posts it into the Hub. */
export interface MarketingReportBaseProps {
    readonly props: {
        readonly slot: DataSlot<MarketingReportView>
        readonly placeholder: MarketingReportView
        readonly slotLabels: SlotLabels
        readonly words: MarketingReportWords
        readonly isPosting: boolean
        readonly canPost: boolean
    }
    readonly on: { readonly post: () => void; readonly retry: () => void }
}

/** The ready (or skeleton) report with the commands of the tab. */
type ReportProps = MarketingReportBaseProps & { readonly view: MarketingReportView; readonly isSkeleton: boolean }

const Report = (props: ReportProps) => {
    const { words } = props.props
    const { view, isSkeleton } = props
    return (
        <div className={STACK}>
            <SectionHeader
                level={2}
                title={words.title}
                description={isSkeleton ? words.description : `${words.description} · ${view.period}`}
                isSkeleton={isSkeleton}
                action={
                    props.props.canPost ? (
                        <Button
                            variant="primary"
                            isPending={props.props.isPosting}
                            isDisabled={isSkeleton}
                            onPress={props.on.post}
                        >
                            {words.postLabel}
                        </Button>
                    ) : undefined
                }
            />
            <DescriptionList layout="stat-strip" isDivided isLoading={isSkeleton} items={view.kpis} />
            <SurfaceCard label={words.chartTitle}>
                <div className={BODY}>
                    <Text size="sm" tone="muted">
                        {words.chartNote}
                    </Text>
                    <div className={DAYS}>
                        {view.days.map((day) => (
                            <Meter
                                key={day.id}
                                label={day.label || words.chartTitle}
                                value={day.total}
                                maxValue={view.dayMax}
                                valueLabel={
                                    day.breakdown === "" ? String(day.total) : `${day.total} · ${day.breakdown}`
                                }
                                isSkeleton={isSkeleton}
                            />
                        ))}
                    </div>
                </div>
            </SurfaceCard>
            {view.channels.length === 0 ? null : (
                <SurfaceCard label={words.channelsTitle}>
                    <div className={BODY}>
                        <DescriptionList layout="columns" isDivided items={view.channels} />
                    </div>
                </SurfaceCard>
            )}
            {view.insight === "" ? null : (
                <Alert tone="informative" title={words.insightTitle} description={view.insight} />
            )}
            {props.props.canPost ? (
                <Text size="xs" tone="muted">
                    {words.postHint}
                </Text>
            ) : null}
        </div>
    )
}

/** Draws the Performance tab of the AI Marketing agent: the key figures of the week, engagements per day and channel, what the
 * week says, and the command that posts the report as a card in the Marketing room of the Hub. */
export const MarketingReportBase = (props: MarketingReportBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => <Report {...props} view={view} isSkeleton={isSkeleton} />}
    </SlotView>
)
