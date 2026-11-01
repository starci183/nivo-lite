import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    Badge,
    Button,
    EmptyNotice,
    ListRow,
    SurfaceCard,
    SurfaceListCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { FORM_CLASS_NAME, QUOTE_CLASS_NAME, ROW_ACTIONS_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames"

/** One decision waiting for a person. */
export interface LoyaltyPendingRow {
    readonly id: string
    readonly actionLabel: string
    readonly age: string
    readonly customer: string
    readonly summary: string
    readonly reason: string
    readonly value: string
    readonly draft: string
    readonly canAct: boolean
    readonly canEditDraft: boolean
    readonly isEditing: boolean
    readonly isApproving: boolean
    readonly isRejecting: boolean
}

/** What the pending decisions list draws once the board read is in. */
export interface LoyaltyPendingView {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly draftLabel: string
    readonly draftHint: string
    readonly waitingManager: string
    readonly approve: string
    readonly reject: string
    readonly edit: string
    readonly editDone: string
    readonly rows: ReadonlyArray<LoyaltyPendingRow>
    readonly isPending: boolean
}

/** Props for {@link LoyaltyPendingBase}: the board read as a slot, its same-shape placeholder and the words of its status. */
export interface LoyaltyPendingBaseProps {
    readonly props: {
        readonly slot: DataSlot<LoyaltyPendingView>
        readonly placeholder: LoyaltyPendingView
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly approve: (id: string) => void
        readonly reject: (id: string) => void
        readonly toggleEdit: (id: string) => void
        readonly setDraft: (id: string, value: string) => void
        readonly retry: () => void
    }
}

/** Draws the loyalty decisions waiting for a person: approve or reject each, and edit the text of an offer before approving it. */
const LoyaltyPendingBody = (props: LoyaltyPendingBodyProps) => {
    const { label, emptyTitle, emptyBody, isPending } = props.props
    return (
        <SurfaceListCard
            ariaLabel={label}
            isLoading={props.isSkeleton}
            empty={<EmptyNotice message={emptyTitle} description={emptyBody} />}
        >
            {props.props.rows.map((row) => (
                <ListRow
                    key={row.id}
                    title={row.customer === "" ? row.actionLabel : row.customer}
                    description={row.age}
                    badges={
                        row.customer === "" ? null : (
                            <Badge tone="warning" isDot>
                                {row.actionLabel}
                            </Badge>
                        )
                    }
                    actions={
                        row.canAct ? (
                            <div className={ROW_ACTIONS_CLASS_NAME}>
                                <Button
                                    intent="alternative"
                                    size="sm"
                                    isPending={row.isApproving}
                                    isDisabled={isPending}
                                    onPress={() => props.on.approve(row.id)}
                                >
                                    {props.props.approve}
                                </Button>
                                {row.canEditDraft ? (
                                    <Button
                                        intent="neutral"
                                        size="sm"
                                        isDisabled={isPending}
                                        onPress={() => props.on.toggleEdit(row.id)}
                                    >
                                        {row.isEditing ? props.props.editDone : props.props.edit}
                                    </Button>
                                ) : null}
                                <Button
                                    intent="destructive"
                                    step="entry"
                                    size="sm"
                                    isPending={row.isRejecting}
                                    isDisabled={isPending}
                                    onPress={() => props.on.reject(row.id)}
                                >
                                    {props.props.reject}
                                </Button>
                            </div>
                        ) : null
                    }
                >
                    {renderPendingDraft({ row, props, isPending })}
                </ListRow>
            ))}
        </SurfaceListCard>
    )
}

/** Inputs needed to build the RowMain section. */
interface RenderPendingDraftContext {
    readonly row: LoyaltyPendingRow
    readonly props: LoyaltyPendingBodyProps
    readonly isPending: LoyaltyPendingView["isPending"]
}
/** Builds the RowMain section from the current view. */
const renderPendingDraft = ({ row, props, isPending }: RenderPendingDraftContext) => (
    <div className={ROW_MAIN_CLASS_NAME}>
        {row.summary === "" ? null : <Text size="sm">{row.summary}</Text>}
        {row.reason === "" ? null : (
            <Text size="xs" tone="muted">
                {row.reason}
            </Text>
        )}
        {row.value === "" ? null : (
            <Text size="sm" weight="semibold">
                {row.value}
            </Text>
        )}
        {row.draft !== "" && !row.isEditing ? (
            <SurfaceCard label={props.props.draftLabel} headingLevel={4}>
                <div className={QUOTE_CLASS_NAME}>
                    <Text as="p" size="sm">
                        {row.draft}
                    </Text>
                </div>
            </SurfaceCard>
        ) : null}
        {row.canAct && row.isEditing && row.canEditDraft ? (
            <div className={FORM_CLASS_NAME}>
                <Textarea
                    label={props.props.draftLabel}
                    description={props.props.draftHint}
                    rows={5}
                    value={row.draft}
                    isDisabled={isPending}
                    onValueChange={(value) => props.on.setDraft(row.id, value)}
                />
            </div>
        ) : null}
        {row.canAct ? null : (
            <Text size="sm" weight="medium">
                {props.props.waitingManager}
            </Text>
        )}
    </div>
)

/** The drawn tab: its view, its commands and whether it is the placeholder drawn while the board read is on its way. */
interface LoyaltyPendingBodyProps {
    readonly props: LoyaltyPendingView
    readonly on: LoyaltyPendingBaseProps["on"]
    readonly isSkeleton: boolean
}

/** Draws the tab through SlotView: the same tree as a placeholder while the board read is on its way, the notice when it failed. */
export const LoyaltyPendingBase = (props: LoyaltyPendingBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => <LoyaltyPendingBody props={view} on={props.on} isSkeleton={isSkeleton} />}
    </SlotView>
)
