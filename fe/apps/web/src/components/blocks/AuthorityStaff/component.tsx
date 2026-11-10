import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

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

/** Draws the staff section: the people NIVO can hand an exception to, one list with its explanation under it. Staff are never required for routine work. */
export const AuthorityStaffBase = (props: AuthorityStaffBaseProps) => {
    const view = props.props
    return (
        <SlotView
            slot={view.slot}
            placeholder={view.placeholder}
            labels={view.slotLabels}
            onRetry={props.on.retry}
            render={(rows, isLoading) => (
                <SurfaceCard
                    kind="list"
                    ariaLabel={view.title}
                    isLoading={isLoading}
                    items={rows.map((row) => ({
                        id: row.id,
                        title: row.name,
                        description: row.role,
                        ...(row.hasAccount
                            ? { badges: [{ label: view.hasAccountLabel, tone: "accent" as const }] as const }
                            : {}),
                        ...(row.inviteHref === null
                            ? {}
                            : {
                                  action: { label: view.inviteLabel, intent: "neutral", href: row.inviteHref } as const,
                              }),
                    }))}
                    empty={<EmptyNotice message={view.slotLabels.empty} />}
                    note={`${view.description} ${view.note}`}
                />
            )}
        />
    )
}
