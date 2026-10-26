import {
    AlertDialog,
    Badge,
    Button,
    EmptyNotice,
    ListItem,
    Switch,
    SurfaceCard,
    SurfaceListCard,
    Text,
} from "@starci/grammar/common"
import { LoyaltyRewardForm } from "@/components/composites/LoyaltyRewardForm"
import type { RewardTextField } from "@/hooks/loyaltyRewards"
import type { LoyaltyRewardFormProps } from "@/components/composites/LoyaltyRewardForm"
import { CHIPS_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames"

/** One reward of the catalogue as the list draws it. */
export interface RewardRowView {
    readonly id: string
    readonly name: string
    readonly kindLabel: string
    readonly statusLabel: string
    readonly active: boolean
    readonly cost: string
    readonly facts: string
    readonly note: string
}

/** Props for {@link LoyaltyRewardsBase}. */
export interface LoyaltyRewardsBaseProps {
    readonly props: {
        readonly title: string
        readonly addLabel: string
        readonly canManage: boolean
        readonly isPending: boolean
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly presetLabel: string
        readonly readOnlyNote: string
        readonly activeLabel: string
        readonly editLabel: string
        readonly deleteLabel: string
        readonly askLabel: string
        readonly confirmLabel: string
        readonly cancelLabel: string
        readonly rows: ReadonlyArray<RewardRowView>
        readonly form?: Omit<LoyaltyRewardFormProps, "onChange" | "onActive" | "onSubmit" | "onCancel">
    }
    readonly on: {
        readonly add: () => void
        readonly preset: () => void
        readonly edit: (id: string) => void
        readonly toggle: (id: string, active: boolean) => void
        readonly confirmRemove: (id: string) => void
        readonly change: (field: RewardTextField, value: string) => void
        readonly setActive: (active: boolean) => void
        readonly submit: () => void
        readonly cancelForm: () => void
    }
}

/** Draws the reward catalogue: the list with its row actions for managers, and the add or edit form under it. */
export const LoyaltyRewardsBase = (props: LoyaltyRewardsBaseProps) => {
    const { props: p, on } = props
    return (
        <>
            {
                <SurfaceListCard
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
                                actionVariant="secondary"
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
                >
                    {p.rows.map((row) => renderRewardRow({ row, p, on }))}
                </SurfaceListCard>
            }
            {p.canManage && p.form !== undefined ? (
                <SurfaceCard label={p.form.heading} headingLevel={2}>
                    <LoyaltyRewardForm
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
    readonly p: LoyaltyRewardsBaseProps["props"]
    readonly on: LoyaltyRewardsBaseProps["on"]
}
/** Builds the Row section from the current view. */
const renderRewardRow = ({ row, p, on }: RenderRewardRowContext) => (
    <ListItem key={row.id} className={ROW_CLASS_NAME}>
        <div className={ROW_MAIN_CLASS_NAME}>
            <div className={CHIPS_CLASS_NAME}>
                <Text as="span" weight="semibold">
                    {row.name}
                </Text>
                <Badge tone="neutral">{row.kindLabel}</Badge>
                <Badge tone={row.active ? "success" : "warning"}>{row.statusLabel}</Badge>
            </div>
            <Text size="sm">{row.cost}</Text>
            <Text size="sm" tone="muted">
                {row.facts}
            </Text>
            {row.note === "" ? null : (
                <Text size="xs" tone="muted">
                    {row.note}
                </Text>
            )}
        </div>
        {p.canManage ? (
            <div className={ROW_ACTIONS_CLASS_NAME}>
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
            </div>
        ) : null}
    </ListItem>
)
