import type { LoyaltyViews, LoyaltyActions } from "@/modules/types"
import { DescriptionList, EmptyNotice, Input, Meter, SurfaceCard, Text, Grid, Stack } from "@starci/grammar/common"

/** What the loyalty board read answers, worded and ready to draw. */
type LoyaltyOverviewData = LoyaltyViews["overview"]
type LoyaltyOverviewActions = LoyaltyActions["overview"]

interface LoyaltyOverviewProps extends LoyaltyOverviewData {
    readonly on: LoyaltyOverviewActions
    readonly isLoading: boolean
    readonly isSyncing: boolean
}

/** The overview drawn from one answer of the board read, or from its placeholder in skeleton. */
export const LoyaltyOverview = (props: LoyaltyOverviewProps) => {
    const { on, isLoading, ...view } = props
    return (
        <>
            {view.empty === undefined ? null : (
                <SurfaceCard isLoading={isLoading} ariaLabel={view.empty.title}>
                    {view.empty.syncLabel === undefined ? (
                        <EmptyNotice message={view.empty.title} description={view.empty.body} />
                    ) : (
                        <EmptyNotice
                            message={view.empty.title}
                            description={view.empty.body}
                            actionLabel={view.empty.syncLabel}
                            isActionPending={props.isSyncing}
                            onAction={on.sync}
                        />
                    )}
                </SurfaceCard>
            )}
            <Grid kind="sections">
                <SurfaceCard isLoading={isLoading} label={view.tiers.title} headingLevel={2}>
                    <Stack gap="row">
                        <Text size="sm" tone="muted" isLoading={isLoading}>
                            {view.tiers.body}
                        </Text>
                        {view.tiers.rows.map((row) => (
                            <Meter
                                key={row.key}
                                label={row.label}
                                value={row.value}
                                maxValue={row.max}
                                valueLabel={row.valueLabel}
                                isLoading={isLoading}
                            />
                        ))}
                    </Stack>
                </SurfaceCard>
                <SurfaceCard isLoading={isLoading} label={view.stats.title} headingLevel={2}>
                    <DescriptionList
                        isLoading={isLoading}
                        layout="columns"
                        isDivided
                        items={view.stats.items.map((item) => ({
                            id: item.id,
                            term: item.term,
                            description: <Text isLoading={isLoading}>{item.description}</Text>,
                        }))}
                    />
                </SurfaceCard>
            </Grid>
            <SurfaceCard isLoading={isLoading} label={view.link.title} headingLevel={2}>
                <Stack gap="row">
                    <Text size="sm" tone="muted" isLoading={isLoading}>
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
                        onCopy={on.copied}
                        isLoading={isLoading}
                    />
                    <Text size="xs" tone="muted" live="polite" isLoading={isLoading}>
                        {view.link.note}
                    </Text>
                </Stack>
            </SurfaceCard>
        </>
    )
}
