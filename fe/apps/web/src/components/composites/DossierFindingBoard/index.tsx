import { Alert, Button, Divider, EmptyNotice, Stack, Tabs, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { DossierFindingCard } from "@/components/branches/DossierFindingCard"
import type { DossierFindingsPane, FindingAction, FindingRowView } from "@/hooks/brain"

export type { DossierFindingsPane, FindingAction } from "@/hooks/brain"

/** The words of the board that the findings pane does not carry. */
interface DossierFindingBoardCopy {
    /** The line over the filter: when the dossier was reviewed and how many documents it holds. */
    readonly statusLine: string
    readonly findingOptions: string
    readonly emptyLabel: string
    /** The name of the "+n" menu that holds the filter tabs that do not fit. */
    readonly filtersMore: string
}

/** What the board of the open dossier's findings says and calls. */
interface DossierFindingBoardProps {
    readonly pane: DossierFindingsPane
    /** The first reads have no data yet: the words that come from data draw as geometry. */
    readonly isLoading: boolean
    readonly copy: DossierFindingBoardCopy
    readonly onFilter: (value: string) => void
    readonly onAction: (findingId: string, action: FindingAction) => void
    readonly onLoadMore: () => void
    readonly onRetry: () => void
}

/** Rows of the same shape as a ready board, drawn as geometry while the findings are read. */
const PLACEHOLDER: ReadonlyArray<FindingRowView> = ["a", "b"].map((id) => ({
    id,
    title: "-",
    titleHref: null,
    detail: "-",
    badges: [{ id: "severity", label: "-", tone: "neutral" }],
    meta: null,
    isFocused: false,
    evidenceTitle: "-",
    evidence: [],
    sources: [],
    actions: [],
    open: [],
    menu: [],
}))

/** The paging of the board: the failed page with its retry, or the command that reads the next one. */
const More = (props: Pick<DossierFindingBoardProps, "pane" | "onLoadMore" | "onRetry">) => {
    const frame = props.pane.frame
    if (frame.pageFailure !== null)
        return (
            <Alert
                tone="negative"
                title={frame.pageFailure}
                action={{ label: frame.retryLabel, onAction: props.onRetry }}
            />
        )
    return frame.hasNextPage ? (
        <Button intent="neutral" isPending={frame.isLoadingMore} onPress={props.onLoadMore}>
            {frame.loadMoreLabel}
        </Button>
    ) : null
}

/**
 * The findings of the open dossier as the body of its pane: when it was last reviewed, the notice about the AI pass, the filter
 * (underline tabs with their counts, because it narrows this one list), then each finding as a flat block under a rule. No
 * section sits inside another and the dossier's name is not repeated: the head band above carries it.
 */
export const DossierFindingBoard = (props: DossierFindingBoardProps) => {
    const view = props.pane
    return (
        <Stack gap="section">
            <Text tone="muted" isLoading={props.isLoading}>
                {view.frame.isRunning ? view.frame.runningLabel : props.copy.statusLine}
            </Text>
            {view.frame.aiNotice === null ? null : <Alert tone="cautionary" title={view.frame.aiNotice} />}
            <Tabs
                kind="filter"
                label={view.filterLabel}
                selectedKey={view.filter}
                onSelect={props.onFilter}
                moreLabel={(count) => props.copy.filtersMore.replace("{count}", String(count))}
                items={view.filters.map((one) => ({
                    id: one.value,
                    label: one.label,
                    ...(one.count === undefined ? {} : { count: one.count }),
                }))}
            />
            <SlotView
                slot={view.slot}
                placeholder={PLACEHOLDER}
                labels={view.slotLabels}
                onRetry={props.onRetry}
                render={(rows, isLoading) =>
                    rows.length === 0 ? (
                        <EmptyNotice message={props.copy.emptyLabel} />
                    ) : (
                        <Stack gap="section">
                            {rows.map((row, index) => (
                                <Stack key={row.id} gap="section">
                                    {index === 0 ? null : <Divider />}
                                    <DossierFindingCard
                                        row={row}
                                        isLoading={isLoading || props.isLoading}
                                        optionsLabel={props.copy.findingOptions}
                                        onAction={props.onAction}
                                    />
                                </Stack>
                            ))}
                        </Stack>
                    )
                }
            />
            <More pane={props.pane} onLoadMore={props.onLoadMore} onRetry={props.onRetry} />
        </Stack>
    )
}
