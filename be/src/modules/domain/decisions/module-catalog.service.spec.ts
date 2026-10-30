import { Test } from "@nestjs/testing"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { ModuleCatalogService } from "./module-catalog.service"
import { MODULE_CATALOG_SOURCE } from "./work-engine.decorators"

const [module] = MODULE_CATALOG.filter(
    (candidate) => candidate.accepts.length > 0 && candidate.authorityActions.length > 0,
)

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleCatalogService,
            {
                provide: MODULE_CATALOG_SOURCE,
                useValue: { catalog: () => Promise.resolve({ modules: MODULE_CATALOG }) },
            },
        ],
    }).compile()
    return moduleRef.get(ModuleCatalogService)
}

describe("ModuleCatalogService", () => {
    describe("entryOf", () => {
        it("answers the module of the catalogue, null for an unknown key", async () => {
            const service = await build()

            await expect(service.entryOf(module?.key ?? "")).resolves.toMatchObject({ key: module?.key })
            await expect(service.entryOf("no-such-module")).resolves.toBeNull()
        })
    })

    describe("acceptsOf", () => {
        it("lists the commands the module accepts, none for an unknown module", async () => {
            const service = await build()

            await expect(service.acceptsOf(module?.key ?? "")).resolves.toHaveLength(module?.accepts.length ?? -1)
            await expect(service.acceptsOf("no-such-module")).resolves.toEqual([])
        })
    })

    describe("nameOf", () => {
        it("answers the module's name in the language, the key when the module is unknown", async () => {
            const service = await build()

            await expect(service.nameOf(module?.key ?? "", "en")).resolves.toBe(module?.name.en)
            await expect(service.nameOf("no-such-module", "vi")).resolves.toBe("no-such-module")
        })

        it("falls back to the key when the module has no name in the language", async () => {
            const service = await build()
            const blank = MODULE_CATALOG.find((candidate) => candidate.name.vi === "")

            await expect(service.nameOf(blank?.key ?? "no-blank-name", "vi")).resolves.toBe(
                blank?.key ?? "no-blank-name",
            )
        })
    })

    describe("actionOf", () => {
        it("answers the action under the module that performs it, null for an unknown action", async () => {
            const service = await build()
            const action = module?.authorityActions[0]

            await expect(service.actionOf(action?.action ?? "")).resolves.toMatchObject({
                action: action?.action,
                label: action?.label,
            })
            await expect(service.actionOf("no_such_action")).resolves.toBeNull()
        })
    })
})
