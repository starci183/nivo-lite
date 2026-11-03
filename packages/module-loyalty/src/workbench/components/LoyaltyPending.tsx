import type { ReactNode } from "react"
import type { LoyaltyViews, LoyaltyActions } from "../types"
import {
    Button,
    EmptyNotice,
    Quote,
    SurfaceCard,
    Text,
    Textarea,
    type ListRowData,
    Stack,
    Cluster,
} from "@starci/grammar/common"

/** One decision waiting for a person. */
type LoyaltyPendingRow = LoyaltyViews["decisions"]["rows"][number]

/** What the pending decisions list draws once the board read is in. */
type LoyaltyPendingView = LoyaltyViews["decisions"]
type LoyaltyPendingActions = LoyaltyActions["decisions"]

/** Draws the loyalty decisions waiting for a person: approve or reject each, and edit the text of an offer before approving it. */
export const LoyaltyPending = (props: LoyaltyPendingProps): ReactNode => {
    const { label, emptyTitle, emptyBody, isPending } = props
    return (
        <SurfaceCard
            kind="list"
            ariaLabel={label}
            isLoading={props.isLoading}
            items={props.rows.map((row) => pendingItem(props, row, isPending))}
            empty={<EmptyNotice message={emptyTitle} description={emptyBody} />}
        />
    )
}

/** One waiting decision as a row of the list: the decision badge, its commands and the draft it proposes under the row. */
const pendingItem = (props: LoyaltyPendingProps, row: LoyaltyPendingRow, isPending: boolean): ListRowData => ({
    id: row.id,
    title: row.customer === "" ? row.actionLabel : row.customer,
    description: row.age,
    ...(row.customer === ""
        ? {}
        : { badges: [{ label: row.actionLabel, tone: "warning" as const, isDot: true }] as const }),
    detail: (
        <Stack gap="identity">
            {row.canAct ? (
                <Cluster gap="inline">
                    <Button
                        intent="alternative"
                        size="sm"
                        isPending={row.isApproving}
                        isDisabled={isPending}
                        onPress={() => props.on.approve(row.id)}
                    >
                        {props.approve}
                    </Button>
                    {row.canEditDraft ? (
                        <Button
                            intent="neutral"
                            size="sm"
                            isDisabled={isPending}
                            onPress={() => props.on.toggleEdit(row.id)}
                        >
                            {row.isEditing ? props.editDone : props.edit}
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
                        {props.reject}
                    </Button>
                </Cluster>
            ) : null}
            {renderPendingDraft({ row, props, isPending })}
        </Stack>
    ),
})

/** Inputs needed to build the RowMain section. */
interface RenderPendingDraftContext {
    readonly row: LoyaltyPendingRow
    readonly props: LoyaltyPendingProps
    readonly isPending: LoyaltyPendingView["isPending"]
}
/** Builds the row's detail lines: the summary, the offer text as a quote, the draft editor while it is open. */
const renderPendingDraft = ({ row, props, isPending }: RenderPendingDraftContext) => (
    <>
        {row.summary === "" ? null : <Text size="sm">{row.summary}</Text>}
        {row.reason === "" ? null : (
            <Text size="xs" tone="muted">
                {row.reason}
            </Text>
        )}
        {row.value === "" ? null : (
            <Text size="sm" isStrong>
                {row.value}
            </Text>
        )}
        {row.draft !== "" && !row.isEditing ? <Quote source={props.draftLabel} text={row.draft} /> : null}
        {row.canAct && row.isEditing && row.canEditDraft ? (
            <Stack gap="row">
                <Textarea
                    label={props.draftLabel}
                    description={props.draftHint}
                    rows={5}
                    value={row.draft}
                    isDisabled={isPending}
                    onValueChange={(value) => props.on.setDraft(row.id, value)}
                />
            </Stack>
        ) : null}
        {row.canAct ? null : (
            <Text size="sm" isStrong>
                {props.waitingManager}
            </Text>
        )}
    </>
)
interface LoyaltyPendingProps extends LoyaltyPendingView {
    readonly on: LoyaltyPendingActions
    readonly isLoading: boolean
}
