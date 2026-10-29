import { MODULE_CATALOG } from "@modules/domain/modules"
import { toActionEntry, toModuleEntry } from "./module-catalog.mapper"

const [sales] = MODULE_CATALOG.filter((module) => module.accepts.length > 0 && module.authorityActions.length > 0)

describe("toModuleEntry", () => {
    it("keeps the audience, instancing, name and the commands a module accepts", () => {
        if (sales === undefined) throw new Error("the catalogue lists no module that accepts commands")

        const entry = toModuleEntry(sales)

        expect(entry).toMatchObject({
            key: sales.key,
            audience: sales.audience,
            multiInstance: sales.multiInstance,
            name: sales.name,
        })
        expect(entry.accepts).toHaveLength(sales.accepts.length)
        expect(entry.accepts[0]).toEqual({
            command: sales.accepts[0]?.command,
            action: sales.accepts[0]?.action,
            subjectType: sales.accepts[0]?.subjectType,
            requiredFields: sales.accepts[0]?.requiredFields,
            description: sales.accepts[0]?.description,
        })
    })
})

describe("toActionEntry", () => {
    it("keeps the cap, the actions queued after it and the label, under the module that performs it", () => {
        const action = sales?.authorityActions[0]
        if (sales === undefined || action === undefined) throw new Error("the catalogue lists no authority action")

        expect(toActionEntry(sales.key, action)).toEqual({
            action: action.action,
            moduleKey: sales.key,
            maxMode: action.maxMode,
            next: action.next,
            label: action.label,
        })
    })
})
