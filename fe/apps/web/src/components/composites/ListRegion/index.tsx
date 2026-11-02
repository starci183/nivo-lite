import { EmptyNotice, SurfaceCard, Text } from "@starci/grammar/common"
import type { BadgeTone, ListRowData } from "@starci/grammar/common"
import { AGENT_MARK_MASCOT_SRC } from "@/components/leaves/AgentMark"
import type { ModuleIconName } from "@/modules/types"

/** One line of a list region. */
interface ListRegionRow {
    readonly id: string
    readonly title: string
    readonly description: string
    /** The agent mark at the start of the line; null for a line that is not an agent. */
    readonly mark: {
        readonly glyph: ModuleIconName
        readonly module: string
        /** The picture the owner gave the agent; null draws the NIVO unicorn mascot. */
        readonly avatarUrl: string | null
    } | null
    /** At most two status marks after the title. */
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: BadgeTone }>
}

/** The lines of a list region, handed down by its block's SlotView. */
export interface ListRegionProps {
    readonly label: string
    readonly rows: ReadonlyArray<ListRegionRow>
    /** A line under the list; null for none. */
    readonly footer: string | null
    /** The settled-empty sentence resolved by the block that owns this read. */
    readonly empty: string
    /** The region's read is still in flight: the card draws its skeleton rows. */
    readonly isLoading: boolean
}

const listRowOf = (row: ListRegionRow): ListRowData => {
    const first = row.badges[0]
    const second = row.badges[1]
    const badges = listBadgesOf(first, second)
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        ...(badges === undefined ? {} : { badges }),
        ...(row.mark === null
            ? {}
            : {
                  leading: {
                      avatar: {
                          name: row.title,
                          seed: row.id,
                          kind: "agent",
                          src: row.mark.avatarUrl ?? AGENT_MARK_MASCOT_SRC,
                      },
                  },
              }),
    }
}

/** A card of lines that is read apart from its page; its block draws the read's status through SlotView. */
export const ListRegion = (props: ListRegionProps) => (
    <SurfaceCard
        kind="list"
        label={props.label}
        items={props.rows.map(listRowOf)}
        empty={<EmptyNotice message={props.empty} />}
        isLoading={props.isLoading}
        footer={
            props.footer === null ? undefined : (
                <Text size="sm" tone="muted">
                    {props.footer}
                </Text>
            )
        }
    />
)

/** Native rows carry at most two existing badges. */
const listBadgesOf = (
    first: ListRegionRow["badges"][number] | undefined,
    second: ListRegionRow["badges"][number] | undefined,
): ListRowData["badges"] => {
    if (first === undefined) return undefined
    if (second === undefined) return [first]
    return [first, second]
}
