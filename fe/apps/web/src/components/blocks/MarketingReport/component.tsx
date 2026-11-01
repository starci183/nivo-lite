import { Alert, Button, DescriptionList, Meter, SectionHeader, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, MarketingReportView, SlotLabels } from "@/modules/types"

/** The words of the Performance tab. */
export interface MarketingReportWords {
    readonly title: string
    readonly description: string
    readonly chartTitle: string
    readonly chartNote: string
    readonly channelsTitle: string
    readonly insightTitle: string
    readonly postsTitle: string
    readonly suggestionTitle: string
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

/** The parts of the report a section draws. */
interface SectionProps {
    readonly words: MarketingReportWords
    readonly view: MarketingReportView
}

/** The AI Marketing suggestion for the next week with the sources it read; nothing without one. */
const Suggestion = ({ words, view }: SectionProps) =>
    view.suggestion === null ? null : (
        <SurfaceCard label={words.suggestionTitle}>
            <Stack gap="section">
                <Text weight="semibold">{view.suggestion.title}</Text>
                <Text size="sm">{view.suggestion.body}</Text>
                <Text size="xs" tone="muted">
                    {view.suggestion.sources}
                </Text>
            </Stack>
        </SurfaceCard>
    )

/** The most engaging posts of the week; nothing without posts. */
const TopPosts = ({ words, view }: SectionProps) =>
    view.posts.length === 0 ? null : (
        <SurfaceCard label={words.postsTitle}>
            <Stack gap="section">
                <DescriptionList layout="columns" isDivided items={view.posts} />
                <Text size="xs" tone="muted">
                    {view.postsNote}
                </Text>
            </Stack>
        </SurfaceCard>
    )

const Report = (props: ReportProps) => {
    const { words } = props.props
    const { view, isSkeleton } = props
    return (
        <Stack gap="region">
            <SectionHeader
                level={2}
                title={words.title}
                description={view.period === "" ? words.description : `${words.description} · ${view.period}`}
                isSkeleton={isSkeleton}
                action={
                    props.props.canPost ? (
                        <Button
                            intent="commit"
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
                <Stack gap="section">
                    <Text size="sm" tone="muted">
                        {words.chartNote}
                    </Text>
                    <Stack gap="row">
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
                    </Stack>
                </Stack>
            </SurfaceCard>
            {view.channels.length === 0 ? null : (
                <SurfaceCard label={words.channelsTitle}>
                    <DescriptionList layout="columns" isDivided items={view.channels} />
                </SurfaceCard>
            )}
            {view.insight === "" ? null : (
                <Alert tone="informative" title={words.insightTitle} description={view.insight} />
            )}
            <Suggestion words={words} view={view} />
            <TopPosts words={words} view={view} />
            {props.props.canPost ? (
                <Text size="xs" tone="muted">
                    {words.postHint}
                </Text>
            ) : null}
        </Stack>
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
