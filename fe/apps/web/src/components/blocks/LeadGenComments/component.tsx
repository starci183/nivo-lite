import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text, Textarea } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"

/** One public comment waiting for a decision, every word already resolved. */
export interface LeadGenCommentView {
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
export interface LeadGenCommentsBaseProps {
    readonly props: {
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
        readonly busyId: string | null
    }
    readonly on: {
        readonly edit: (id: string) => void
        readonly cancel: (id: string) => void
        readonly draft: (id: string, value: string) => void
        readonly approve: (id: string, edited: boolean) => void
    }
}

/** Public replies that wait for a person (ask mode). Approve posts the drafted reply, Edit changes it first. */
export const LeadGenCommentsBase = (props: LeadGenCommentsBaseProps) => {
    const { props: p, on } = props
    return (
        <SurfaceListCard ariaLabel={p.label} empty={<EmptyNotice message={p.emptyTitle} description={p.emptyBody} />}>
            {p.rows.map((row) => {
                const isBusy = p.busyId === row.id
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
                                        variant="outline"
                                        size="sm"
                                        isDisabled={p.busyId !== null}
                                        onPress={() => on.edit(row.id)}
                                    >
                                        {p.editLabel}
                                    </Button>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        isPending={isBusy}
                                        isDisabled={p.busyId !== null || !row.draft}
                                        onPress={() => on.approve(row.id, false)}
                                    >
                                        {p.approveLabel}
                                    </Button>
                                </div>
                            )
                        }
                    >
                        <div className={FORM_CLASS_NAME}>
                            <Text as="p" size="sm">
                                {row.comment}
                            </Text>
                            {row.isEditing ? (
                                <>
                                    <Textarea
                                        label={p.draftLabel}
                                        variant="secondary"
                                        rows={3}
                                        value={row.draftValue}
                                        isDisabled={isBusy}
                                        onValueChange={(value) => on.draft(row.id, value)}
                                    />
                                    <div className={ACTIONS_CLASS_NAME}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            isDisabled={isBusy}
                                            onPress={() => on.cancel(row.id)}
                                        >
                                            {p.cancelLabel}
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            isPending={isBusy}
                                            isDisabled={isBusy || !row.draftValue.trim()}
                                            onPress={() => on.approve(row.id, true)}
                                        >
                                            {p.saveApproveLabel}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <Text as="p" size="sm" tone="muted">
                                    {row.draft || p.noDraft}
                                </Text>
                            )}
                            {row.error === null ? null : (
                                <Text size="sm" live="assertive">
                                    {row.error}
                                </Text>
                            )}
                        </div>
                    </ListRow>
                )
            })}
        </SurfaceListCard>
    )
}
