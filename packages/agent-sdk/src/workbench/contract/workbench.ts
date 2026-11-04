import { SdkDefinitionError } from "../../block/definition-error"
import { SDK_SPEC_BLOCKS } from "../spec/blocks"
import { specRegistryOf } from "../spec/spec"
import type { WorkbenchSpecRegistry } from "../spec/spec.types"
import type { WorkbenchDeclaration, WorkbenchModule, WorkbenchProblem } from "./workbench.types"

/** The exposed reads and actions of a declaration that claim another module or run an operation it does not declare. */
const exposureProblems = (declaration: WorkbenchDeclaration): ReadonlyArray<WorkbenchProblem> =>
    [...(declaration.exposes?.reads ?? []), ...(declaration.exposes?.actions ?? [])]
        .filter((item) => item.module !== declaration.key || !declaration.operations.includes(item.operation))
        .map((item) => ({ code: "WORKBENCH_EXPOSES_UNDECLARED", at: `${declaration.key}.${item.name}` }))

/**
 * The problems of one workbench: duplicate views, a view permission the module does not declare, an exposed read or action outside
 * its operations, and a default spec of another module. A spec's blocks and bindings are checked against the registry by
 * `specProblems`, where the registry is assembled.
 */
export const workbenchProblems = (module: WorkbenchDeclaration | WorkbenchModule): ReadonlyArray<WorkbenchProblem> => {
    const problems: Array<WorkbenchProblem> = []
    const ids = new Set<string>()
    for (const view of module.views) {
        const at = `${module.key}.${view.id}`
        if (ids.has(view.id)) problems.push({ code: "WORKBENCH_VIEW_DUPLICATE", at })
        ids.add(view.id)
        if (view.permission !== undefined && !module.permissions.includes(view.permission))
            problems.push({ code: "WORKBENCH_PERMISSION_UNDECLARED", at })
    }
    if ("render" in module && module.render.kind === "spec" && module.render.document.module !== module.key)
        problems.push({ code: "WORKBENCH_SPEC_FOREIGN", at: module.key })
    problems.push(...exposureProblems(module))
    return problems
}

/** A workbench as the module declares it, refused at import when it has a problem: a wiring bug stops the build, never a page. */
export const defineWorkbench = (module: WorkbenchModule): WorkbenchModule => {
    const [problem] = workbenchProblems(module)
    if (problem !== undefined) throw new SdkDefinitionError("WORKBENCH_INVALID", `${problem.code}: ${problem.at}`)
    return module
}

/** The workbenches of a module list by key; two under one key is refused. */
export const workbenchRegistryOf = (
    modules: ReadonlyArray<WorkbenchModule>,
): Readonly<Record<string, WorkbenchModule>> => {
    const registry: Record<string, WorkbenchModule> = {}
    for (const module of modules) {
        if (registry[module.key] !== undefined) throw new SdkDefinitionError("WORKBENCH_KEY_DUPLICATE", module.key)
        registry[module.key] = module
    }
    return registry
}

/** The view a route opens: the one whose id the deep link names, else the first. */
export const viewIdOf = (module: WorkbenchDeclaration, tab: string | null): string =>
    module.views.find((view) => view.id === tab)?.id ?? module.views[0].id

/** The registry specs are validated and drawn against: the SDK's blocks and every declaration's exposed blocks, reads and actions. */
export const specRegistryFrom = (declarations: ReadonlyArray<WorkbenchDeclaration>): WorkbenchSpecRegistry =>
    specRegistryOf({
        blocks: [...SDK_SPEC_BLOCKS, ...declarations.flatMap((declaration) => declaration.exposes?.blocks ?? [])],
        reads: declarations.flatMap((declaration) => declaration.exposes?.reads ?? []),
        actions: declarations.flatMap((declaration) => declaration.exposes?.actions ?? []),
    })
