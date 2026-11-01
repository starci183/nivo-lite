import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { SinglePickList } from "@/components/leaves/SinglePickList"
import { AgentMark } from "@/components/leaves/AgentMark"

/** One conversation of the rail, with every word resolved. */
export interface AgentChatRailRow {
    readonly id: string
    readonly kind: "test" | "customer"
    readonly title: string
    /** Kind, time and whether a lead was captured, in one line. */
    readonly description: string
    readonly isSelected: boolean
}

/** The rows of the conversation rail and the mark each one wears. */
interface AgentChatRailListProps {
    readonly label: string
    readonly rows: ReadonlyArray<AgentChatRailRow>
    readonly glyph: ModuleIconName
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    readonly module: string
    /** The rows are still loading: the list draws waiting rows. */
    readonly isSkeleton: boolean
    readonly onPick: (id: string, kind: "test" | "customer") => void
}

/** The conversations of the agent, each wearing the agent's mark. */
export const AgentChatRailList = (props: AgentChatRailListProps) => (
    <SinglePickList
        label={props.label}
        isSkeleton={props.isSkeleton}
        onPick={(id) => {
            const picked = props.rows.find((row) => row.id === id)
            if (picked) props.onPick(picked.id, picked.kind)
        }}
        rows={props.rows.map((row) => ({
            id: row.id,
            label: row.title,
            description: row.description,
            isSelected: row.isSelected,
            leading: (
                <AgentMark
                    glyph={nivoIconSource(props.glyph, "leading")}
                    module={props.module}
                    label={row.title}
                    src={props.avatarUrl}
                    size="md"
                />
            ),
        }))}
    />
)
