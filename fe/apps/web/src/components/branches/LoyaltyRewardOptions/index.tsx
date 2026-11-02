import type { LoyaltyViews, LoyaltyActions } from "@/modules/types"
import { Button, EmptyNotice, Section, Stack, Text } from "@starci/grammar/common"

/** What the list of rewards a member can redeem draws and reports. */
type MemberRewardsData = LoyaltyViews["memberRewards"]
/** The existing native presentation contract, with pure fields and actions owned separately. */
interface LoyaltyRewardOptionsProps extends MemberRewardsData {
    readonly isLoading: boolean
    readonly onRedeem: LoyaltyActions["member"]["redeem"]
}

/** The rewards of the programme for one member: the cost, why one cannot be redeemed yet, or the button that redeems it. */
export const LoyaltyRewardOptions = (props: LoyaltyRewardOptionsProps) => (
    <Section
        kind="list"
        title={props.title}
        headingLevel={3}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.emptyText} />}
        items={props.rows.map((row) => ({
            id: row.id,
            title: row.name,
            description: row.cost,
            detail: (
                <Stack gap="identity">
                    {row.blocked === undefined ? (
                        <Button
                            intent="neutral"
                            size="sm"
                            isPending={props.busyId === row.id}
                            isLoading={props.isLoading}
                            isDisabled={props.busyId !== null}
                            onPress={() => props.onRedeem(row.id)}
                        >
                            {props.redeemLabel}
                        </Button>
                    ) : null}
                    {row.blocked === undefined ? null : <Text size="sm">{row.blocked}</Text>}
                    {row.note === undefined ? null : (
                        <Text size="sm" isStrong live="polite">
                            {row.note}
                        </Text>
                    )}
                </Stack>
            ),
        }))}
    />
)
