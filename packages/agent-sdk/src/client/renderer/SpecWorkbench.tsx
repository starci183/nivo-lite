"use client"

import { useMemo } from "react"
import type { ReactNode } from "react"
import { Alert, EmptyNotice, Stack, Tabs } from "@starci/grammar/common"
import type { ActionDefinition, ReadDefinition } from "../../block/block.types"
import { wordsOf } from "../../schema/namespaced"
import type { PlanNode, RenderPlan } from "../../spec/render-plan"
import { renderPlan, viewOf } from "../../spec/render-plan"
import { paramHandleOf } from "../../spec/spec-param"
import type { SpecProblem, StoredSpec } from "../../spec/spec.types"
import { useWorkbenchHost } from "../host/WorkbenchHostProvider"
import type { BlockRenderer } from "./define-renderer"
import type { SpecContext } from "./renderer.types"
import { SpecNode } from "./SpecNode"

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
    /** The installed blocks with their components: `[...coreRenderers, ...]`. */
    readonly renderers: ReadonlyArray<BlockRenderer>
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

/** The plan to draw and the problems of the published spec. */
interface Chosen {
    readonly plan: RenderPlan
    readonly problems: ReadonlyArray<SpecProblem>
}

const panelId = (id: string): string => `workbench-panel-${id}`

/** The nodes of one region, drawn in order. */
const Nodes = (props: { readonly nodes: ReadonlyArray<PlanNode>; readonly context: SpecContext }): ReactNode =>
    props.nodes.map((node) => <SpecNode key={node.id} node={node} context={props.context} />)

/** The problems as one line of codes. */
const codesOf = (problems: ReadonlyArray<SpecProblem>): string =>
    problems.map((problem) => `${problem.code} @ ${problem.at}`).join(", ")

/** The plan to draw: the spec when sound, else the fallback when sound, else the spec problems. */
const chooseOf = (primary: RenderPlan, fallback: RenderPlan | null): Chosen => {
    if (primary.ok) return { plan: primary, problems: [] }
    return { plan: fallback?.ok === true ? fallback : primary, problems: primary.problems }
}

/**
 * Draws a workbench from a spec: the head, the tabs of the visible views with the chosen view tree, and the foot. An invalid spec
 * falls back to the seeded default with an alert for those who manage it; with no valid default it says so, never a blank page.
 */
export const SpecWorkbench = (props: SpecWorkbenchProps): ReactNode => {
    const host = useWorkbenchHost()
    const text = host.block.text("blocks")
    const owner = host.block.text(props.namespace)
    const { renderers, reads, actions, permissions } = props
    const { plan, problems } = useMemo(() => {
        const blocks = renderers.map((renderer) => renderer.block)
        const bindings = { reads, actions, permissions }
        return chooseOf(
            renderPlan(props.spec, blocks, bindings),
            props.fallback === null ? null : renderPlan(props.fallback, blocks, bindings),
        )
    }, [props.spec, props.fallback, renderers, reads, actions, permissions])
    if (!plan.ok) return <EmptyNotice message={text({ key: "renderer.noView" })} description={codesOf(plan.problems)} />
    const navigation = host.block.navigation
    const context: SpecContext = {
        renderers: new Map(renderers.map((renderer) => [renderer.id, renderer])),
        reads,
        actions,
        namespace: props.namespace,
        installationId: props.route.installationId,
        params: paramHandleOf({
            params: plan.params,
            reads,
            queryValue: navigation.queryValue,
            setQueryValues: navigation.setQueryValues,
        }),
    }
    const view = viewOf(plan.views, props.route.tab, navigation.queryValue)
    const locale = host.block.locale()
    return (
        <Stack gap="region">
            {problems.length > 0 && props.canManage ? (
                <Alert tone="cautionary" title={text({ key: "renderer.problems" })} description={codesOf(problems)} />
            ) : null}
            <Nodes nodes={plan.head} context={context} />
            <Tabs
                label={text({ key: "renderer.tabs" })}
                {...(view === undefined ? {} : { selectedKey: view.id })}
                inset="none"
                labelVisibility="always"
                items={plan.views
                    .filter((candidate) => !candidate.hidden)
                    .map((candidate) => ({
                        id: candidate.id,
                        label: wordsOf(candidate.label, (key) => owner({ key }), locale),
                    }))}
                panelId={panelId}
                onSelect={(key) => navigation.setQueryValue("tab", key)}
            />
            <div role="tabpanel" id={panelId(view?.id ?? "none")}>
                {view === undefined ? null : <SpecNode node={view.root} context={context} />}
            </div>
            <Nodes nodes={plan.foot} context={context} />
        </Stack>
    )
}
