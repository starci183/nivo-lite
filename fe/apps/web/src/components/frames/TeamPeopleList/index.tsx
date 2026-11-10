import { Badge, Cluster, EmptyNotice, IconTile, Text } from "@starci/grammar/common"
import type { ListBoxItem, ListBoxSection } from "@starci/grammar/common"
import { FilterGroup } from "@/components/composites/FilterGroup"
import { PaneSections } from "@/components/composites/PaneSections"
import { nivoIconSource } from "@/components/leaves/Icon"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesData = Extract<TeamPanesBaseProps["props"]["slot"], { readonly items: unknown }>["items"]
/** Derived from the panes contract. */
type TeamListRowView = TeamPanesData["rows"][number]

/** What the list pane's body draws and does. */
interface TeamPeopleListProps {
    readonly copy: TeamPanesBaseProps["props"]["copy"]
    readonly data: TeamPanesData
    readonly query: string
    readonly filter: string
    readonly selectedId: string | null
    readonly isLoading: boolean
    readonly on: Pick<TeamPanesBaseProps["on"], "setQuery" | "setFilter" | "moreFilters" | "select">
}

/** The row of the list: the person's avatar or the mail mark, the words, and the state marks at the end. */
const itemOf = (row: TeamListRowView, youLabel: string): ListBoxItem => ({
    id: row.id,
    label: row.title,
    description: row.description,
    leading:
        row.kind === "member" ? (
            <PersonAvatar name={row.title} size="md" />
        ) : (
            <IconTile source={nivoIconSource("email", "leading")} tone="neutral" />
        ),
    trailing:
        row.isYou || row.badge !== null ? (
            <Cluster gap="inline">
                {row.isYou ? <Badge tone="neutral">{youLabel}</Badge> : null}
                {row.badge === null ? null : <Badge tone={row.badge.tone}>{row.badge.label}</Badge>}
            </Cluster>
        ) : undefined,
})

/** The list's sections: the people, then the invitations that wait; a section with no row is left out. */
const sectionsOf = (props: TeamPeopleListProps): ReadonlyArray<ListBoxSection> =>
    [
        { id: "members", label: props.copy.sectionMembers, kind: "member" as const },
        { id: "invites", label: props.copy.sectionInvites, kind: "invite" as const },
    ]
        .map((section) => ({
            id: section.id,
            label: section.label,
            items: props.data.rows
                .filter((row) => row.kind === section.kind)
                .map((row) => itemOf(row, props.copy.youLabel)),
        }))
        .filter((section) => section.items.length > 0)

/** The list pane's body: the search and filter, the summary and the sections, each part geometry while the team loads. */
export const TeamPeopleList = (props: TeamPeopleListProps) => (
    <>
        <FilterGroup
            isLoading={props.isLoading}
            search={{
                label: props.copy.searchLabel,
                placeholder: props.copy.searchPlaceholder,
                clearLabel: props.copy.clearSearch,
                value: props.query,
                onChange: props.on.setQuery,
            }}
            choice={{
                label: props.copy.filterLabel,
                options: [
                    { value: "all", label: props.copy.filterAll },
                    { value: "members", label: props.copy.filterMembers, count: props.data.counts.members },
                    { value: "invites", label: props.copy.filterInvites, count: props.data.counts.invites },
                ],
                value: props.filter,
                onChange: props.on.setFilter,
                moreLabel: props.on.moreFilters,
            }}
        />
        <Text size="xs" tone="muted" isLoading={props.isLoading}>
            {props.copy.summary}
        </Text>
        <PaneSections
            label={props.copy.listLabel}
            sections={sectionsOf(props)}
            selectedId={props.selectedId}
            onSelect={props.on.select}
            empty={<EmptyNotice message={props.copy.noMatchTitle} iconSource={nivoIconSource("search", "leading")} description={props.copy.noMatchBody} />}
            isLoading={props.isLoading}
        />
    </>
)
