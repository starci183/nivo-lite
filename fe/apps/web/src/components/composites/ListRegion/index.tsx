import { Badge, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { AgentMark } from "@/components/leaves/AgentMark"
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
    /** The region's read is still in flight: the card draws its skeleton rows. */
    readonly isSkeleton: boolean
}

/** A card of lines that is read apart from its page; its block draws the read's status through SlotView. */
export const ListRegion = (props: ListRegionProps) => (
    <SurfaceListCard
        label={props.label}
        isLoading={props.isSkeleton}
        footer={
            props.footer === null ? undefined : (
                <Text size="sm" tone="muted">
                    {props.footer}
                </Text>
            )
        }
    >
        {/* While the read waits the card draws its own skeleton rows: placeholder lines would win over them. */}
        {props.isSkeleton
            ? null
            : props.rows.map((row) => (
                  <ListRow
                      key={row.id}
                      title={row.title}
                      description={row.description}
                      leading={
                          row.mark === null ? undefined : (
                              <AgentMark
                                  glyph={nivoIconSource(row.mark.glyph, "leading")}
                                  module={row.mark.module}
                                  label={row.title}
                                  src={row.mark.avatarUrl}
                              />
                          )
                      }
                      badges={row.badges.map((badge) => (
                          <Badge key={badge.label} tone={badge.tone}>
                              {badge.label}
                          </Badge>
                      ))}
                  />
              ))}
    </SurfaceListCard>
)
