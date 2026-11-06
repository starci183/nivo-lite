import type { ReactNode } from "react"
import type { ReadDefinition } from "../../block/block.types"
import type { PlanNode, PlanView } from "../../spec/render-plan"
import type { SpecAsideSummary } from "../../spec/spec.types"
import { AsideFrame } from "./AsideFrame"
import type { SpecContext } from "./renderer.types"
import { SpecNode } from "./SpecNode"
import { isAsidePane } from "./view-chrome"
import { ViewGate } from "./ViewGate"

/** What the body of the open view takes. */
export interface ViewBodyProps {
    /** The open view; undefined when no view is open. */
    readonly view: PlanView | undefined
    /** The region at the right of every view; null when the spec has none. */
    readonly aside: PlanNode | null
    /** What a phone shows of the aside on the main pane. */
    readonly asideSummary: SpecAsideSummary | null
    readonly context: SpecContext
    readonly reads: ReadonlyArray<ReadDefinition>
    /** The id of the tab panel of a view. */
    readonly panelId: (id: string) => string
}

/**
 * The open view's tree in its tab panel and, when the spec has an aside, the aside beside it: the aside is its own region with its
 * own first load, and stays while the view changes.
 */
export const ViewBody = (props: ViewBodyProps): ReactNode => {
    const { view, context } = props
    const main = (
        <div role="tabpanel" id={props.panelId(view?.id ?? "none")}>
            {view === undefined ? null : (
                <ViewGate key={view.id}>
                    <SpecNode node={view.root} context={context} />
                </ViewGate>
            )}
        </div>
    )
    const aside = props.aside
    if (aside === null) return main
    return (
        <AsideFrame
            summary={props.asideSummary}
            reads={props.reads}
            namespace={context.namespace}
            installationId={context.installationId}
            params={context.params}
            isAsideShown={isAsidePane(context.params.value("pane"))}
            main={main}
            aside={
                <ViewGate>
                    <SpecNode node={aside} context={context} />
                </ViewGate>
            }
        />
    )
}
