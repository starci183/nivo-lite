import { nivoIconSource } from "@/components/leaves/Icon"
import type { ModuleIconName } from "@/modules/types"
import { ListBox } from "@starci/grammar/common"
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
    readonly module: string
    /** The rows are still loading: the list draws waiting rows. */
    readonly isSkeleton: boolean
    readonly onPick: (id: string, kind: "test" | "customer") => void
}

/** The conversations of the agent; the grammar list owns the rows, the selected face and the keyboard model. */
export const AgentChatRailList = (props: AgentChatRailListProps) => (
    <ListBox
        label={props.label}
        selectionMode="single"
        isLoading={props.isSkeleton}
        loadingRows={3}
        selectedIds={props.rows.filter((row) => row.isSelected).map((row) => row.id)}
        onSelectionChange={(ids) => {
            const picked = props.rows.find((row) => row.id === ids[0])
            if (picked) props.onPick(picked.id, picked.kind)
        }}
        items={props.rows.map((row) => ({
            id: row.id,
            label: row.title,
            description: row.description,
            leading: (
                <AgentMark
                    glyph={nivoIconSource(props.glyph, "leading")}
                    module={props.module}
                    label={row.title}
                    size="md"
                />
            ),
        }))}
    />
)
