import { Button, Cluster, Section, type ListRowData } from "@starci/grammar/common"
import type { ConnectionsListView } from "@/modules/types"
import type { ConnectionsHomeCommands, PendingAttachmentView } from "./types"

/** What the attention section needs. */
interface AttentionSectionProps {
    readonly title: string
    readonly view: ConnectionsListView
    readonly pending: ReadonlyArray<PendingAttachmentView>
    readonly on: ConnectionsHomeCommands
    readonly isLoading: boolean
}

/** One row per connection that needs the owner: its mark, what happened, what it stops, and its one action. */
const attentionRowsOf = (view: ConnectionsListView, on: ConnectionsHomeCommands): ReadonlyArray<ListRowData> =>
    view.attention.map((step): ListRowData => {
        const action = step.action
        return {
            id: step.id,
            title: step.title,
            description: step.body,
            leading: {
                avatar: {
                    name: step.name,
                    ...(step.logo.src === undefined ? {} : { src: step.logo.src }),
                    shape: "square",
                },
                size: "md",
            },
            actionPlacement: "end",
            ...(action === null
                ? {}
                : {
                      action: {
                          label: action.label,
                          intent: action.isPrimary ? "commit" : "neutral",
                          isPrimary: action.isPrimary,
                          press: () => on.goTo(action.href),
                      },
                  }),
        }
    })

/** One row per provider that waits for "attach by template?": its mark, the question, and two neutral small pills. */
const pendingRowsOf = (pending: ReadonlyArray<PendingAttachmentView>, on: ConnectionsHomeCommands): ReadonlyArray<ListRowData> =>
    pending.map(
        (row): ListRowData => ({
            id: `pending:${row.id}`,
            title: row.title,
            description: row.body,
            leading: {
                avatar: { name: row.name, ...(row.logo === undefined ? {} : { src: row.logo }), shape: "square" },
                size: "md",
            },
            detail: (
                <Cluster gap="inline">
                    <Button size="sm" intent="neutral" onPress={() => on.later(row.id)}>
                        {row.laterLabel}
                    </Button>
                    <Button size="sm" intent="neutral" onPress={() => on.attachByTemplate(row.id)}>
                        {row.attachLabel}
                    </Button>
                </Cluster>
            ),
        }),
    )

/** The section of what needs the owner: the providers waiting to be attached, then the connections that need handling; nothing when none. */
export const AttentionSection = (props: AttentionSectionProps) => {
    const count = props.view.attention.length + props.pending.length
    if (count === 0) return null
    return (
        <Section
            kind="list"
            title={props.title}
            count={count}
            items={[...pendingRowsOf(props.pending, props.on), ...attentionRowsOf(props.view, props.on)]}
            empty={null}
            isLoading={props.isLoading}
        />
    )
}
