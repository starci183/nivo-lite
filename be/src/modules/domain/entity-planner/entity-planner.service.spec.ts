import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ENTITY_PLANNER_OPTIONS } from "./entity-planner.port"
import { EntityPlannerService } from "./entity-planner.service"
import { EntityPlannerErrorCode } from "./errors/entity-planner.error"
import { MigrationFilesClient } from "./migration-files.client"

const QUAL = "(workspace_id = engine_workspace())"
const COMMANDS = ["select", "insert", "update", "delete"] as const

const base = (name: string) => ({
    name,
    rlsEnabled: true,
    rlsForced: false,
    policies: COMMANDS.map((command) => ({
        name: `${name}_app_engine_${command}`,
        roles: ["app_engine"],
        command,
        permissive: true,
        qual: command === "insert" ? null : QUAL,
        check: command === "insert" || command === "update" ? QUAL : null,
    })),
    grants: [{ role: "app_engine", privileges: ["select", "insert", "update", "delete"] }],
})

const matching = {
    extensions: [],
    bases: [base("records"), base("record_links"), base("entity_sequences")],
    partitions: [],
    views: [],
}

const lead: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: { name: { kind: "text", nullable: false, maxLength: 200 } },
}

const build = async (entities: ReadonlyArray<EntityDefinition>, catalog: unknown) => {
    const entityManager: MockEntityManager = mockEntityManager()
    entityManager.query.mockResolvedValue([{ engine_catalog: catalog }])
    const files = mock<MigrationFilesClient>()
    files.names.mockResolvedValue(["20261111103100_a.sql", "20261112000200_b.sql"])
    files.read.mockResolvedValue("-- other")
    files.manifest.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityPlannerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ENTITY_PLANNER_OPTIONS, useValue: { entities } },
            { provide: MigrationFilesClient, useValue: files },
        ],
    }).compile()
    const out = { write: jest.fn() }
    return { service: moduleRef.get(EntityPlannerService), files, out, entityManager }
}

describe("EntityPlannerService.plan", () => {
    it("reads the catalog through the db function and prints that the database matches", async () => {
        const { service, out, entityManager } = await build([], matching)

        await service.plan({}, out)

        expect(entityManager.query).toHaveBeenCalledWith('SELECT * FROM "public"."engine_catalog"()', [])
        expect(out.write).toHaveBeenCalledWith("entities: the database matches the declarations\n")
    })

    it("prints the steps of a plan and writes nothing without --write", async () => {
        const { service, out, files } = await build([lead], matching)

        await service.plan({}, out)

        expect(out.write).toHaveBeenCalledWith(expect.stringContaining("+ create_partition public.records_sales_lead"))
        expect(files.write).not.toHaveBeenCalled()
        expect(files.writeManifest).not.toHaveBeenCalled()
    })

    it("writes the next migration and the manifest with --write", async () => {
        const { service, out, files } = await build([lead], matching)

        await service.plan({ write: true }, out)

        expect(files.write).toHaveBeenCalledTimes(1)
        expect(files.write).toHaveBeenCalledWith(
            "20261112000201_entity-engine-partitions.sql",
            expect.stringContaining("PARTITION OF public.records FOR VALUES IN ('sales.lead')"),
        )
        expect(files.writeManifest).toHaveBeenCalledWith(expect.stringContaining('"partition": "records_sales_lead"'))
    })

    it("stamps one after the highest committed migration, from zero without any, ignoring files without a stamp", async () => {
        const some = await build([lead], matching)
        some.files.names.mockResolvedValue(["20261111103100_a.sql", "README.sql", "20261026000000_baseline.sql"])
        await some.service.plan({ write: true }, some.out)
        expect(some.files.write).toHaveBeenCalledWith(
            "20261111103101_entity-engine-partitions.sql",
            expect.stringContaining("records_sales_lead"),
        )

        const none = await build([lead], matching)
        none.files.names.mockResolvedValue([])
        await none.service.plan({ write: true }, none.out)
        expect(none.files.write).toHaveBeenCalledWith(
            "00000000000001_entity-engine-partitions.sql",
            expect.stringContaining("records_sales_lead"),
        )
    })

    it("writes only the manifest when nothing differs", async () => {
        const { service, out, files } = await build([], matching)

        await service.plan({ write: true }, out)

        expect(files.write).not.toHaveBeenCalled()
        expect(files.writeManifest).toHaveBeenCalledTimes(1)
    })
})

describe("EntityPlannerService.plan refusals", () => {
    it("refuses to write the same migration twice", async () => {
        const first = await build([lead], matching)
        const written: Array<string> = []
        first.files.write.mockImplementation((_name: string, text: string) => {
            written.push(text)
            return Promise.resolve()
        })
        await first.service.plan({ write: true }, first.out)
        const { service, out, files } = await build([lead], matching)
        files.read.mockResolvedValue(written[0] ?? "")

        await expect(service.plan({ write: true }, out)).rejects.toMatchObject({
            code: EntityPlannerErrorCode.AlreadyWritten,
        })
        expect(files.write).not.toHaveBeenCalled()
    })

    it("refuses a destructive plan unless --contract, then writes a contract migration", async () => {
        const drifted = {
            ...matching,
            partitions: [{ name: "records_old", bound: "old.thing", constraints: [], indexes: [] }],
        }
        const refused = await build([], drifted)
        await expect(refused.service.plan({ write: true }, refused.out)).rejects.toMatchObject({
            code: EntityPlannerErrorCode.PlanDestructive,
        })
        expect(refused.files.write).not.toHaveBeenCalled()

        const allowed = await build([], drifted)
        await allowed.service.plan({ write: true, contract: true }, allowed.out)
        expect(allowed.files.write).toHaveBeenCalledWith(
            "20261112000201_entity-engine-partitions_contract_drop.sql",
            expect.stringContaining("records_old"),
        )
    })

    it("lists the steps it cannot write as a refusal", async () => {
        const { service, out } = await build([], { ...matching, bases: [] })

        await expect(service.plan({ write: true, contract: true }, out)).rejects.toMatchObject({
            code: EntityPlannerErrorCode.RenderRefused,
        })
    })

    it("rejects a catalog that is not a snapshot", async () => {
        const { service, out } = await build([], { nope: true })

        await expect(service.plan({}, out)).rejects.toMatchObject({
            code: EntityPlannerErrorCode.CatalogInvalid,
        })
    })

    it("rejects an empty answer from the db function", async () => {
        const { service, out, entityManager } = await build([], matching)
        entityManager.query.mockResolvedValue([])

        await expect(service.plan({}, out)).rejects.toMatchObject({
            code: EntityPlannerErrorCode.CatalogInvalid,
        })
    })
})

describe("EntityPlannerService.check", () => {
    it("passes when the database and the manifest match", async () => {
        const { service, out, files } = await build([], matching)
        files.manifest.mockResolvedValue('{\n  "version": 1,\n  "entities": []\n}\n')

        await expect(service.check(out)).resolves.toBeUndefined()
    })

    it("fails on a non-empty plan", async () => {
        const { service, out } = await build([lead], matching)

        await expect(service.check(out)).rejects.toMatchObject({ code: EntityPlannerErrorCode.PlanNotEmpty })
    })

    it("fails when the manifest file is missing or stale", async () => {
        const { service, out } = await build([], matching)

        await expect(service.check(out)).rejects.toMatchObject({ code: EntityPlannerErrorCode.ManifestMismatch })
    })
})
