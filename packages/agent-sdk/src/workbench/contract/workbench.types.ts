import type { ComponentType } from "react"
import type {
    WorkbenchActionDefinition,
    WorkbenchBlockDefinition,
    WorkbenchReadDefinition,
    WorkbenchSpecDocument,
} from "../spec/spec.types"

/** One view of a workbench: a tab of its route (`?tab=<id>`), its label key in the module's namespace and who may open it. */
export interface WorkbenchViewDefinition {
    readonly id: string
    /** The message key of the tab label, in the module's namespace. */
    readonly labelKey: string
    /** The permission a viewer needs to see the tab; every viewer of the module when absent. */
    readonly permission?: string
}

/** What the host's workbench route hands a module: the instance, the deep link and the tab labels it resolved on the server. */
export interface WorkbenchRouteProps {
    readonly installationId: string
    /** `?tab=`: a view id, anything else opens the first view. */
    readonly tab: string | null
    /** `?focus=`: a record or decision the workbench opens on, when the module supports it. */
    readonly focus: string | null
    /** The label of each view, by view id, in the viewer's locale. */
    readonly viewLabels: Readonly<Record<string, string>>
}

/**
 * How a workbench draws by default. `component` is code: a React component composed only from Grammar components, SDK blocks and the
 * module's own Grammar-only components (the escape hatch for a screen no block expresses), reaching data only through the host. `spec`
 * is data: the module's default spec document, drawn by the SDK renderer. A published spec version in the host's database overrides
 * either for one installation.
 */
export type WorkbenchRender =
    | { readonly kind: "component"; readonly Component: ComponentType<WorkbenchRouteProps> }
    | { readonly kind: "spec"; readonly document: WorkbenchSpecDocument }

/** What a module declares about its workbench, without how it draws: the registry lists it, the host checks it. */
export interface WorkbenchDeclaration {
    /** The workbench key of the module's catalogue entry (`template.workbench`). */
    readonly key: string
    /** The message namespace the module's words live in. */
    readonly namespace: string
    /** The views, in strip order; the first is the default. */
    readonly views: readonly [WorkbenchViewDefinition, ...WorkbenchViewDefinition[]]
    /** Every permission the module checks; the host maps each to its own roles. */
    readonly permissions: ReadonlyArray<string>
    /** Every host operation the module runs; the host refuses any other for this module. */
    readonly operations: ReadonlyArray<string>
    /** What the module offers a spec: its reviewed blocks and the reads and actions a spec may bind; nothing when absent. */
    readonly exposes?: {
        readonly blocks: ReadonlyArray<WorkbenchBlockDefinition>
        readonly reads: ReadonlyArray<WorkbenchReadDefinition>
        readonly actions: ReadonlyArray<WorkbenchActionDefinition>
    }
}

/** A declaration and how it draws: what the workbench route mounts. */
export interface WorkbenchModule extends WorkbenchDeclaration {
    readonly render: WorkbenchRender
}

/** The codes a workbench registration is refused with. */
export type WorkbenchProblemCode =
    | "WORKBENCH_KEY_DUPLICATE"
    | "WORKBENCH_VIEW_DUPLICATE"
    | "WORKBENCH_PERMISSION_UNDECLARED"
    | "WORKBENCH_SPEC_FOREIGN"
    | "WORKBENCH_EXPOSES_UNDECLARED"

/** Why a workbench registration was refused, and where. */
export interface WorkbenchProblem {
    readonly code: WorkbenchProblemCode
    readonly at: string
}
