import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text, Textarea } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One public comment waiting for a decision, every word already resolved. */
interface LeadGenCommentView {
    readonly id: string
    readonly title: string
    readonly description: string
    readonly sourceLabel: string
    readonly comment: string
    readonly draft: string
    readonly isEditing: boolean
    readonly draftValue: string
    readonly error: string | null
}

/** The words and data of the comments tab. */
export interface LeadGenCommentListData {
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly rows: ReadonlyArray<LeadGenCommentView>
    readonly draftLabel: string
    readonly noDraft: string
    readonly editLabel: string
    readonly approveLabel: string
    readonly cancelLabel: string
    readonly saveApproveLabel: string
    readonly retryLabel: string
    readonly busyId: string | null
    readonly isApproving: boolean
}

/** What the comments tab draws and the actions it reports. */
interface LeadGenCommentListProps extends LeadGenCommentListData {
    readonly onEdit: (id: string) => void
    readonly onCancel: (id: string) => void
    readonly onDraft: (id: string, value: string) => void
    readonly onApprove: (id: string, edited: boolean) => void
    readonly onRetry: () => void
}

/** Public replies that wait for a person (ask mode). Approve posts the drafted reply, Edit changes it first. */
export const LeadGenCommentList = (props: LeadGenCommentListProps) => {
    return (
        <SurfaceListCard
            ariaLabel={props.label}
            empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        >
            {props.rows.map((row) => {
                const isBusy = props.busyId === row.id
                return (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        description={row.description}
                        badges={<Badge tone="neutral">{row.sourceLabel}</Badge>}
                        actions={
                            row.isEditing ? null : (
                                <div className={ACTIONS_CLASS_NAME}>
                                    <Button
                                        intent="neutral"
                                        size="sm"
                                        isDisabled={props.isApproving}
                                        onPress={() => props.onEdit(row.id)}
                                    >
                                        {props.editLabel}
                                    </Button>
                                    <Button
                                        intent="alternative"
                                        size="sm"
                                        isPending={isBusy}
                                        isDisabled={props.isApproving || !row.draft}
                                        onPress={() => props.onApprove(row.id, false)}
                                    >
                                        {props.approveLabel}
                                    </Button>
                                </div>
                            )
                        }
                    >
                        {renderLeadGenCommentListComment(row, props, isBusy)}
                    </ListRow>
                )
            })}
        </SurfaceListCard>
    )
}

/** Renders the LeadGenCommentList comment section. */
const renderLeadGenCommentListComment = (
    row: Pick<LeadGenCommentView, "comment" | "isEditing" | "draftValue" | "id" | "draft" | "error">,
    props: LeadGenCommentListProps,
    isBusy: boolean,
) => (
    <div className={FORM_CLASS_NAME}>
        <Text as="p" size="sm">
            {row.comment}
        </Text>
        {row.isEditing ? (
            <>
                <Textarea
                    label={props.draftLabel}
                    rows={3}
                    value={row.draftValue}
                    isDisabled={props.isApproving}
                    onValueChange={(value) => props.onDraft(row.id, value)}
                />
                <div className={ACTIONS_CLASS_NAME}>
                    <Button
                        intent="neutral"
                        size="sm"
                        isDisabled={props.isApproving}
                        onPress={() => props.onCancel(row.id)}
                    >
                        {props.cancelLabel}
                    </Button>
                    <Button
                        intent="commit"
                        size="sm"
                        isPending={isBusy}
                        isDisabled={props.isApproving || !row.draftValue.trim()}
                        onPress={() => props.onApprove(row.id, true)}
                    >
                        {props.saveApproveLabel}
                    </Button>
                </div>
            </>
        ) : (
            <Text as="p" size="sm" tone="muted">
                {row.draft || props.noDraft}
            </Text>
        )}
        {row.error === null ? null : (
            <div className={ACTIONS_CLASS_NAME}>
                <Text size="sm" live="assertive">
                    {row.error}
                </Text>
                {isBusy ? (
                    <Button intent="neutral" size="sm" onPress={props.onRetry}>
                        {props.retryLabel}
                    </Button>
                ) : null}
            </div>
        )}
    </div>
)
