import type { ShiftsRequestViews, ShiftsRequestActions } from "@/modules/types"
type ShiftsRequestsProps = ShiftsRequestViews["requests"] & {
    readonly on: ShiftsRequestActions["requests"] | undefined
    readonly isLoading?: boolean
}
import { Cluster, EmptyNotice, Section, Stack } from "@starci/grammar/common"
import { ShiftsActionButton, type ShiftsActionButtonProps } from "@/components/leaves/ShiftsActionButton"
import type { ListRowData } from "@starci/grammar/common"

/** The approve and decline buttons of a request that waits for a decision. */
const decisionButtonsOf = (
    props: ShiftsRequestsProps,
    decision: NonNullable<ShiftsRequestsProps["recent"][number]["decision"]>,
): ReadonlyArray<ShiftsActionButtonProps> =>
    [
        {
            label: props.approveLabel,
            onPress: () => props.on?.approve(decision.kind, decision.targetId),
        },
        {
            label: props.declineLabel,
            onPress: () => props.on?.decline(decision.kind, decision.targetId),
        },
    ].map((button): ShiftsActionButtonProps => ({
        ...button,
        intent: "neutral",
        size: "sm",
        isDisabled: props.isBusy,
        isLoading: props.isLoading,
    }))

/** Draws open and recent requests in their own sections, preserving every decision command. */
export const ShiftsRequests = (props: ShiftsRequestsProps) => (
    <Stack gap="section">
        {props.sections.length === 0 ? <EmptyNotice message={props.emptyTitle} description={props.emptyBody} /> : null}
        {[...props.sections, { id: "recent", title: props.recentTitle, hint: "", rows: props.recent }]
            .filter((section) => section.rows.length > 0)
            .map((section) => {
                const items: Array<ListRowData> = section.rows.map((row) => ({
                    id: row.id,
                    title: row.title,
                    description: row.notes.filter((note) => note !== "").join(" · "),
                    badges: [{ label: row.badge, tone: row.tone }],
                    detail:
                        row.decision === null ? null : (
                            <Cluster gap="inline">
                                {decisionButtonsOf(props, row.decision).map((button) => (
                                    <ShiftsActionButton key={button.label} {...button} />
                                ))}
                            </Cluster>
                        ),
                }))
                return (
                    <Section
                        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                        key={section.id}
                        kind="list"
                        title={section.title}
                        {...(section.hint === "" ? {} : { description: section.hint })}
                        items={items}
                        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
                    />
                )
            })}
    </Stack>
)
