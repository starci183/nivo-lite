import { Badge, Button, EmptyNotice, ListItem, SurfaceListCard, Text, Textarea } from "@starci/grammar/common"
import {
    CHIPS_CLASS_NAME,
    FORM_CLASS_NAME,
    QUOTE_CLASS_NAME,
    ROW_ACTIONS_CLASS_NAME,
    ROW_CLASS_NAME,
    ROW_MAIN_CLASS_NAME,
} from "./classNames"

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

/** Props for {@link LoyaltyPendingBase}. */
export interface LoyaltyPendingBaseProps {
    readonly props: {
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
    readonly on: {
        readonly approve: (id: string) => void
        readonly reject: (id: string) => void
        readonly toggleEdit: (id: string) => void
        readonly setDraft: (id: string, value: string) => void
    }
}

/** Draws the loyalty decisions waiting for a person: approve or reject each, and edit the text of an offer before approving it. */
export const LoyaltyPendingBase = (props: LoyaltyPendingBaseProps) => {
    const { label, emptyTitle, emptyBody, isPending } = props.props
    return (
        <SurfaceListCard ariaLabel={label} empty={<EmptyNotice message={emptyTitle} description={emptyBody} />}>
            {props.props.rows.map((row) => (
                <ListItem key={row.id} className={ROW_CLASS_NAME}>
                    <div className={ROW_MAIN_CLASS_NAME}>
                        <div className={CHIPS_CLASS_NAME}>
                            <Badge tone="warning" isDot>
                                {row.actionLabel}
                            </Badge>
                            <Text as="span" size="xs" tone="muted">
                                {row.age}
                            </Text>
                        </div>
                        {row.customer === "" ? null : <Text weight="semibold">{row.customer}</Text>}
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
                            <div className={QUOTE_CLASS_NAME}>
                                <Text size="xs" tone="muted" weight="medium">
                                    {props.props.draftLabel}
                                </Text>
                                <Text as="p" size="sm">
                                    {row.draft}
                                </Text>
                            </div>
                        ) : null}
                        {row.canAct && row.isEditing && row.canEditDraft ? (
                            <div className={FORM_CLASS_NAME}>
                                <Textarea
                                    label={props.props.draftLabel}
                                    variant="secondary"
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
                    {row.canAct ? (
                        <div className={ROW_ACTIONS_CLASS_NAME}>
                            <Button
                                variant="primary"
                                size="sm"
                                isPending={row.isApproving}
                                isDisabled={isPending}
                                onPress={() => props.on.approve(row.id)}
                            >
                                {props.props.approve}
                            </Button>
                            {row.canEditDraft ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    isDisabled={isPending}
                                    onPress={() => props.on.toggleEdit(row.id)}
                                >
                                    {row.isEditing ? props.props.editDone : props.props.edit}
                                </Button>
                            ) : null}
                            <Button
                                variant="danger-soft"
                                size="sm"
                                isPending={row.isRejecting}
                                isDisabled={isPending}
                                onPress={() => props.on.reject(row.id)}
                            >
                                {props.props.reject}
                            </Button>
                        </div>
                    ) : null}
                </ListItem>
            ))}
        </SurfaceListCard>
    )
}
