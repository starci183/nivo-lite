import type { ShiftsRequestViews, ShiftsRequestActions } from "@/modules/types"
type ShiftsRequestsProps = ShiftsRequestViews["requests"] & {
    readonly on: ShiftsRequestActions["requests"] | undefined
    readonly isLoading?: boolean
}
import { Button, Cluster, EmptyNotice, Section, Stack } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"

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
                                <Button
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                    size="sm"
                                    intent="neutral"
                                    isDisabled={props.isBusy}
                                    onPress={() => {
                                        if (row.decision !== null)
                                            props.on?.approve(row.decision.kind, row.decision.targetId)
                                    }}
                                >
                                    {props.approveLabel}
                                </Button>
                                <Button
                                    {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                    size="sm"
                                    intent="neutral"
                                    isDisabled={props.isBusy}
                                    onPress={() => {
                                        if (row.decision !== null)
                                            props.on?.decline(row.decision.kind, row.decision.targetId)
                                    }}
                                >
                                    {props.declineLabel}
                                </Button>
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
