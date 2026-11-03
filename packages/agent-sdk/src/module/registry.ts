import type { ModuleListProblem, ModuleServer, ModuleTemplate } from "./module.types"

/** The commands of one template that name an action the template does not govern. */
const commandProblems = (template: ModuleTemplate): ReadonlyArray<ModuleListProblem> => {
    const actions = new Set(template.authorityActions.map((action) => action.action))
    return template.accepts
        .filter((command) => !actions.has(command.action))
        .map((command) => ({ code: "MODULE_COMMAND_UNKNOWN_ACTION", key: `${template.key}.${command.command}` }))
}

/**
 * What is wrong with a list of server modules, empty when the host may load it: keys unique, each server's key equal to its template's,
 * every authority action unique across all modules (the authority matrix is one table) and every accepted command governed by an action
 * of its own module.
 */
export const moduleListProblems = (modules: ReadonlyArray<ModuleServer>): ReadonlyArray<ModuleListProblem> => {
    const problems: Array<ModuleListProblem> = []
    const keys = new Set<string>()
    const actions = new Set<string>()
    for (const module of modules) {
        if (keys.has(module.key)) problems.push({ code: "MODULE_KEY_DUPLICATE", key: module.key })
        keys.add(module.key)
        if (module.template.key !== module.key) problems.push({ code: "MODULE_KEY_MISMATCH", key: module.key })
        for (const action of module.template.authorityActions) {
            if (actions.has(action.action)) problems.push({ code: "MODULE_ACTION_DUPLICATE", key: action.action })
            actions.add(action.action)
        }
        problems.push(...commandProblems(module.template))
    }
    return problems
}

/** The templates of a module list in catalogue order; throws on the first problem, so a wiring bug stops the start and never a request. */
export const templatesOf = (modules: ReadonlyArray<ModuleServer>): ReadonlyArray<ModuleTemplate> => {
    const [problem] = moduleListProblems(modules)
    if (problem !== undefined) throw new Error(`${problem.code}: ${problem.key}`)
    return modules.map((module) => module.template).sort((left, right) => left.order - right.order)
}
