import type { ContentViews, ContentActions } from "@/modules/types"

type ContentBalanceViewProps = ContentViews["balanceFields"] & {
    readonly on: ContentActions["balanceActions"]
    readonly isLoading: boolean
}
import { EmptyNotice, Meter, Stack, Text, SurfaceCard } from "@starci/grammar/common"
import { ContentMonthBar } from "@/components/leaves/ContentMonthBar"

/**
 * Draws the theme balance of the month: a meter per theme (the share the weight asks for is written beside it), then the posting rhythm
 * check. Grammar gap: Meter has no target marker, so the target share is stated in words instead of drawn as a tick.
 */
export const ContentBalanceView = (props: ContentBalanceViewProps) => {
    const { copy } = props
    return (
        <Stack gap="row">
            <ContentMonthBar
                isLoading={props.isLoading}
                title={props.monthTitle}
                copy={props.copy}
                onShift={props.on.shift}
                onToday={props.on.today}
            />
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                label={props.title}
                headingLevel={2}
                footer={
                    <Text size="sm" tone="muted">
                        {copy.balanceBody}
                    </Text>
                }
                empty={<EmptyNotice message={copy.balanceEmpty} />}
                items={props.themes.map((row) => ({
                    id: row.id,
                    title: row.label,
                    description: [row.valueLabel, row.target].filter((line) => line !== undefined).join(" · "),
                    detail: (
                        <Meter
                            isLoading={props.isLoading}
                            label={row.label}
                            isLabelHidden
                            value={row.value}
                            maxValue={row.max}
                            valueLabel={row.valueLabel}
                        />
                    ),
                }))}
            />
            {props.channels.length > 0 ? (
                <SurfaceCard
                    isLoading={props.isLoading}
                    kind="list"
                    label={copy.cadenceTitle}
                    headingLevel={2}
                    footer={
                        <Text size="sm" tone="muted">
                            {copy.cadenceBody}
                        </Text>
                    }
                    empty={<EmptyNotice message={copy.cadenceTitle} />}
                    items={props.channels.map((row) => ({
                        id: row.id,
                        title: row.label,
                        description: row.valueLabel,
                        detail: (
                            <Meter
                                isLoading={props.isLoading}
                                isLabelHidden
                                label={row.label}
                                value={row.value}
                                maxValue={row.max}
                                valueLabel={row.valueLabel}
                            />
                        ),
                    }))}
                />
            ) : null}
        </Stack>
    )
}
