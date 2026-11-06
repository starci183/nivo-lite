import { useMemo } from "react"
import type { ReactNode } from "react"
import { Alert, EmptyNotice, Stack } from "@starci/grammar/common"
import type { ActionDefinition, ReadDefinition } from "../../block/block.types"
import type { PlanNode, RenderPlan } from "../../spec/render-plan"
import { renderPlan, viewOf } from "../../spec/render-plan"
import { paramHandleOf } from "../../spec/spec-param"
import type { SpecProblem, StoredSpec } from "../../spec/spec.types"
import {
    ModuleNamespaceProvider,
    useInstalledBlocks,
    useRegistryCheck,
    useWorkbenchHost,
} from "../host/WorkbenchHostProvider"
import { PageFrame } from "./PageFrame"
import { PrimaryCommand } from "./PrimaryCommand"
import type { SpecContext } from "./renderer.types"
import { SpecNode } from "./SpecNode"
import { chromeOf, paneOf } from "./view-chrome"
import type { ViewChrome } from "./view-chrome"
import { ViewBody } from "./ViewBody"

/** What the route gives the workbench. */
export interface WorkbenchRoute {
    readonly installationId: string
    /** `?tab=`: a view id; anything else opens the first visible view. */
    readonly tab: string | null
}

/** What the spec renderer takes. */
export interface SpecWorkbenchProps {
    /** The published spec. Checked again against the installed blocks before it is drawn. */
    readonly spec: StoredSpec
    /** The module seeded default, drawn when `spec` is no longer valid against the installed blocks. */
    readonly fallback: StoredSpec | null
    readonly reads: ReadonlyArray<ReadDefinition>
    readonly actions: ReadonlyArray<ActionDefinition>
    /** The permissions the module declares. */
    readonly permissions: ReadonlyArray<string>
    /** The message namespace of the module. */
    readonly namespace: string
    readonly route: WorkbenchRoute
    /** Whether the viewer may manage the workbench: they see the alert that names the problems. */
    readonly canManage: boolean
}

/** The plan to draw, what its views declare beyond their trees, and the problems of the published spec. */
interface Chosen {
    readonly plan: RenderPlan
    readonly chrome: ReadonlyArray<ViewChrome>
    readonly problems: ReadonlyArray<SpecProblem>
}

const panelId = (id: string): string => `workbench-panel-${id}`

/** What a region of nodes takes. */
interface NodesProps {
    readonly nodes: ReadonlyArray<PlanNode>
    readonly context: SpecContext
}

/** The nodes of one region, drawn in order. */
const Nodes = (props: NodesProps): ReactNode =>
    props.nodes.map((node) => <SpecNode key={node.id} node={node} context={props.context} />)

/** The problems as one line of codes. */
const codesOf = (problems: ReadonlyArray<SpecProblem>): string =>
    problems.map((problem) => `${problem.code} @ ${problem.at}`).join(", ")

/** The plan to draw: the spec when sound, else the fallback when sound, else the spec problems. */
const chooseOf = (
    spec: StoredSpec,
    primary: RenderPlan,
    fallback: StoredSpec | null,
    backup: RenderPlan | null,
): Chosen => {
    if (primary.ok) return { plan: primary, chrome: chromeOf(spec), problems: [] }
    if (fallback !== null && backup?.ok === true)
        return { plan: backup, chrome: chromeOf(fallback), problems: primary.problems }
    return { plan: primary, chrome: [], problems: primary.problems }
}

/** The workbench of a spec, once the bundle is known to be the back end's. */
const DrawnWorkbench = (props: SpecWorkbenchProps): ReactNode => {
    const host = useWorkbenchHost()
    const text = host.block.text("blocks")
    const renderers = useInstalledBlocks()
    const { reads, actions, permissions } = props
    const { plan, chrome, problems } = useMemo(() => {
        const blocks = renderers.map((renderer) => renderer.block)
        const bindings = { reads, actions, permissions }
        return chooseOf(
            props.spec,
            renderPlan(props.spec, blocks, bindings),
            props.fallback,
            props.fallback === null ? null : renderPlan(props.fallback, blocks, bindings),
        )
    }, [props.spec, props.fallback, renderers, reads, actions, permissions])
    if (!plan.ok) return <EmptyNotice message={text({ key: "renderer.noView" })} description={codesOf(plan.problems)} />
    const navigation = host.block.navigation
    const params = paramHandleOf({
        params: plan.params,
        reads,
        queryValue: navigation.queryValue,
        setQueryValues: navigation.setQueryValues,
    })
    const context: SpecContext = {
        renderers: new Map(renderers.map((renderer) => [renderer.id, renderer])),
        reads,
        actions,
        namespace: props.namespace,
        installationId: props.route.installationId,
        params,
        pane: "pane" in plan.params ? paneOf(params.value("pane")) : null,
    }
    const view = viewOf(plan.views, navigation.queryValue("tab") ?? props.route.tab, navigation.queryValue)
    return (
        <PageFrame
            views={plan.views}
            chrome={chrome}
            reads={reads}
            namespace={props.namespace}
            installationId={props.route.installationId}
            params={params}
            selected={view?.id}
            panelId={panelId}
            onSelect={(key) => navigation.setQueryValue("tab", key)}
            actions={
                <PrimaryCommand
                    command={chrome.find((candidate) => candidate.id === view?.id)?.command}
                    actions={actions}
                    namespace={props.namespace}
                />
            }
        >
            <Stack gap="region">
                {problems.length > 0 && props.canManage ? (
                    <Alert
                        tone="cautionary"
                        title={text({ key: "renderer.problems" })}
                        description={codesOf(problems)}
                    />
                ) : null}
                <Nodes nodes={plan.head} context={context} />
                <ViewBody
                    view={view}
                    aside={plan.aside}
                    asideSummary={plan.asideSummary}
                    context={context}
                    reads={reads}
                    panelId={panelId}
                />
                <Nodes nodes={plan.foot} context={context} />
            </Stack>
        </PageFrame>
    )
}

/**
 * Draws a workbench from a spec: the head, the tabs of the visible views with the chosen view tree, and the foot, with the blocks
 * the host provider installed. An invalid spec falls back to the seeded default with an alert for those who manage it; with no
 * valid default it says so, never a blank page. When the back end serves another registry hash than the one this bundle was built
 * with, nothing is drawn: a notice offers to reload.
 */
export const SpecWorkbench = (props: SpecWorkbenchProps): ReactNode => {
    const registry = useRegistryCheck()
    if (registry !== null && registry.built !== registry.served)
        return <EmptyNotice message={registry.message} actionLabel={registry.reloadLabel} onAction={registry.reload} />
    return (
        <ModuleNamespaceProvider namespace={props.namespace}>
            <DrawnWorkbench {...props} />
        </ModuleNamespaceProvider>
    )
}
