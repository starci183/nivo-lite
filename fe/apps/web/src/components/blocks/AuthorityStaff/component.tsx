import { Badge, Button, List, ListRow, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FIELDS_CLASS } from "./classNames"

/** One staff member as the list draws it. */
export interface StaffRowView {
    readonly id: string
    readonly name: string
    readonly role: string
    readonly hasAccount: boolean
    /** Where owner and manager invite this person to sign in; none for someone who already can. */
    readonly inviteHref: string | null
}

/** Copy and state of the staff section. */
export interface AuthorityStaffBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly note: string
        readonly hasAccountLabel: string
        readonly inviteLabel: string
        readonly slot: DataSlot<ReadonlyArray<StaffRowView>>
        readonly placeholder: ReadonlyArray<StaffRowView>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** Draws the staff section: the people NIVO can hand an exception to. Staff are never required for routine work. */
export const AuthorityStaffBase = (props: AuthorityStaffBaseProps) => {
    const view = props.props
    return (
        <SurfaceCard label={view.title} headingLevel={2}>
            <div className={FIELDS_CLASS}>
                <Text size="sm" tone="muted">
                    {view.description}
                </Text>
                <SlotView
                    slot={view.slot}
                    placeholder={view.placeholder}
                    labels={view.slotLabels}
                    onRetry={props.on.retry}
                >
                    {(rows, isSkeleton) => (
                        <List label={view.title}>
                            {rows.map((row) => (
                                <ListRow
                                    key={row.id}
                                    isSkeleton={isSkeleton}
                                    title={row.name}
                                    description={row.role}
                                    badges={row.hasAccount ? <Badge tone="accent">{view.hasAccountLabel}</Badge> : null}
                                    actions={
                                        row.inviteHref === null ? null : (
                                            <Button intent="neutral" href={row.inviteHref}>
                                                {view.inviteLabel}
                                            </Button>
                                        )
                                    }
                                />
                            ))}
                        </List>
                    )}
                </SlotView>
                <Text size="xs" tone="muted">
                    {view.note}
                </Text>
            </div>
        </SurfaceCard>
    )
}
