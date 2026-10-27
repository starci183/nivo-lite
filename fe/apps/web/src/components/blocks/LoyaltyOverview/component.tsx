import { Alert, DescriptionList, EmptyNotice, Input, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { BODY_CLASS_NAME, OVERVIEW_GRID_CLASS_NAME } from "./classNames"

/** What the loyalty board read answers, worded and ready to draw. */
export interface LoyaltyOverviewData {
    readonly empty?: {
        readonly title: string
        readonly body: string
        readonly syncLabel?: string
    }
    readonly tiers: {
        readonly title: string
        readonly body: string
        readonly rows: ReadonlyArray<{
            readonly key: string
            readonly label: string
            readonly value: number
            readonly max: number
            readonly valueLabel: string
        }>
    }
    readonly stats: {
        readonly title: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    }
    readonly link: {
        readonly title: string
        readonly body: string
        readonly url: string
        readonly copyLabel: string
        readonly copiedLabel: string
        readonly note: string
    }
}

/** Copy, figures and interactions the connected overview supplies. */
export interface LoyaltyOverviewBaseProps {
    readonly props: {
        readonly slot: DataSlot<LoyaltyOverviewData>
        readonly slotLabels: SlotLabels
        /** The empty-members sync is in flight: its button is pending. */
        readonly isSyncing: boolean
        readonly syncNote?: { readonly title: string; readonly text: string }
    }
    readonly on: {
        readonly sync: () => void
        readonly copied: () => void
        readonly retry: () => void
    }
}

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const OVERVIEW_PLACEHOLDER: LoyaltyOverviewData = {
    tiers: {
        title: "…",
        body: "…",
        rows: [1, 2, 3].map((n) => ({ key: `placeholder-${n}`, label: "…", value: 0, max: 1, valueLabel: "…" })),
    },
    stats: {
        title: "…",
        items: [1, 2, 3, 4, 5].map((n) => ({ id: `placeholder-${n}`, term: "…", description: "…" })),
    },
    link: { title: "…", body: "…", url: "…", copyLabel: "…", copiedLabel: "…", note: "…" },
}

/** Draws what the programme holds: who is in which tier, the last 30 days, and the public check link. */
export const LoyaltyOverviewBase = (props: LoyaltyOverviewBaseProps) => (
    <>
        <div aria-live="polite">
            {props.props.syncNote === undefined ? null : (
                <Alert title={props.props.syncNote.title} description={props.props.syncNote.text} tone="affirmative" />
            )}
        </div>
        <SlotView
            slot={props.props.slot}
            placeholder={OVERVIEW_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(view, isSkeleton) => <LoyaltyOverviewBody {...props} view={view} isSkeleton={isSkeleton} />}
        </SlotView>
    </>
)

/** What the body draws from: the overview props, one answer of the read and whether it is the placeholder. */
type LoyaltyOverviewBodyProps = LoyaltyOverviewBaseProps & {
    readonly view: LoyaltyOverviewData
    readonly isSkeleton: boolean
}

/** The overview drawn from one answer of the board read, or from its placeholder in skeleton. */
const LoyaltyOverviewBody = (props: LoyaltyOverviewBodyProps) => {
    const { view, isSkeleton } = props
    return (
        <>
            {view.empty === undefined ? null : (
                <SurfaceCard ariaLabel={view.empty.title}>
                    {view.empty.syncLabel === undefined ? (
                        <EmptyNotice message={view.empty.title} description={view.empty.body} />
                    ) : (
                        <EmptyNotice
                            message={view.empty.title}
                            description={view.empty.body}
                            actionLabel={view.empty.syncLabel}
                            actionVariant="primary"
                            isActionPending={props.props.isSyncing}
                            onAction={props.on.sync}
                        />
                    )}
                </SurfaceCard>
            )}
            <div className={OVERVIEW_GRID_CLASS_NAME}>
                <SurfaceCard label={view.tiers.title} headingLevel={2}>
                    <div className={BODY_CLASS_NAME}>
                        <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                            {view.tiers.body}
                        </Text>
                        {view.tiers.rows.map((row) => (
                            <Meter
                                key={row.key}
                                label={row.label}
                                value={row.value}
                                maxValue={row.max}
                                valueLabel={row.valueLabel}
                                isSkeleton={isSkeleton}
                            />
                        ))}
                    </div>
                </SurfaceCard>
                <SurfaceCard label={view.stats.title} headingLevel={2}>
                    <DescriptionList
                        layout="columns"
                        isDivided
                        items={view.stats.items.map((item) => ({
                            id: item.id,
                            term: item.term,
                            description: <Text isSkeleton={isSkeleton}>{item.description}</Text>,
                        }))}
                    />
                </SurfaceCard>
            </div>
            <SurfaceCard label={view.link.title} headingLevel={2}>
                <div className={BODY_CLASS_NAME}>
                    <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                        {view.link.body}
                    </Text>
                    <Input
                        id="loyalty-public-link"
                        name="publicLink"
                        label={view.link.title}
                        value={view.link.url}
                        isReadOnly
                        isCopyable
                        copyLabel={view.link.copyLabel}
                        copiedLabel={view.link.copiedLabel}
                        onCopy={props.on.copied}
                        isSkeleton={isSkeleton}
                    />
                    <Text size="xs" tone="muted" live="polite" isSkeleton={isSkeleton}>
                        {view.link.note}
                    </Text>
                </div>
            </SurfaceCard>
        </>
    )
}
