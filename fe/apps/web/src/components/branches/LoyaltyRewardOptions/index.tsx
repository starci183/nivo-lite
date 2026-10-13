import { Button, EmptyNotice, ListItem, SurfaceListCard, Text } from "@starci/grammar/common"
import { ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames"

/** What the list of rewards a member can redeem draws and reports. */
export interface LoyaltyRewardOptionsProps {
    readonly title: string
    readonly emptyText: string
    readonly redeemLabel: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly cost: string
        readonly blocked?: string
        readonly note?: string
    }>
    readonly busyId: string | null
    readonly onRedeem: (id: string) => void
}

/** The rewards of the programme for one member: the cost, why one cannot be redeemed yet, or the button that redeems it. */
export const LoyaltyRewardOptions = (props: LoyaltyRewardOptionsProps) => (
    <SurfaceListCard label={props.title} headingLevel={3} empty={<EmptyNotice message={props.emptyText} />}>
        {props.rows.map((row) => (
            <ListItem key={row.id} className={ROW_CLASS_NAME}>
                <div className={ROW_MAIN_CLASS_NAME}>
                    <Text weight="medium">{row.name}</Text>
                    <Text size="sm" tone="muted">
                        {row.cost}
                    </Text>
                    {row.blocked === undefined ? null : <Text size="sm">{row.blocked}</Text>}
                    {row.note === undefined ? null : (
                        <Text size="sm" weight="medium" live="polite">
                            {row.note}
                        </Text>
                    )}
                </div>
                {row.blocked === undefined ? (
                    <Button
                        variant="primary"
                        size="sm"
                        isPending={props.busyId === row.id}
                        isDisabled={props.busyId !== null}
                        onPress={() => props.onRedeem(row.id)}
                    >
                        {props.redeemLabel}
                    </Button>
                ) : null}
            </ListItem>
        ))}
    </SurfaceListCard>
)
