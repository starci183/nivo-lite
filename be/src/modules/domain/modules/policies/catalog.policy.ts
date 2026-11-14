import type { Bilingual, ModuleCategory, ModuleDefinition } from "../modules.contracts"

const MODULE_KEY = /^[a-z][a-z0-9_]{1,23}$/u

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
        [blankBilingual(module.agent.label) || blank(module.agent.handle), "agent label and handle are required"],
        [
            blankBilingual(module.agent.summary) ||
                blankBilingual(module.agent.role) ||
                module.agent.capabilities.vi.length === 0 ||
                module.agent.capabilities.en.length === 0,
            "agent summary, role and capabilities need both languages",
        ],
        [
            module.multiInstance && module.audience !== "customer" && module.connectionProviders.length === 0,
            "multiInstance is only for customer audience agents or agents that speak on channels",
        ],
    ]
    return checks.filter(([failed]) => failed).map(([, message]) => `${module.key}: ${message}`)
}

const gateProblems = (module: ModuleDefinition): ReadonlyArray<string> => {
    const keys = module.gates.map((gate) => gate.key)
    const blankGate = module.gates.filter((gate) =>
        [gate.key, gate.label_vi, gate.label_en, gate.hint_vi, gate.hint_en].some((text) => blank(text)),
    )
    return [
        ...(module.gates.length === 0 ? [`${module.key}: gates must not be empty`] : []),
        ...(blankGate.length > 0
            ? [`${module.key}: every gate needs a key, a label and a hint in both languages`]
            : []),
        ...duplicates(keys).map((key) => `${module.key}: duplicate gate ${key}`),
    ]
}

/**
 * Judges the catalogue against its own rules and answers every problem found (empty when it is sound): module keys and categories are
 * unique and known, every text exists in both languages and every gate is whole.
 */
export const checkCatalog = (
    catalog: ReadonlyArray<ModuleDefinition>,
    categories: ReadonlyArray<ModuleCategory>,
): ReadonlyArray<string> => {
    const categoryKeys = new Set(categories.map((category) => category.key))
    return [
        ...duplicates(catalog.map((module) => module.key)).map((key) => `duplicate module ${key}`),
        ...catalog
            .filter((module) => !categoryKeys.has(module.category))
            .map((module) => `${module.key}: unknown category ${module.category}`),
        ...catalog.flatMap((module) => [...copyProblems(module), ...gateProblems(module)]),
    ]
}
