"use client"

import { Badge, DescriptionList, EmptyNotice, Grid, Stack, SurfaceCard, Tabs } from "@starci/grammar/common"
import type { GapRole, ListRowData } from "@starci/grammar/common"
import type { ComponentType, ReactNode } from "react"
import { FiguresStrip } from "../blocks/FiguresStrip"
import { SettingsSection } from "../blocks/SettingsSection"
import { SlotView } from "../blocks/SlotView"
import { WaitingRegion } from "../blocks/WaitingRegion"
import { WorkbenchDashboardCards } from "../blocks/WorkbenchDashboardCards"
import { WorkbenchExplanation } from "../blocks/WorkbenchExplanation"
import type { WorkbenchDeclaration, WorkbenchRouteProps } from "../contract/workbench.types"
import type { WorkbenchShellState } from "../host/host.types"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import { mapSlot, slotOfRead } from "../slot/slot"
import type { DataSlot } from "../slot/slot.types"
import { isSpecText, textOf, valueAt, variablesOf, wordsOf } from "./spec"
import type {
    WorkbenchSpecDocument,
    WorkbenchSpecNode,
    WorkbenchSpecReadBinding,
    WorkbenchSpecRegistry,
    WorkbenchSpecText,
    WorkbenchSpecValue,
} from "./spec.types"

/** What every node of one drawn spec shares. */
interface SpecContext {
    readonly registry: WorkbenchSpecRegistry
    readonly namespace: string
    readonly installationId: string
    readonly shell: WorkbenchShellState<string>
    /** The renderers of the reviewed module blocks, by block name; the SDK draws its own. */
    readonly moduleBlocks: Readonly<Record<string, ComponentType<SpecBlockProps>>>
}

/** What a renderer of one block receives: its node and the context of the spec. */
export interface SpecBlockProps {
    readonly node: WorkbenchSpecNode
    readonly context: SpecContext
}

const panelId = (id: string): string => `agent-dashboard-panel-${id}`

/** The text of a prop, or an empty text when the prop is not a text. */
const textProp = (value: WorkbenchSpecValue | undefined): WorkbenchSpecText =>
    isSpecText(value) ? value : { vi: "", en: "" }

/** The gap a stack names; the validator admits only these, so anything else is the widest. */
const gapOf = (value: WorkbenchSpecValue | undefined): GapRole => {
    switch (value) {
        case "identity":
        case "inline":
        case "row":
        case "section":
            return value
        default:
            return "region"
    }
}

/** A string prop, or empty. */
const stringProp = (value: WorkbenchSpecValue | undefined): string => (typeof value === "string" ? value : "")

/** The words of one node's texts in the viewer's language. */
const useWords = (context: SpecContext): ((value: WorkbenchSpecValue | undefined) => string) => {
    const host = useWorkbenchHost()
    const t = host.i18n.useText(context.namespace)
    const locale = host.i18n.useLocale()
    return (value) => wordsOf(textProp(value), t, locale)
}

/** One read binding through the host, folded into a slot of the bound data, with its retry. */
const useBoundRead = (
    context: SpecContext,
    binding: WorkbenchSpecReadBinding | undefined,
    failure: string,
): { readonly slot: DataSlot<unknown>; readonly retry: () => void } => {
    const host = useWorkbenchHost()
    const read = binding === undefined ? undefined : context.registry.reads[binding.read]
    const query = host.data.useNamedQuery(
        read?.operation ?? "",
        read === undefined ? null : variablesOf(read.variables, context.installationId),
    )
    return {
        slot: mapSlot(slotOfRead(query, host.data.isForbidden), (data) => valueAt(data, binding?.path)),
        retry: (): void => {
            query.reload().catch(() => host.feedback.notify("danger", failure))
        },
    }
}

/** The read binding of a slot of a node, when it is one. */
const readBindingOf = (node: WorkbenchSpecNode, slot: string): WorkbenchSpecReadBinding | undefined => {
    const binding = node.bind?.[slot]
    return binding !== undefined && "read" in binding ? binding : undefined
}

