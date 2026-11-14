import { useEffect, useMemo, type ReactNode } from "react"
import { EmptyNotice, Section } from "@starci/grammar/common"
import type { ModuleDeclaration } from "../../module/declaration.types"
import { renderPlan } from "../../spec/render-plan"
import { paramHandleOf } from "../../spec/spec-param"
import { specNodeSchema } from "../../spec/spec.schema"
import type { SpecNode as SpecNodeData } from "../../spec/spec.types"
import {
    ModuleNamespaceProvider,
    WorkbenchHostProvider,
    useEnabledModules,
    useInstalledBlocks,
    useRegistryCheck,
    useWorkbenchHost,
} from "../host/WorkbenchHostProvider"
import { hostAnswering } from "./answered-host"
import type { SpecContext } from "./renderer.types"
import { SpecNode } from "./SpecNode"

/** What a node with its answer in hand takes. */
export interface AnsweredNodeProps {
    /** The module whose reads, actions and words the node binds; null when the app holds no declaration of it (a defect, reported). */
    readonly module: ModuleDeclaration | null
    /** The installation the node's reads run for. */
    readonly installationId: string
    /** The spec node as JSON text (the block, its literal props, its slots bound to the module's reads). */
    readonly nodeJson: string
    /** What the node's read answered, as JSON text: it answers every read the node binds. */
    readonly dataJson: string
    /** The screen's answer is still being read: the place keeps one row as geometry and draws no block. */
    readonly isWaiting?: boolean
}

/** The node a JSON text holds, or null when it is no JSON or no node of the spec format. */
const parsedNodeOf = (nodeJson: string): SpecNodeData | null => {
    try {
        const parsed = specNodeSchema.safeParse(JSON.parse(nodeJson))
        return parsed.success ? parsed.data : null
    } catch {
        return null
    }
}

/** Where a node that cannot be drawn is reported. */
const DEFECT = "ANSWERED_NODE_INVALID"

/**
 * Draws ONE spec node of a module with the block host of the workbench (the same installed blocks, reads and words) when a screen
 * already ran its read: the block takes its data from `dataJson`, so nothing is requested twice. A node the installed blocks refuse, or a
 * module the app does not know, draws nothing and is reported to the host. The caller sets the surface the block sits in.
 */
export const AnsweredNode = (props: AnsweredNodeProps): ReactNode => {
    const host = useWorkbenchHost()
    const blocks = useInstalledBlocks()
    const enabled = useEnabledModules()
    const registry = useRegistryCheck()
    const { module, nodeJson, dataJson, installationId } = props
    const drawn = useMemo(() => {
        const parsed = parsedNodeOf(nodeJson)
        if (module === null || parsed === null) return null
        const plan = renderPlan(
            { schema: "nivo/workbench-spec@1", module: module.key, views: [{ id: "answered", label: { key: "answered" }, root: parsed }] },
            blocks.map((renderer) => renderer.block),
            { reads: module.reads, actions: module.actions, permissions: module.permissions },
        )
        const root = plan.ok ? plan.views[0]?.root : undefined
        if (root === undefined) return null
        const operations = Object.values(parsed.bind ?? {}).flatMap((binding) => ("read" in binding ? [binding.read] : []))
        return { root, answers: Object.fromEntries(operations.map((operation) => [operation, JSON.parse(dataJson)])) }
    }, [blocks, module, nodeJson, dataJson])
    const answering = useMemo(() => (drawn === null ? host : hostAnswering(host, drawn.answers)), [host, drawn])
    const isDefect = module === null || drawn === null
    useEffect(() => {
        if (isDefect) host.block.report(DEFECT, installationId)
    }, [isDefect, host, installationId])
    if (props.isWaiting === true)
        return <Section kind="list" ariaLabel=" " isLoading items={[{ id: "waiting", title: " " }]} empty={<EmptyNotice message=" " />} />
    if (module === null || drawn === null) return null
    const context: SpecContext = {
        renderers: new Map(blocks.map((renderer) => [renderer.id, renderer])),
        reads: module.reads,
        actions: module.actions,
        namespace: module.namespace,
        installationId,
        params: paramHandleOf({
            params: {},
            reads: module.reads,
            queryValue: host.block.navigation.queryValue,
            setQueryValues: host.block.navigation.setQueryValues,
        }),
        pane: null,
    }
    return (
        <WorkbenchHostProvider host={answering} blocks={blocks} enabled={enabled} registry={registry}>
            <ModuleNamespaceProvider namespace={module.namespace}>
                <SpecNode node={drawn.root} context={context} />
            </ModuleNamespaceProvider>
        </WorkbenchHostProvider>
    )
}
