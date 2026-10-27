import { EmptyNotice, ListRow, Meter, SectionHeader, SurfaceListCard } from "@starci/grammar/common"
import { ContentMonthBar } from "@/components/leaves/ContentMonthBar"
import type { ContentT } from "@/modules/types"
import { PANEL_CLASS_NAME } from "./classNames"

/** One meter row of the balance. */
export interface BalanceMeter {
    readonly id: string
    readonly label: string
    /** The meter value. */
    readonly value: number
    /** The meter maximum. */
    readonly max: number
    /** The words beside the meter. */
    readonly valueLabel: string
    /** The sentence about the share the weight asks for, when there is one. */
    readonly target: string | undefined
}

/** What the balance panel draws. */
export interface ContentBalancePanelBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly y: number
        readonly m: number
        /** The heading of the theme balance, with its month. */
        readonly title: string
        /** The title of the month, already formatted. */
        readonly monthTitle: string
        readonly themes: ReadonlyArray<BalanceMeter>
        readonly channels: ReadonlyArray<BalanceMeter>
    }
    readonly on: {
        readonly shift: (by: number) => void
        readonly today: () => void
    }
}

/**
 * Draws the theme balance of the month: a meter per theme (the share the weight asks for is written beside it), then the posting rhythm
 * check. Grammar gap: Meter has no target marker, so the target share is stated in words instead of drawn as a tick.
 */
export const ContentBalancePanelBase = (props: ContentBalancePanelBaseProps) => {
    const { t } = props.props
    return (
        <div className={PANEL_CLASS_NAME}>
            <ContentMonthBar title={props.props.monthTitle} t={t} onShift={props.on.shift} onToday={props.on.today} />
            <SectionHeader level={2} title={props.props.title} description={t("balanceBody")} />
            <SurfaceListCard ariaLabel={t("balanceTitle")} empty={<EmptyNotice message={t("balanceEmpty")} />}>
                {props.props.themes.map((row) => (
                    <ListRow
                        key={row.id}
                        title={
                            <Meter label={row.label} value={row.value} maxValue={row.max} valueLabel={row.valueLabel} />
                        }
                        description={row.target}
                    />
                ))}
            </SurfaceListCard>
            {props.props.channels.length > 0 ? (
                <>
                    <SectionHeader level={2} title={t("cadenceTitle")} description={t("cadenceBody")} />
                    <SurfaceListCard ariaLabel={t("cadenceTitle")}>
                        {props.props.channels.map((row) => (
                            <ListRow
                                key={row.id}
                                title={
                                    <Meter
                                        label={row.label}
                                        value={row.value}
                                        maxValue={row.max}
                                        valueLabel={row.valueLabel}
                                    />
                                }
                            />
                        ))}
                    </SurfaceListCard>
                </>
            ) : null}
        </div>
    )
}
