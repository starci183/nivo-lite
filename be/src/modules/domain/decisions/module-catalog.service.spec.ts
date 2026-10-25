import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ModuleCatalogService } from "./module-catalog.service"
import type { ActionRow, ModuleRow } from "./persistence/module-catalog.rows"
import { FIND_ACTION, FIND_MODULE } from "./persistence/module-catalog.sql"

const moduleRowOf = builder<ModuleRow>({
    key: "sales",
    audience: "internal",
    multi_instance: false,
    definition: {
        name: { vi: "Ban hang", en: "Sales" },
        accepts: [
            { command: "classify_lead", action: "classify_lead", subject_type: "lead", required_fields: ["lead_id"] },
        ],
    },
})

const actionRowOf = builder<ActionRow>({
    action: "classify_lead",
    module_key: "sales",
    max_mode: null,
    label: { vi: "Phan loai", en: "Classify lead" },
    next: ["send_follow_up"],
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ModuleCatalogService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ModuleCatalogService)
}

describe("ModuleCatalogService", () => {
    it("reads the registry in the producer's transaction when supplied", async () => {
        const em = mockEntityManager()
        const manager = mockEntityManager({
            query: [
                [FIND_MODULE, [moduleRowOf()]],
                [FIND_ACTION, [actionRowOf()]],
            ],
        })
        const service = await build(em)

        expect((await service.entryOf("sales", manager))?.key).toBe("sales")
        expect(await service.nameOf("sales", "en", manager)).toBe("Sales")
        expect((await service.actionOf("classify_lead", manager))?.moduleKey).toBe("sales")

        expect(em.query).not.toHaveBeenCalled()
        expect(manager.query).toHaveBeenCalledTimes(3)
    })

    describe("entryOf", () => {
        it("answers the module", async () => {
            const em = mockEntityManager({ query: [FIND_MODULE, [moduleRowOf()]] })
            const service = await build(em)

            await expect(service.entryOf("sales")).resolves.toMatchObject({ key: "sales", name: { en: "Sales" } })
            expect(em.query).toHaveBeenCalledWith(FIND_MODULE, ["sales"])
        })

        it("answers null for an unknown module", async () => {
            const service = await build(mockEntityManager({ query: [FIND_MODULE, []] }))

            await expect(service.entryOf("ghost")).resolves.toBeNull()
        })
    })

    describe("acceptsOf", () => {
        it("lists the accepted commands", async () => {
            const service = await build(mockEntityManager({ query: [FIND_MODULE, [moduleRowOf()]] }))

            await expect(service.acceptsOf("sales")).resolves.toEqual([
                {
                    command: "classify_lead",
                    action: "classify_lead",
                    subjectType: "lead",
                    requiredFields: ["lead_id"],
                    description: { vi: "", en: "" },
                },
            ])
        })

        it("is empty for an unknown module", async () => {
            const service = await build(mockEntityManager({ query: [FIND_MODULE, []] }))

            await expect(service.acceptsOf("ghost")).resolves.toEqual([])
        })
    })

    describe("nameOf", () => {
        it("answers the name in the language", async () => {
            const service = await build(mockEntityManager({ query: [FIND_MODULE, [moduleRowOf()]] }))

            await expect(service.nameOf("sales", "vi")).resolves.toBe("Ban hang")
        })

        it("falls back to the key for an unknown module", async () => {
            const service = await build(mockEntityManager({ query: [FIND_MODULE, []] }))

            await expect(service.nameOf("ghost", "en")).resolves.toBe("ghost")
        })

        it("falls back to the key when the name is blank", async () => {
            const service = await build(mockEntityManager({ query: [FIND_MODULE, [moduleRowOf({ definition: {} })]] }))

            await expect(service.nameOf("sales", "en")).resolves.toBe("sales")
        })
    })
})

describe("ModuleCatalogService", () => {
    describe("actionOf", () => {
        it("answers the action", async () => {
            const em = mockEntityManager({ query: [FIND_ACTION, [actionRowOf()]] })
            const service = await build(em)

            await expect(service.actionOf("classify_lead")).resolves.toEqual({
                action: "classify_lead",
                moduleKey: "sales",
                maxMode: null,
                next: ["send_follow_up"],
                label: { vi: "Phan loai", en: "Classify lead" },
            })
            expect(em.query).toHaveBeenCalledWith(FIND_ACTION, ["classify_lead"])
        })

        it("answers null for an unknown action", async () => {
            const service = await build(mockEntityManager({ query: [FIND_ACTION, []] }))

            await expect(service.actionOf("ghost")).resolves.toBeNull()
        })
    })
})
