import { useState } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import {
    Badge,
    Cluster,
    Code,
    Link,
    Stack,
    SurfaceCard,
    Text,
    TextAction,
    type TableRowData,
} from "@starci/grammar/common"
import type {
    DataSlot,
    NodeRightOperationView,
    ProviderRightHoldersView,
    RightHolderView,
    SlotLabels,
} from "@/modules/types"

/** The words of the Rights tab: its three groups, its filters, its columns, its chips and its empty lines. */
export interface ProviderRightsTabWords {
    readonly agentsLabel: string
    readonly screensLabel: string
    readonly triggersLabel: string
    readonly agentsHint: string
    readonly screensHint: string
    /** The note that viewing by role comes later: every member views until then. */
    readonly screensLater: string
    readonly filterLabel: string
    readonly filterAll: string
    readonly filterHeld: string
    readonly filterUnheld: string
    readonly filterWrites: string
    readonly columnRight: string
    readonly columnKind: string
    readonly columnHolders: string
    readonly columnTrigger: string
    readonly columnReceivers: string
    readonly kindRead: string
    readonly kindWrite: string
    readonly modeAuto: string
    readonly modeAsk: string
    readonly noHolder: string
    readonly notOpen: string
    readonly toolsEmpty: string
    readonly toolsFilteredEmpty: string
    readonly screensEmpty: string
    readonly triggersEmpty: string
    readonly moreRights: (count: number) => string
    readonly more: string
    readonly holderMore: (count: number) => string
}

