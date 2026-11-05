import { Badge, EmptyNotice, ListBox, SearchField, Select, Stack, Tabs } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { KnowledgeDocMark } from "@/components/composites/KnowledgeDocMark"
import type { DocListCopy, DocListFace, DocRowView } from "@/modules/types"

/** The same row geometry while the first read has no data: a name, a line and a chip. */
const DOC_ROWS_PLACEHOLDER: ReadonlyArray<DocRowView> = [1, 2, 3, 4, 5].map((n) => ({
    id: `placeholder-${n}`,
    title: "-",
    line: "-",
    glyph: "file",
    chip: { label: "-", tone: "neutral" },
}))

/** What the list pane draws and calls. */
interface KnowledgeDocListProps {
    readonly list: DocListFace
    readonly copy: DocListCopy
    /** The page's first read has no data yet: every control and row draws its skeleton at once. */
    readonly isWaiting: boolean
    readonly onSelect: (id: string) => void
    readonly onSearch: (value: string) => void
    readonly onTab: (id: string) => void
    readonly onModule?: (value: string | null) => void
    readonly onClear: () => void
    /** The way to add the first document; absent where adding is not offered (the base knowledge, a reader who may not write). */
    readonly onAdd?: () => void
    readonly onRetry: () => void
}

/** The rows as list items: the mark, the name with its line, the chip at the end. */
const itemsOf = (rows: ReadonlyArray<DocRowView>): ReadonlyArray<ListBoxItem> =>
    rows.map((row) => ({
        id: row.id,
        label: row.title,
        description: row.line,
        leading: <KnowledgeDocMark glyph={row.glyph} />,
        trailing: row.chip === null ? undefined : <Badge tone={row.chip.tone}>{row.chip.label}</Badge>,
    }))

/**
 * The list pane: the search over the underline filter tabs with their counts, the agent the documents are for, then one row per
 * document. While the first read waits every control and row draws its skeleton; a failed read is the danger band with its retry; an
 * empty library invites the first document, and a filter that matched nothing offers to clear it.
 */
export const KnowledgeDocList = (props: KnowledgeDocListProps) => {
    const { list, copy, isWaiting } = props
    return (
        <Stack gap="row">
            <SearchField
                label={copy.searchLabel}
                isLabelHidden
                isLoading={isWaiting}
                placeholder={copy.searchPlaceholder}
                clearLabel={copy.clearSearch}
                value={list.query}
                onValueChange={props.onSearch}
                onClear={() => props.onSearch("")}
            />
            <Tabs
                label={copy.tabsLabel}
                kind="filter"
                inset="none"
                labelVisibility="always"
                selectedKey={list.tab}
                moreLabel={copy.moreFilters}
                items={list.tabs.map((tab) => ({
                    id: tab.id,
                    label: tab.label,
                    ...(tab.count === undefined || isWaiting ? {} : { count: tab.count }),
                }))}
                onSelect={props.onTab}
            />
            {list.moduleOptions === undefined ||
            copy.moduleLabel === undefined ||
            props.onModule === undefined ? null : (
                <Select
                    label={copy.moduleLabel}
                    isLabelHidden
                    name="module"
                    isLoading={isWaiting}
                    options={list.moduleOptions}
                    placeholder={copy.modulePlaceholder ?? ""}
                    value={list.module ?? ""}
                    onValueChange={props.onModule}
                />
            )}
            <SlotView
                slot={list.slot}
                placeholder={DOC_ROWS_PLACEHOLDER}
                labels={list.slotLabels}
                errorDescription={copy.errorBody}
                emptyDescription={copy.emptyBody}
                {...(props.onAdd === undefined
                    ? {}
                    : { emptyAction: { label: copy.emptyAction, onAction: props.onAdd } })}
                errorLayout="band"
                onRetry={props.onRetry}
                render={(rows, isLoading) => (
                    <ListBox
                        label={copy.listLabel}
                        selectionMode="single"
                        selectionIndicator="none"
                        selectedIds={list.selectedId === null ? [] : [list.selectedId]}
                        onAction={props.onSelect}
                        isLoading={isWaiting || isLoading}
                        items={[...itemsOf(rows)]}
                        emptyContent={
                            <EmptyNotice
                                message={copy.noMatchTitle}
                                description={copy.noMatchBody}
                                actionLabel={copy.clearFilters}
                                onAction={props.onClear}
                            />
                        }
                    />
                )}
            />
        </Stack>
    )
}
