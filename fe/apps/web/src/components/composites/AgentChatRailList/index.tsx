import { SinglePickList } from "@/components/leaves/SinglePickList"
import { AgentMark } from "@/components/leaves/AgentMark"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"

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
    /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
    readonly avatarUrl?: string | null | undefined
    /** The id of the agent: the one seed of its mark on every screen. */
    readonly seed: string
    /** The rows are still loading: the list draws waiting rows. */
    readonly isLoading: boolean
    readonly onPick: (id: string, kind: "test" | "customer") => void
}

/** The conversations of the agent: a test one wears the agent's mark, a customer's the customer's own. */
export const AgentChatRailList = (props: AgentChatRailListProps) => (
    <SinglePickList
        label={props.label}
        isLoading={props.isLoading === true}
        descriptionLines={1}
        onPick={(id) => {
            const picked = props.rows.find((row) => row.id === id)
            if (picked) props.onPick(picked.id, picked.kind)
        }}
        rows={props.rows.map((row) => ({
            id: row.id,
            label: row.title,
            description: row.description,
            isSelected: row.isSelected,
            leading:
                row.kind === "customer" ? (
                    <PersonAvatar name={row.title} seed={row.id} />
                ) : (
                    <AgentMark label={row.title} seed={props.seed} src={props.avatarUrl} size="md" />
                ),
        }))}
    />
)
