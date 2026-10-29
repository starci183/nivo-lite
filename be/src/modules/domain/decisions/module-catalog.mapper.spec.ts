import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { MODULE_CATALOG } from "@modules/domain/modules"
import * as mapper from "./module-catalog.mapper"

const SUBJECT = Symbol("module-catalog.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<typeof mapper>({ toActionEntry: mapper.toActionEntry, toModuleEntry: mapper.toModuleEntry }) }],
    }).compile()
    return moduleRef.get<typeof mapper>(SUBJECT)
}

const sales = MODULE_CATALOG.filter((module) => module.accepts.length > 0 && module.authorityActions.length > 0).slice(0, 1)

describe("toModuleEntry", () => {
    it.each(sales)("keeps the audience, instancing, name and the commands $key accepts", async (module) => {
        const { toModuleEntry } = await build()

        const entry = toModuleEntry(module)

        expect(entry).toMatchObject({
            key: module.key,
            audience: module.audience,
            multiInstance: module.multiInstance,
            name: module.name,
        })
        expect(entry.accepts).toHaveLength(module.accepts.length)
        expect(entry.accepts[0]).toEqual({
            command: module.accepts[0]?.command,
            action: module.accepts[0]?.action,
            subjectType: module.accepts[0]?.subjectType,
            requiredFields: module.accepts[0]?.requiredFields,
            description: module.accepts[0]?.description,
        })
    })
})

describe("toActionEntry", () => {
    it.each(sales.flatMap((module) => module.authorityActions.slice(0, 1).map((action) => ({ key: module.key, action }))))(
        "keeps the cap, the actions queued after it and the label, under the module $key that performs it",
        async ({ key, action }) => {
            const { toActionEntry } = await build()

            expect(toActionEntry(key, action)).toEqual({
                action: action.action,
                moduleKey: key,
                maxMode: action.maxMode,
                next: action.next,
                label: action.label,
            })
        },
    )
})
