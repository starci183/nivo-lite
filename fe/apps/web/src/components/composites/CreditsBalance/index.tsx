import { Badge, DescriptionList, Meter, SurfaceCard, Text } from "@starci/grammar/common"
import type { CreditsOverviewView } from "@/hooks/credits"
import { STACK_CLASS_NAME, FIGURE_CLASS_NAME } from "./classNames"

interface CreditsBalanceProps {
    readonly props: {
        readonly balance: CreditsOverviewView["balance"]
        readonly label: string
        readonly isSkeleton: boolean
    }
}

/** Draws the settled credit balance, allowance and forecast. */
export const CreditsBalance = (props: CreditsBalanceProps) => {
    const { balance, label, isSkeleton } = props.props
    return (
        <SurfaceCard label={label} headingLevel={2}>
            <div className={STACK_CLASS_NAME}>
                <div className={FIGURE_CLASS_NAME}>
                    <Text size="metric-lead" weight="semibold" isSkeleton={isSkeleton}>
                        {balance.figure}
                    </Text>
                    {balance.badge ? <Badge tone={balance.badgeTone}>{balance.badge}</Badge> : null}
                </div>
                {balance.limit !== null || isSkeleton ? (
                    <Meter
                        label={balance.meterLabel}
                        value={Math.min(balance.used, balance.limit ?? 1)}
                        minValue={0}
                        maxValue={Math.max(balance.limit ?? 1, 1)}
                        valueLabel={balance.meterValue}
                        isSkeleton={isSkeleton}
                        tone="neutral"
                    />
                ) : null}
                <DescriptionList
                    layout="columns"
                    isDivided
                    items={balance.details.map((item) => ({
                        id: item.id,
                        term: item.term,
                        description: (
                            <Text weight="semibold" isSkeleton={isSkeleton}>
                                {item.value}
                            </Text>
                        ),
                    }))}
                />
            </div>
        </SurfaceCard>
    )
}