/** The pairs of the term-and-path children of a figures or detail node, read from one record. */
const pairsOf = (
    node: WorkbenchSpecNode,
    record: unknown,
    words: (value: WorkbenchSpecValue | undefined) => string,
): ReadonlyArray<{ readonly id: string; readonly term: string; readonly value: string }> =>
    (node.children ?? []).map((child) => ({
        id: child.id,
        term: words(child.props?.term),
        value: textOf(valueAt(record, stringProp(child.props?.path))),
    }))

/** A strip of figures over one bound record. */
const FiguresBlock = (props: SpecBlockProps): ReactNode => {
    const words = useWords(props.context)
    const label = words(props.node.props?.label)
    const labels = useWorkbenchHost().i18n.useSlotWords()(label)
    const read = useBoundRead(props.context, readBindingOf(props.node, "data"), labels.error)
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <FiguresStrip label={label} items={pairsOf(props.node, record, words)} isLoading={isLoading} />
            )}
        />
    )
}

/** The facts of one bound record. */
const DetailBlock = (props: SpecBlockProps): ReactNode => {
    const words = useWords(props.context)
    const label = words(props.node.props?.label)
    const labels = useWorkbenchHost().i18n.useSlotWords()(label)
    const read = useBoundRead(props.context, readBindingOf(props.node, "data"), labels.error)
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <SurfaceCard label={label} headingLevel={2} isLoading={isLoading}>
                    <DescriptionList
                        layout="columns"
                        isDivided
                        items={pairsOf(props.node, record, words).map((pair) => ({
                            id: pair.id,
                            term: pair.term,
                            description: pair.value,
                        }))}
                    />
                </SurfaceCard>
            )}
        />
    )
}

/** The row of a list block from one record; a record without a text id draws no row. */
const rowOf = (
    node: WorkbenchSpecNode,
    record: unknown,
    open: ((id: string) => void) | null,
    openLabel: string,
): ReadonlyArray<ListRowData> => {
    const id = textOf(valueAt(record, stringProp(node.props?.idPath)))
    if (id === "") return []
    const badge = textOf(valueAt(record, stringProp(node.props?.badgePath)))
    const row: ListRowData = {
        id,
        title: textOf(valueAt(record, stringProp(node.props?.titlePath))),
        description: textOf(valueAt(record, stringProp(node.props?.descriptionPath))),
        ...(badge === "" ? {} : { trailing: <Badge tone="neutral">{badge}</Badge> }),
        ...(open === null ? {} : { action: { label: openLabel, press: () => open(id) } }),
    }
    return [row]
}

/** A list of bound records, with an optional action on each row. */
const RecordListBlock = (props: SpecBlockProps): ReactNode => {
    const host = useWorkbenchHost()
    const words = useWords(props.context)
    const empty = words(props.node.props?.empty)
    const labels = host.i18n.useSlotWords()(empty)
    const read = useBoundRead(props.context, readBindingOf(props.node, "rows"), labels.error)
    const openBinding = props.node.bind?.open
    const action =
        openBinding !== undefined && "action" in openBinding
            ? props.context.registry.actions[openBinding.action]
            : undefined
    const command = host.data.useNamedCommand(action?.operation ?? "")
    const canOpen = host.permissions.useCan(action?.permission ?? "")
    const open =
        action === undefined || !canOpen
            ? null
            : (id: string): void => {
                  command.run({ id }).catch(() => host.feedback.notify("danger", labels.error))
              }
    const label = words(props.node.props?.label)
    return (
        <SlotView
            slot={read.slot}
            labels={labels}
            placeholder={[]}
            onRetry={read.retry}
            render={(records, isLoading) => (
                <SurfaceCard
                    kind="list"
                    label={label}
                    headingLevel={2}
                    isLoading={isLoading}
                    items={(Array.isArray(records) ? records : []).flatMap((record: unknown) =>
                        rowOf(props.node, record, open, action === undefined ? "" : words(action.label)),
                    )}
                    empty={<EmptyNotice message={empty} />}
                />
            )}
        />
    )
}

