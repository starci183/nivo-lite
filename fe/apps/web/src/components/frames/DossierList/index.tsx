import { EmptyNotice, IconTile, ListBox, Section, Stack, Tabs } from "@starci/grammar/common"
import type { ListBoxSection } from "@starci/grammar/common"
import { RowTrailing } from "@/components/composites/RowTrailing"
import { FilterGroup } from "@/components/composites/FilterGroup"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DossierListView, DossierSectionView } from "@/hooks/brain"

export type { DossierDeskView } from "@/hooks/brain"

/** The two views of the tab. */
export type DossierMode = "list" | "map"

/** The words of the list pane. */
export interface DossierListCopy {
    readonly listLabel: string
    readonly viewsLabel: string
    readonly viewList: string
    readonly viewMap: string
    readonly figuresLabel: string
    readonly searchLabel: string
    readonly clearSearch: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
}

/** What the list pane draws. */
interface DossierListProps {
    readonly view: DossierListView
    readonly copy: DossierListCopy
    /** Which view of the tab is open: the list or the map. */
    readonly mode: DossierMode
    readonly isWaiting: boolean
    readonly onMode: (mode: DossierMode) => void
    readonly onQuery: (value: string) => void
    readonly onSelect: (id: string) => void
}

/** Rows of the same shape as a ready list, drawn as geometry while the categories are read. */
const PLACEHOLDER: ReadonlyArray<ListBoxSection> = ["a", "b"].map((id) => ({
    id,
    label: "-",
    items: ["1", "2"].map((n) => ({ id: `${id}-${n}`, label: "-", description: "-" })),
}))

/** The sections as list rows: a document mark, the name and one line under it, the status chip at the end. */
const sectionsOf = (sections: ReadonlyArray<DossierSectionView>): ReadonlyArray<ListBoxSection> =>
    sections.map((section) => ({
        id: section.id,
        label: section.title,
        items: section.rows.map((row) => ({
            id: row.id,
            label: row.name,
            ...(row.note === null ? {} : { description: row.note, descriptionLines: 1 as const }),
            leading: <IconTile source={nivoIconSource("document", "leading")} tone="neutral" />,
            trailing: <RowTrailing badge={row.badge} />,
        })),
    }))

/**
 * The list pane of the dossiers tab: the switch between the list and the map, the figures of the whole set, the search and the
 * dossiers under their categories. The switch is one set of tabs (it changes the view, not a filter); while the first reads wait
 * every region of the pane draws its skeleton together.
 */
export const DossierList = (props: DossierListProps) => {
    const { view, copy } = props
    const sections = "items" in view.slot ? view.slot.items : []
    return (
        <Stack gap="row">
            <Tabs
                label={copy.viewsLabel}
                selectedKey={props.mode}
                onSelect={(key) => props.onMode(key === "map" ? "map" : "list")}
                items={[
                    { id: "list", label: copy.viewList },
                    { id: "map", label: copy.viewMap },
                ]}
                inset="none"
            />
            <Section
                kind="figures"
                ariaLabel={copy.figuresLabel}
                isLoading={props.isWaiting}
                items={view.figures.map((figure) => ({ id: figure.id, term: figure.label, value: figure.value }))}
            />
            <FilterGroup
                search={{
                    label: copy.searchLabel,
                    placeholder: copy.searchLabel,
                    clearLabel: copy.clearSearch,
                    value: view.query,
                    onChange: props.onQuery,
                }}
                isLoading={props.isWaiting}
            />
            <ListBox
                label={copy.listLabel}
                selectionMode="single"
                selectionIndicator="none"
                selectedIds={view.selectedId === null ? [] : [view.selectedId]}
                onAction={props.onSelect}
                isLoading={props.isWaiting}
                emptyContent={
                    <EmptyNotice
                        message={copy.noMatchTitle}
                        description={copy.noMatchBody}
                        actionLabel={copy.clearFilters}
                        onAction={() => props.onQuery("")}
                    />
                }
                sections={props.isWaiting ? PLACEHOLDER : sectionsOf(sections)}
            />
        </Stack>
    )
}
