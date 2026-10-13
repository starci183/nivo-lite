import { Alert, DescriptionList, EmptyNotice, Input, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import { BODY_CLASS_NAME, OVERVIEW_GRID_CLASS_NAME } from "./classNames"

/** Copy, figures and state the connected overview supplies. */
export interface LoyaltyOverviewBaseProps {
    readonly props: {
        readonly empty?: {
            readonly title: string
            readonly body: string
            readonly syncLabel?: string
            readonly isSyncing: boolean
        }
        readonly syncNote?: { readonly title: string; readonly text: string }
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
    readonly on: {
        readonly sync: () => void
        readonly copied: () => void
    }
}

/** Draws what the programme holds: who is in which tier, the last 30 days, and the public check link. */
export const LoyaltyOverviewBase = (props: LoyaltyOverviewBaseProps) => (
    <>
        {props.props.empty === undefined ? null : (
            <SurfaceCard ariaLabel={props.props.empty.title}>
                {props.props.empty.syncLabel === undefined ? (
                    <EmptyNotice message={props.props.empty.title} description={props.props.empty.body} />
                ) : (
                    <EmptyNotice
                        message={props.props.empty.title}
                        description={props.props.empty.body}
                        actionLabel={props.props.empty.syncLabel}
                        actionVariant="primary"
                        isActionPending={props.props.empty.isSyncing}
                        onAction={props.on.sync}
                    />
                )}
            </SurfaceCard>
        )}
        <div aria-live="polite">
            {props.props.syncNote === undefined ? null : (
                <Alert title={props.props.syncNote.title} description={props.props.syncNote.text} tone="affirmative" />
            )}
        </div>
        <div className={OVERVIEW_GRID_CLASS_NAME}>
            <SurfaceCard label={props.props.tiers.title} headingLevel={2}>
                <div className={BODY_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {props.props.tiers.body}
                    </Text>
                    {props.props.tiers.rows.map((row) => (
                        <Meter
                            key={row.key}
                            label={row.label}
                            value={row.value}
                            maxValue={row.max}
                            valueLabel={row.valueLabel}
                        />
                    ))}
                </div>
            </SurfaceCard>
            <SurfaceCard label={props.props.stats.title} headingLevel={2}>
                <DescriptionList layout="columns" isDivided items={[...props.props.stats.items]} />
            </SurfaceCard>
        </div>
        <SurfaceCard label={props.props.link.title} headingLevel={2}>
            <div className={BODY_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {props.props.link.body}
                </Text>
                <Input
                    id="loyalty-public-link"
                    name="publicLink"
                    label={props.props.link.title}
                    variant="secondary"
                    value={props.props.link.url}
                    isReadOnly
                    isCopyable
                    copyLabel={props.props.link.copyLabel}
                    copiedLabel={props.props.link.copiedLabel}
                    onCopy={props.on.copied}
                />
                <Text size="xs" tone="muted" live="polite">
                    {props.props.link.note}
                </Text>
            </div>
        </SurfaceCard>
    </>
)
