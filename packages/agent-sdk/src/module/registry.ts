import { ModuleListError } from "./module-list-error"
import type { ModuleListProblem, ModuleServer, ModuleTemplate } from "./module.types"

/** What is wrong with a list of server modules, empty when the host may load it: keys unique, each server's key equal to its template's. */
export const moduleListProblems = (modules: ReadonlyArray<ModuleServer>): ReadonlyArray<ModuleListProblem> => {
    const problems: Array<ModuleListProblem> = []
    const keys = new Set<string>()
    for (const module of modules) {
        if (keys.has(module.key)) problems.push({ code: "MODULE_KEY_DUPLICATE", key: module.key })
        keys.add(module.key)
        if (module.template.key !== module.key) problems.push({ code: "MODULE_KEY_MISMATCH", key: module.key })
    }
    return problems
}

/** The templates of a module list in catalogue order; throws on the first problem, so a wiring bug stops the start and never a request. */
export const templatesOf = (modules: ReadonlyArray<ModuleServer>): ReadonlyArray<ModuleTemplate> => {
    const [problem] = moduleListProblems(modules)
    if (problem !== undefined) throw new ModuleListError(problem.code, problem.key)
    return modules.map((module) => module.template).sort((left, right) => left.order - right.order)
}
