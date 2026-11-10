import { SurfaceCard } from "@starci/grammar/common"
import type { WorkflowNoticeView } from "@/modules/types"

/** The words of the notice that a newer template exists. */
export interface AgentWorkflowNoticeCopy {
    readonly sync: string
    readonly viewDiff: string
    readonly caption: string
}

/** What the notice draws and what it does. */
interface AgentWorkflowNoticeProps {
    readonly props: {
        readonly copy: AgentWorkflowNoticeCopy
        readonly notice: WorkflowNoticeView
        readonly isWriting: boolean
    }
    readonly on: { readonly sync: () => void; readonly diff: () => void }
}

/**
 * The notice that the template has a newer version: its title above the card, the changelog in one line and how many steps differ from
 * the workflow inside, the one primary "Sync from template" with a neutral "See the differences", and the caption below.
 */
export const AgentWorkflowNotice = (props: AgentWorkflowNoticeProps) => {
    const { copy, notice } = props.props
    return (
        <SurfaceCard
            kind="list"
            label={notice.title}
            headingLevel={2}
            note={copy.caption}
            empty={null}
            items={[
                {
                    id: "sync",
                    title: notice.changelog === "" ? notice.title : notice.changelog,
                    action: {
                        label: copy.sync,
                        intent: "commit",
                        isPrimary: true,
                        isPending: props.props.isWriting,
                        press: props.on.sync,
                    },
                    actionPlacement: "end" as const,
                },
                ...(notice.diffLine === ""
                    ? []
                    : [
                          {
                              id: "diff",
                              title: notice.diffLine,
                              action: { label: copy.viewDiff, press: props.on.diff },
                              actionPlacement: "end" as const,
                          },
                      ]),
            ]}
        />
    )
}
