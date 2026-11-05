import type { ReactNode } from "react"
import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import { Badge, Button, Cluster, ListBox, Stack, Text } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { chosenRow, moreStateOf, selectionOf } from "../../rows/rows"
import type { RecordRow } from "../../rows/rows"

/** The words around the rows of a selectable list. */
export interface SelectableRowsWords {
    /** Names the list for assistive technology. */
    readonly label: string
    /** The command that loads the next page. */
    readonly loadMore: string
    /** What a failed page load says. */
    readonly loadFailed: string
    /** The command that tries the failed page again. */
    readonly retry: string
}

/** What a selectable list takes. */
interface SelectableRowsProps {
    readonly rows: ReadonlyArray<RecordRow>
    readonly words: SelectableRowsWords
    /** The id of the chosen row, from the selection param. */
    readonly selected: string | null
    /** The first read has no data yet: the rows draw as geometry. */
    readonly isLoading: boolean
    /** The paging of the read; null when it is not paged. */
    readonly page: ReadPage | null
    readonly onChoose: (id: string) => void
}

/** The row of the Grammar list for one record: its title, its line and its badge. */
const itemOf = (row: RecordRow): ListBoxItem => ({
    id: row.id,
    label: row.title,
    ...(row.description === "" ? {} : { description: row.description }),
    ...(row.badge === "" ? {} : { trailing: <Badge tone="neutral">{row.badge}</Badge> }),
})

/** What the paging control takes. */
interface LoadMoreProps {
    readonly page: ReadPage
    readonly words: SelectableRowsWords
}

/** The control under the rows that loads the next page, with the line and the retry of a failed load. */
const LoadMore = (props: LoadMoreProps): ReactNode => {
    const state = moreStateOf(props.page)
    if (state === "none") return null
    return (
        <Cluster gap="inline" align="center">
            {state === "failed" ? (
                <Text size="sm" tone="muted">
                    {props.words.loadFailed}
                </Text>
            ) : null}
            <Button intent="neutral" size="sm" isPending={state === "loading"} onPress={props.page.loadMore}>
                {state === "failed" ? props.words.retry : props.words.loadMore}
            </Button>
        </Cluster>
    )
}

/** Rows to choose from: one is marked by the selection param, a press writes it, and the next page loads on request. */
export const SelectableRows = (props: SelectableRowsProps): ReactNode => (
    <Stack gap="row">
        <ListBox
            label={props.words.label}
            items={props.rows.map(itemOf)}
            selectionMode="single"
            selectionIndicator="none"
            selectedIds={selectionOf(props.selected)}
            onSelectionChange={(ids) => {
                const id = chosenRow(ids)
                if (id !== null) props.onChoose(id)
            }}
            isLoading={props.isLoading}
        />
        {props.page === null ? null : <LoadMore page={props.page} words={props.words} />}
    </Stack>
)
