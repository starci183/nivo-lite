import { Cluster, EmptyNotice, Link, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { OverviewPaneCopy, OverviewPaneReady } from "@/modules/types"

/** What the open work card draws. */
interface OverviewWorkCardProps {
    readonly data: OverviewPaneReady["work"]
    readonly copy: OverviewPaneCopy
    readonly onGo: (href: string) => void
    readonly isLoading: boolean
}

/** One open responsibility as a row: the holder mark, the customer, the due words and where it stands. */
const rowOf = (row: OverviewPaneReady["work"]["rows"][number], onGo: (href: string) => void): ListRowData => ({
    id: row.id,
    title: row.title,
    description: row.line,
    onPress: () => onGo(row.href),
    leading: {
        avatar: {
            name: row.ownerName,
            kind: row.ownerKind === "agent" ? "agent" : "person",
            seed: row.ownerKey,
            ...(row.avatarUrl === null ? {} : { src: row.avatarUrl }),
        },
    },
    badges: [{ label: row.status.label, tone: row.status.tone, isDot: true }],
    ...(row.due === null
        ? {}
        : { meta: { text: row.due, tone: row.isOverdue ? ("danger" as const) : ("muted" as const) } }),
})

/** The open work as one flat list that names each holder, with the way to all of it; an empty list invites the next step. */
export const OverviewWorkCard = (props: OverviewWorkCardProps) => (
    <SurfaceCard
        kind="list"
        label={props.copy.workTitle}
        headingLevel={2}
        isLoading={props.isLoading}
        labelEnd={
            <Cluster gap="row">
                <Text size="xs" tone="muted" isLoading={props.isLoading}>
                    {props.data.count}
                </Text>
                <Link href={CONSOLE_ROUTES.responsibilities}>{props.copy.workAll}</Link>
            </Cluster>
        }
        empty={
            <EmptyNotice
                message={props.copy.workEmptyTitle}
                description={props.data.empty.description}
                actionLabel={props.data.empty.actionLabel}
                onAction={() => props.onGo(props.data.empty.href)}
                iconSource={nivoIconSource("review", "leading")}
            />
        }
        items={props.data.rows.map((row) => rowOf(row, props.onGo))}
    />
)