/** The children of a node, each drawn by its own renderer. */
const Children = (props: SpecBlockProps): ReactNode =>
    (props.node.children ?? []).map((child) => <SpecNodeView key={child.id} node={child} context={props.context} />)

/** A titled section holding child blocks. */
const SectionBlock = (props: SpecBlockProps): ReactNode => {
    const words = useWords(props.context)
    const hint = props.node.props?.hint
    return (
        <SettingsSection title={words(props.node.props?.title)} {...(hint === undefined ? {} : { hint: words(hint) })}>
            <Children {...props} />
        </SettingsSection>
    )
}

/** One node: an SDK block, a reviewed module block, or nothing for a name the registry dropped since the spec was validated. */
const SpecNodeView = (props: SpecBlockProps): ReactNode => {
    const shell = props.context.shell
    switch (props.node.block) {
        case "stack":
            return (
                <Stack gap={gapOf(props.node.props?.gap)}>
                    <Children {...props} />
                </Stack>
            )
        case "card-grid":
            return (
                <Grid kind="cards">
                    <Children {...props} />
                </Grid>
            )
        case "section":
            return <SectionBlock {...props} />
        case "figures":
            return <FiguresBlock {...props} />
        case "detail":
            return <DetailBlock {...props} />
        case "record-list":
            return <RecordListBlock {...props} />
        case "waiting":
            return (
                <SlotView
                    {...shell.regions.waiting}
                    onRetry={shell.retryDashboard}
                    render={(waiting, isLoading) => (
                        <WaitingRegion label={shell.regions.waiting.label} view={waiting} isLoading={isLoading} />
                    )}
                />
            )
        case "dashboard-cards":
            return <WorkbenchDashboardCards regions={shell.regions} onRetry={shell.retryDashboard} />
        default: {
            const Block = props.context.moduleBlocks[props.node.block]
            return Block === undefined ? null : <Block {...props} />
        }
    }
}

/** What the spec renderer draws: one module's workbench from a published spec version. */
export interface SpecWorkbenchProps {
    readonly declaration: WorkbenchDeclaration
    /** A published version's document, validated against the same registry when it was saved and again before it is drawn. */
    readonly document: WorkbenchSpecDocument
    readonly registry: WorkbenchSpecRegistry
    readonly moduleBlocks: Readonly<Record<string, ComponentType<SpecBlockProps>>>
    readonly route: WorkbenchRouteProps
}

/**
 * Draws a workbench from data: the tabs of the spec's views with the chosen view's block tree, and the explanation shape while the why
 * pane is open. Every block is code of the registry; the spec only arranges and binds them.
 */
export const SpecWorkbench = (props: SpecWorkbenchProps): ReactNode => {
    const host = useWorkbenchHost()
    const t = host.i18n.useText(props.declaration.namespace)
    const locale = host.i18n.useLocale()
    const [first = "", ...rest] = props.document.views.map((view) => view.id)
    const shell = host.shell.useShell({
        module: props.declaration.key,
        installationId: props.route.installationId,
        tabs: [first, ...rest],
        initialTab: props.route.tab,
    })
    if (!shell.isNormal)
        return (
            <WorkbenchExplanation
                why={shell.why}
                regions={shell.regions}
                onClose={shell.closeWhy}
                onRetry={shell.retryDashboard}
            />
        )
    const view = props.document.views.find((candidate) => candidate.id === shell.selectedTab)
    const context: SpecContext = {
        registry: props.registry,
        namespace: props.declaration.namespace,
        installationId: props.route.installationId,
        shell,
        moduleBlocks: props.moduleBlocks,
    }
    return (
        <Stack gap="region">
            <Tabs
                label={shell.tabsLabel}
                selectedKey={shell.selectedTab}
                inset="none"
                labelVisibility="always"
                items={props.document.views.map((candidate) => ({
                    id: candidate.id,
                    label: wordsOf(candidate.label, t, locale),
                }))}
                panelId={panelId}
                onSelect={shell.selectTab}
            />
            <div role="tabpanel" id={panelId(shell.selectedTab)}>
                {view === undefined ? null : <SpecNodeView node={view.root} context={context} />}
            </div>
        </Stack>
    )
}
