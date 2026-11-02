import type { LoyaltyViews, LoyaltyActions } from "@/modules/types"
import type { ListRowData } from "@starci/grammar/common"
import { AlertDialog, Button, Cluster, EmptyNotice, Stack, Switch, SurfaceCard, Text } from "@starci/grammar/common"
import { LoyaltyRewardForm } from "@/components/composites/LoyaltyRewardForm"

/** One reward of the catalogue as the list draws it. */
type RewardRowView = LoyaltyViews["rewards"]["rows"][number]

/** What the reward catalogue draws once the board read is in. */
type LoyaltyRewardsView = LoyaltyViews["rewards"]
type LoyaltyRewardsActions = LoyaltyActions["rewards"]

/** Draws the reward catalogue: the list with its row actions for managers, and the add or edit form under it. */
export const LoyaltyRewards = (props: LoyaltyRewardsProps) => {
    const { on, ...p } = props
    return (
        <>
            {
                <SurfaceCard
                    kind="list"
                    isLoading={props.isLoading}
                    label={p.title}
                    headingLevel={2}
                    labelEnd={
                        p.canManage && p.form === undefined ? (
                            <Button intent="commit" size="sm" onPress={on.add}>
                                {p.addLabel}
                            </Button>
                        ) : undefined
                    }
                    empty={
                        p.canManage ? (
                            <EmptyNotice
                                message={p.emptyTitle}
                                description={p.emptyBody}
                                actionLabel={p.presetLabel}
                                isActionPending={p.isPending}
                                onAction={on.preset}
                            />
                        ) : (
                            <EmptyNotice message={p.emptyTitle} description={p.emptyBody} />
                        )
                    }
                    footer={
                        p.canManage ? undefined : (
                            <Text size="xs" tone="muted">
                                {p.readOnlyNote}
                            </Text>
                        )
                    }
                    items={p.rows.map((row) => rewardRowOf({ row, p, on }))}
                />
            }
            {p.canManage && p.form !== undefined ? (
                <SurfaceCard label={p.form.heading} headingLevel={2}>
                    <LoyaltyRewardForm
                        isLoading={props.isLoading}
                        {...p.form}
                        onChange={on.change}
                        onActive={on.setActive}
                        onSubmit={on.submit}
                        onCancel={on.cancelForm}
                    />
                </SurfaceCard>
            ) : null}
        </>
    )
}

/** Inputs needed to build the Row section. */
interface RenderRewardRowContext {
    readonly row: RewardRowView
    readonly p: LoyaltyRewardsView
    readonly on: LoyaltyRewardsProps["on"]
}
/** Builds the Row section from the current view. */
const rewardRowOf = ({ row, p, on }: RenderRewardRowContext): ListRowData => ({
    id: row.id,
    title: row.name,
    description: row.cost,
    badges: [
        { label: row.kindLabel, tone: "neutral" },
        { label: row.statusLabel, tone: row.active ? "success" : "warning" },
    ],
    detail: (
        <Stack gap="row">
            <Text size="sm" tone="muted">
                {row.facts}
            </Text>
            {row.note === "" ? null : (
                <Text size="xs" tone="muted">
                    {row.note}
                </Text>
            )}
            {p.canManage ? (
                <Cluster gap="inline">
                    <Switch
                        label={p.activeLabel}
                        isSelected={row.active}
                        isDisabled={p.isPending}
                        onSelectedChange={(active) => on.toggle(row.id, active)}
                    />
                    <Button intent="neutral" isDisabled={p.isPending} onPress={() => on.edit(row.id)}>
                        {p.editLabel}
                    </Button>
                    <AlertDialog
                        title={p.deleteLabel}
                        description={p.askLabel}
                        confirmLabel={p.confirmLabel}
                        cancelLabel={p.cancelLabel}
                        onConfirm={() => on.confirmRemove(row.id)}
                        isConfirmPending={p.isPending}
                        trigger={
                            <Button intent="destructive" step="entry" size="sm" isDisabled={p.isPending}>
                                {p.deleteLabel}
                            </Button>
                        }
                    />
                </Cluster>
            ) : null}
        </Stack>
    ),
})
interface LoyaltyRewardsProps extends LoyaltyRewardsView {
    readonly on: LoyaltyRewardsActions
    readonly isLoading: boolean
}
