import { EmptyNotice, Stack, Sublabel, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
/** One truth the run read: its name, the 12 muted line, the value now (empty when none), and whether the truth was replaced. */
interface ReadRowView {
    readonly id: string
    readonly title: string
    readonly subtitle: string
    readonly value: string
    readonly isGone: boolean
}

/** What the card draws: its small label over it, and one row per truth the run read. */
export interface AgentRunReadsProps {
    readonly title: string
    readonly rows: ReadonlyArray<ReadRowView>
    readonly isLoading: boolean
}

/** One truth as a key-less row: its name over the 12 muted line, the value the shop holds now at the end; a truth that was replaced is muted. */
const rowOf = (row: ReadRowView): ListRowData => ({
    id: row.id,
    title: row.title,
    ...(row.subtitle === ""
        ? {}
        : {
              description: (
                  <Text as="span" size="xs" tone="muted">
                      {row.subtitle}
                  </Text>
              ),
          }),
    ...(row.value === "" ? {} : { value: row.value }),
    ...(row.isGone ? { state: "unavailable" as const } : {}),
})

/** The truths a run read, under their small label: one bordered-free white card of rows on the page ground, between the map and the AI calls. */
export const AgentRunReads = (props: AgentRunReadsProps) => (
    <Stack gap="inline">
        <Sublabel>{props.title}</Sublabel>
        <SurfaceCard
            kind="list"
            ariaLabel={props.title}
            isLoading={props.isLoading}
            items={props.rows.map((row) => rowOf(row))}
            empty={<EmptyNotice message={props.title} />}
        />
    </Stack>
)
