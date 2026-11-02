import { Badge, DescriptionList, Meter, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { CreditsOverviewView } from "@/hooks/credits"

interface CreditsBalanceProps {
    readonly props: {
        readonly balance: CreditsOverviewView["balance"]
        readonly label: string
        readonly isLoading: boolean
    }
}

/** Draws the settled credit balance, allowance and forecast. */
export const CreditsBalance = (props: CreditsBalanceProps) => {
    const { balance, label, isLoading } = props.props
    return (
        <SurfaceCard
            label={label}
            headingLevel={2}
            kind="bands"
            isLoading={isLoading}
            bands={[
                { kind: "figures", items: [{ id: "balance", term: label, value: balance.figure }] },
                {
                    kind: "body",
                    children: (
                        <Stack gap="row">
                            {balance.badge ? (
                                <Badge tone={balance.badgeTone} isLoading={isLoading}>
                                    {balance.badge}
                                </Badge>
                            ) : null}
                            {balance.limit !== null || isLoading ? (
                                <Meter
                                    label={balance.meterLabel}
                                    value={Math.min(balance.used, balance.limit ?? 1)}
                                    minValue={0}
                                    maxValue={Math.max(balance.limit ?? 1, 1)}
                                    valueLabel={balance.meterValue}
                                    isLoading={isLoading}
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
                                        <Text isStrong isLoading={isLoading}>
                                            {item.value}
                                        </Text>
                                    ),
                                }))}
                            />
                        </Stack>
                    ),
                },
            ]}
        />
    )
}
