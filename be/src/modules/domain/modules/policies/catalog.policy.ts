import type { Bilingual, ModuleCategory, ModuleDefinition } from "../modules.contracts"

const MODULE_KEY = /^[a-z][a-z0-9_]{1,23}$/u
const ACTION_KEY = /^[a-z][a-z0-9_]{2,40}$/u
const COMMAND_SUBJECT = /^[a-z][a-z_]{1,30}$/u

const blank = (text: string): boolean => text.trim() === ""
const blankBilingual = (text: Bilingual): boolean => blank(text.vi) || blank(text.en)
const duplicates = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
    values.filter((value, index) => values.indexOf(value) !== index)

const copyProblems = (module: ModuleDefinition): ReadonlyArray<string> => {
    const checks: ReadonlyArray<readonly [boolean, string]> = [
        [!MODULE_KEY.test(module.key), "key must be short lowercase ASCII"],
        [blankBilingual(module.name), "name needs a Vietnamese and an English text"],
        [blankBilingual(module.shortName), "shortName needs a Vietnamese and an English text"],
        [blankBilingual(module.description), "description needs a Vietnamese and an English text"],
        [module.points.vi.length === 0 || module.points.en.length === 0, "points need items in both languages"],
        [blank(module.purpose), "purpose is required"],
        [blank(module.icon) || blank(module.glyph) || blank(module.mascot), "icon, glyph and mascot are required"],
        [blank(module.knowledgeFolder), "knowledgeFolder is required"],
        [blank(module.agent.name) || blank(module.agent.handle), "agent name and handle are required"],
        [
            blankBilingual(module.agent.summary) ||
                blankBilingual(module.agent.role) ||
                module.agent.capabilities.vi.length === 0 ||
                module.agent.capabilities.en.length === 0,
            "agent summary, role and capabilities need both languages",
        ],
        [module.multiInstance && module.audience !== "customer", "multiInstance is only for customer audience agents"],
    ]
    return checks.filter(([failed]) => failed).map(([, message]) => `${module.key}: ${message}`)
}

const gateProblems = (module: ModuleDefinition): ReadonlyArray<string> => {
    const actions = new Set(module.authorityActions.map((action) => action.action))
    const keys = module.gates.map((gate) => gate.key)
    const blankGate = module.gates.filter((gate) =>
        [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].some(blank),
    )
    const strayRules = module.gates
        .flatMap((gate) => gate.writes ?? [])
        .filter((write) => write.kind === "rule" && !actions.has(write.action))
    return [
        ...(module.gates.length === 0 ? [`${module.key}: gates must not be empty`] : []),
        ...(blankGate.length > 0
            ? [`${module.key}: every gate needs a key, a label and a hint in both languages`]
            : []),
        ...duplicates(keys).map((key) => `${module.key}: duplicate gate ${key}`),
        ...strayRules.map(
            (write) => `${module.key}: a gate rule write names an action the module does not own (${write.kind})`,
        ),
    ]
}

const actionProblems = (module: ModuleDefinition): ReadonlyArray<string> => {
    const actions = module.authorityActions
    const accepted = module.accepts.map((command) => command.action)
    return [
        ...(actions.length === 0 ? [`${module.key}: authorityActions must not be empty`] : []),
        ...actions
            .filter((action) => !ACTION_KEY.test(action.action) || blankBilingual(action.label))
            .map((action) => `${module.key}: bad action ${action.action}`),
        ...duplicates(accepted).map((action) => `${module.key}: action ${action} is accepted by two commands`),
        ...actions
            .filter((action) => !accepted.includes(action.action))
            .map((action) => `${module.key}: action ${action.action} has no accepted command`),
        ...module.accepts
            .filter((command) => !actions.some((action) => action.action === command.action))
            .map((command) => `${module.key}: command ${command.command} maps to an action the module does not own`),
        ...module.accepts
            .filter((command) => !COMMAND_SUBJECT.test(command.subjectType) || blankBilingual(command.description))
            .map(
                (command) => `${module.key}: command ${command.command} needs a lower_snake subject and a description`,
            ),
        ...duplicates(module.accepts.map((command) => command.command)).map(
            (command) => `${module.key}: duplicate command ${command}`,
        ),
    ]
}

/**
 * Judges the catalogue against its own rules and answers every problem found (empty when it is sound): module keys,
 * actions and categories are unique and known, every text exists in both languages, every gate and command is
 * consistent with the authority actions of its module.
 */
export const checkCatalog = (
    catalog: ReadonlyArray<ModuleDefinition>,
    categories: ReadonlyArray<ModuleCategory>,
): ReadonlyArray<string> => {
    const categoryKeys = new Set(categories.map((category) => category.key))
    const allActions = catalog.flatMap((module) => module.authorityActions.map((action) => action.action))
    return [
        ...duplicates(catalog.map((module) => module.key)).map((key) => `duplicate module ${key}`),
        ...duplicates(allActions).map((action) => `action ${action} is declared by two modules`),
        ...catalog
            .filter((module) => !categoryKeys.has(module.category))
            .map((module) => `${module.key}: unknown category ${module.category}`),
        ...catalog
            .flatMap((module) => module.authorityActions.flatMap((action) => action.next))
            .filter((next) => !allActions.includes(next))
            .map((next) => `an action chains to unknown action ${next}`),
        ...catalog.flatMap((module) => [...copyProblems(module), ...gateProblems(module), ...actionProblems(module)]),
    ]
}
