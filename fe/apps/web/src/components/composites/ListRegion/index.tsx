import { EmptyNotice, Link, Section, type BadgeTone, type ListRowData } from "@starci/grammar/common"
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
        /** The picture the owner gave the agent; null draws the NIVO AI mark. */
        readonly avatarUrl: string | null
    } | null
    /** At most two status marks after the title. */
    readonly badges: ReadonlyArray<{ readonly label: string; readonly tone: BadgeTone }>
    /** One short fact at the end of the line, before the marks (how many identical lines it stands for: "x4"); null for none. */
    readonly meta: string | null
    /** What pressing anywhere on the line does (the line ends in a chevron); null for a line that opens nothing. */
    readonly open: (() => void) | null
}

/** The lines of a list region, handed down by its block's SlotView. */
export interface ListRegionProps {
    readonly label: string
    readonly rows: ReadonlyArray<ListRegionRow>
    /** How many things the list holds, as the head's count chip; null for none. */
    readonly count: number | null
    /** The count is work waiting for the owner: the chip is pink. */
    readonly isAttention: boolean
    /** The head's one navigation link ("Xem tat ca" then the arrow); null for none. */
    readonly action: { readonly label: string; readonly href: string } | null
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
        ...(row.meta === null ? {} : { meta: { text: row.meta } }),
        ...(row.open === null ? {} : { onPress: row.open }),
        ...(row.mark === null
            ? {}
            : {
                  leading: {
                      avatar: {
                          name: row.title,
                          seed: row.id,
                          kind: "agent",
                          ...(row.mark.avatarUrl === null ? {} : { src: row.mark.avatarUrl }),
                      },
                  },
              }),
    }
}

/** A card of lines that is read apart from its page; its block draws the read's status through SlotView. */
export const ListRegion = (props: ListRegionProps) => (
    <Section
        kind="list"
        title={props.label}
        items={props.rows.map((row) => listRowOf(row))}
        empty={<EmptyNotice message={props.empty} />}
        isLoading={props.isLoading}
        {...(props.count === null ? {} : { count: props.count, isAttention: props.isAttention })}
        {...(props.action === null
            ? {}
            : {
                  action: (
                      <Link variant="head" href={props.action.href}>
                          {props.action.label}
                      </Link>
                  ),
              })}
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
