import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { ModuleCatalogService } from "./module-catalog.service"
import { MODULE_CATALOG_SOURCE } from "./work-engine.decorators"
import type { ModuleCatalogSource } from "./work-engine.port"

const [catalogued] = MODULE_CATALOG.filter(
    (candidate) => candidate.accepts.length > 0 && candidate.authorityActions.length > 0,
)

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ModuleCatalogService,
            {
                provide: MODULE_CATALOG_SOURCE,
                useValue: mock<ModuleCatalogSource>({
                    catalog: jest.fn(() => Promise.resolve({ modules: MODULE_CATALOG })),
                }),
            },
        ],
    }).compile()
    return moduleRef.get(ModuleCatalogService)
}

describe("ModuleCatalogService", () => {
    describe("entryOf", () => {
        it("answers the module of the catalogue, null for an unknown key", async () => {
            const service = await build()

            await expect(service.entryOf(catalogued?.key ?? "")).resolves.toMatchObject({ key: catalogued?.key })
            await expect(service.entryOf("no-such-module")).resolves.toBeNull()
        })
    })

    describe("acceptsOf", () => {
        it("lists the commands the module accepts, none for an unknown module", async () => {
            const service = await build()

            await expect(service.acceptsOf(catalogued?.key ?? "")).resolves.toHaveLength(
                catalogued?.accepts.length ?? -1,
            )
            await expect(service.acceptsOf("no-such-module")).resolves.toEqual([])
        })
    })

    describe("nameOf", () => {
        it("answers the module's name in the language, the key when the module is unknown", async () => {
            const service = await build()

            await expect(service.nameOf(catalogued?.key ?? "", "en")).resolves.toBe(catalogued?.name.en)
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
            const action = catalogued?.authorityActions[0]

            await expect(service.actionOf(action?.action ?? "")).resolves.toMatchObject({
                action: action?.action,
                label: action?.label,
            })
            await expect(service.actionOf("no_such_action")).resolves.toBeNull()
        })
    })
})
