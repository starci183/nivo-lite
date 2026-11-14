import { EmptyNotice, Section, type ListRowData } from "@starci/grammar/common"
import type { AgentGraphVersionsView } from "@/modules/types"

/** The history of the graph and the command that goes back to a saved version. */
type AgentGraphVersionsProps = {
    readonly view: AgentGraphVersionsView
    readonly isLoading: boolean
    readonly onRestore: (versionId: string) => void
}

/** Every save is a version nobody can change: what changed, where it came from and when. */
export const AgentGraphVersions = (props: AgentGraphVersionsProps) => (
    <Section
        kind="list"
        title={props.view.title}
        caption={props.view.hint}
        isLoading={props.isLoading}
        headingLevel={3}
        items={props.view.items.map((item): ListRowData => ({
            id: item.id,
            title: item.title,
            description: [item.note, item.byLine].filter((part) => part !== "").join(" · "),
            ...(item.badge === null
                ? {}
                : { badges: [{ label: item.badge.text, tone: item.badge.tone, isDot: true }] }),
            ...(item.canRestore ? { action: { label: item.restoreLabel, press: () => props.onRestore(item.id) } } : {}),
        }))}
        empty={<EmptyNotice message={props.view.title} />}
    />
)