/** The words and the read of the Rights tab of a connected account's page. */
export interface ProviderRightsTabBaseProps {
    readonly props: {
        readonly words: ProviderRightsTabWords
        readonly slot: DataSlot<ProviderRightHoldersView>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Rows a group shows before its the folded rights line line; the rest open in place. */
const ROWS_SHOWN = 7
/** Holders a row shows before its computed "+N"; the rest open in place. */
const HOLDERS_SHOWN = 2

/** The filter tabs of the agents group, in the order they stand. */
const FILTER_KEYS = ["all", "held", "unheld", "writes"] as const

type FilterKey = (typeof FILTER_KEYS)[number]

const FILTER_KEY_SET: ReadonlySet<string> = new Set(FILTER_KEYS)

/** Whether a tab key is one of the filter tabs. */
const isFilterKey = (key: string): key is FilterKey => FILTER_KEY_SET.has(key)

/** Geometry of the tab while the rights load: the same three groups, one row of each shape. */
const PLACEHOLDER: ProviderRightHoldersView = {
    counts: { all: 0, held: 0, unheld: 0, writes: 0 },
    tools: ["a", "b", "c"].map((id) => ({
        id,
        operation: { id, title: "-", endpoint: "-", isWrite: false, effectLabel: null, chip: "-" },
        isOpen: true,
        holders: [
            {
                id,
                mode: "ask" as const,
                chip: "-",
                place: {
                    agentId: id,
                    agentName: "-",
                    workflowKey: id,
                    workflowName: "-",
                    nodeKey: "-",
                    step: "-",
                    stepLabel: "-",
                    line: "-",
                    href: null,
                },
            },
        ],
        emptyLine: null,
    })),
    screens: [{ id: "a", name: "-", summary: "-", audience: "-" }],
    triggers: [{ id: "a", name: "-", summary: "-", holders: [{ id: "a", chip: "-", agentId: "a", place: null }] }],
}

/** The kind chip of an operation in words: read, write, with the provider's mark. Danger is said here, never by colour. */
const kindOf = (operation: NodeRightOperationView, words: ProviderRightsTabWords): string => {
    const head = operation.isWrite ? words.kindWrite : words.kindRead
    return operation.effectLabel === null ? head : `${head} · ${operation.effectLabel.toLowerCase()}`
}

/** The mode chip of one holder: the mode its node declares (rights.md: one mode per node, `auto | ask`). */
const modeChipOf = (holder: RightHolderView, words: ProviderRightsTabWords): string =>
    holder.mode === "auto" ? words.modeAuto : words.modeAsk

/** The title of a right with its endpoint or id under it, as one table cell. */
type RightCellProps = {
    readonly title: string | null
    readonly code: string
    readonly isMuted: boolean
    readonly isLoading: boolean
}

const RightCell = (props: RightCellProps) => {
    const muted = props.isMuted ? { tone: "muted" as const } : {}
    return (
        <Stack gap="identity">
            {props.title === null ? null : (
                <Text size="sm" {...muted} isLoading={props.isLoading}>
                    {props.title}
                </Text>
            )}
            <Cluster gap="inline">
                <Code isLoading={props.isLoading}>{props.code}</Code>
            </Cluster>
        </Stack>
    )
}

/** One holder: agent › workflow › step as a link to the step, then its mode chip. */
type HolderLineProps = {
    readonly holder: RightHolderView
    readonly words: ProviderRightsTabWords
    readonly isLoading: boolean
}

const HolderLine = (props: HolderLineProps) => {
    const { holder, words } = props
    const line = `${holder.place.agentName ?? ""} › ${holder.place.workflowName} › ${holder.place.stepLabel}`
    return (
        <Cluster gap="inline" wrap align="center">
            {holder.place.href === null || props.isLoading ? (
                <Text size="sm" isLoading={props.isLoading}>
                    {line}
                </Text>
            ) : (
                <Link href={holder.place.href} variant="plain">
                    {line}
                </Link>
            )}
            <Badge tone="neutral" isLoading={props.isLoading}>
                {modeChipOf(holder, words)}
            </Badge>
        </Cluster>
    )
}

/** The holders of one right: the first lines, then a computed "+N" that opens the rest in place; the muted line when nobody holds it. */
type HoldersCellProps = {
    readonly holders: ReadonlyArray<RightHolderView>
    readonly emptyLine: string
    readonly words: ProviderRightsTabWords
    readonly isLoading: boolean
}

const HoldersCell = (props: HoldersCellProps) => {
    const [isOpen, setIsOpen] = useState(false)
    if (props.holders.length === 0) {
        return (
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.emptyLine}
            </Text>
        )
    }
    const shown = isOpen ? props.holders : props.holders.slice(0, HOLDERS_SHOWN)
    const hidden = props.holders.length - shown.length
    return (
        <Stack gap="identity">
            {shown.map((holder) => (
                <HolderLine key={holder.id} holder={holder} words={props.words} isLoading={props.isLoading} />
            ))}
            {hidden > 0 && !props.isLoading ? (
                <TextAction appearance="muted" size="xs" onPress={() => setIsOpen(true)}>
                    {props.words.holderMore(hidden)}
                </TextAction>
            ) : null}
        </Stack>
    )
}

/** Whether a row of the agents group passes the filter tab; the tabs mean what the server counted. */
const passes = (key: FilterKey, tool: ProviderRightHoldersView["tools"][number]): boolean => {
    if (key === "held") return tool.holders.length > 0
    if (key === "unheld") return tool.holders.length === 0
    if (key === "writes") return tool.operation.isWrite
    return true
}

/** The three groups of the tab, each a card on the page ground: agents (filter tabs), screens, triggers. */
type GroupsProps = {
    readonly view: ProviderRightHoldersView
    readonly words: ProviderRightsTabWords
    readonly isLoading: boolean
}

const Groups = (props: GroupsProps) => {
    const { view, words, isLoading } = props
    const [filter, setFilter] = useState<FilterKey>("all")
    const [toolsOpen, setToolsOpen] = useState(false)
    const [screensOpen, setScreensOpen] = useState(false)
    const tools = view.tools.filter((tool) => passes(filter, tool))
    const toolsShown = toolsOpen ? tools : tools.slice(0, ROWS_SHOWN)
    const screensShown = screensOpen ? view.screens : view.screens.slice(0, ROWS_SHOWN)

    const toolRows: ReadonlyArray<TableRowData> = toolsShown.map((tool) => ({
        id: tool.id,
        cells: {
            right: (
                <RightCell
                    title={tool.operation.title}
                    code={tool.operation.endpoint ?? tool.operation.id}
                    isMuted={!tool.isOpen}
                    isLoading={isLoading}
                />
            ),
            kind: (
                <Badge tone={tool.isOpen ? "neutral" : "muted"} isLoading={isLoading}>
                    {kindOf(tool.operation, words)}
                </Badge>
            ),
            holders: tool.isOpen ? (
                <HoldersCell holders={tool.holders} emptyLine={words.noHolder} words={words} isLoading={isLoading} />
            ) : (
                <Text size="sm" tone="muted" isLoading={isLoading}>
                    {words.notOpen}
                </Text>
            ),
        },
    }))
    const screenRows: ReadonlyArray<TableRowData> = screensShown.map((screen) => ({
        id: screen.id,
        cells: {
            right: <RightCell title={screen.summary} code={screen.name} isMuted={false} isLoading={isLoading} />,
            kind: (
                <Badge tone="neutral" isLoading={isLoading}>
                    {words.kindRead}
                </Badge>
            ),
            holders: (
                <Badge tone="neutral" isLoading={isLoading}>
                    {screen.audience}
                </Badge>
            ),
        },
    }))
    const triggerRows: ReadonlyArray<TableRowData> = view.triggers.map((trigger) => ({
        id: trigger.id,
        cells: {
            trigger: <RightCell title={trigger.summary} code={trigger.name} isMuted={false} isLoading={isLoading} />,
            receivers: (
                <Cluster gap="inline" wrap>
                    {trigger.holders.map((holder) => (
                        <Cluster key={holder.id} gap="identity" wrap align="center">
                            {holder.place === null || holder.place.href === null || isLoading ? null : (
                                <Link href={holder.place.href} variant="plain">
                                    {holder.place.line}
                                </Link>
                            )}
                            <Badge tone="neutral" isLoading={isLoading}>
                                {holder.chip}
                            </Badge>
                        </Cluster>
                    ))}
                </Cluster>
            ),
        },
    }))

    const rightColumns = [
        { id: "right", label: words.columnRight, width: 380 },
        { id: "kind", label: words.columnKind, width: "fit" as const },
        { id: "holders", label: words.columnHolders, width: "fill" as const, minWidth: 360 },
    ]
    const hiddenTools = tools.length - toolsShown.length
    const hiddenScreens = view.screens.length - screensShown.length

    return (
        <Stack gap="section">
            <SurfaceCard
                kind="table"
                label={words.agentsLabel}
                count={view.counts.all}
                note={words.agentsHint}
                isLoading={isLoading}
                headers={[
                    {
                        kind: "filter",
                        label: words.filterLabel,
                        selectedKey: filter,
                        onSelect: (key) => {
                            if (isFilterKey(key)) setFilter(key)
                        },
                        items: [
                            { id: "all", label: words.filterAll, count: view.counts.all },
                            { id: "held", label: words.filterHeld, count: view.counts.held },
                            { id: "unheld", label: words.filterUnheld, count: view.counts.unheld },
                            { id: "writes", label: words.filterWrites, count: view.counts.writes },
                        ],
                    },
                ]}
                columns={rightColumns}
                rows={toolRows}
                empty={
                    <Text size="sm" tone="muted">
                        {view.tools.length === 0 ? words.toolsEmpty : words.toolsFilteredEmpty}
                    </Text>
                }
                footers={
                    hiddenTools > 0 && !isLoading
                        ? [
                              {
                                  kind: "more",
                                  label: `${words.moreRights(hiddenTools)} · ${words.more}`,
                                  press: () => setToolsOpen(true),
                              },
                          ]
                        : []
                }
            />
            <SurfaceCard
                kind="table"
                label={words.screensLabel}
                count={view.screens.length}
                note={`${words.screensHint} ${words.screensLater}`}
                isLoading={isLoading}
                columns={rightColumns}
                rows={screenRows}
                empty={
                    <Text size="sm" tone="muted">
                        {words.screensEmpty}
                    </Text>
                }
                footers={
                    hiddenScreens > 0 && !isLoading
                        ? [
                              {
                                  kind: "more",
                                  label: `${words.moreRights(hiddenScreens)} · ${words.more}`,
                                  press: () => setScreensOpen(true),
                              },
                          ]
                        : []
                }
            />
            <SurfaceCard
                kind="table"
                label={words.triggersLabel}
                count={view.triggers.length}
                isLoading={isLoading}
                columns={[
                    { id: "trigger", label: words.columnTrigger, width: 380 },
                    { id: "receivers", label: words.columnReceivers, width: "fill", minWidth: 360 },
                ]}
                rows={triggerRows}
                empty={
                    <Text size="sm" tone="muted">
                        {words.triggersEmpty}
                    </Text>
                }
            />
        </Stack>
    )
}

/**
 * The Rights tab of the provider page template (drawing `provider-rights-tab.png`, read-only: no edit, no drawer): every right of
 * the account in three cards on the pink well. rights for agents (filter tabs with the server's counts, one row per operation with
 * its kind chip and who holds it down to agent › workflow › step), rights on screens and rights over triggers. The read keeps
 * the same three-card shape while loading.
 */
export const ProviderRightsTabBase = (props: ProviderRightsTabBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view, isLoading) => <Groups view={view} words={props.props.words} isLoading={isLoading} />}
    />
)
