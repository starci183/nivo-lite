import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InstallationRecordsService } from "./installation-records.service"
import type { InstallationRecord, NewInstallation } from "./module-installations.contracts"
import {
    ACTIVATE_VERSION,
    FIND_FIRST_OF_MODULE,
    FIND_INSTALLATION,
    FIND_INSTALLATION_BY_ID,
    FIND_OF_AGENT,
    FIND_REQUIREMENT_FACTS,
    FIND_SYNC_STATUS,
    INSERT_INSTALLATION,
    INSTALLATION_OF_RECORD,
    LIST_BOUND_AGENTS,
    LIST_INSTALLATIONS,
    LIST_INSTANCE_NAMES,
    LIST_ON_OPENCLAW,
    RENAME_INSTALLATION,
    SAVE_SETTINGS,
    SET_LIVE,
    SET_OPERATING_MODE,
} from "./persistence/module-installations.sql"

const RECORD_ID = "0b6c5d1e-2f3a-4b5c-8d9e-0f1a2b3c4d5e"
const UNIQUE_VIOLATION = { code: "23505" }

const recordOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "sales",
    name: "Sales",
    isMulti: false,
    agentId: "agent-1",
    agentName: "Sales",
    agentHandle: "sales",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    activeVersion: 1,
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [InstallationRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(InstallationRecordsService)
}

describe("InstallationRecordsService", () => {
    it("lists the installations of the workspace", async () => {
        const records = [recordOf(), recordOf({ id: "inst-2", name: "Bookings" })]
        const em = mockEntityManager({ query: [LIST_INSTALLATIONS, records] })
        const service = await build(em)

        await expect(service.list("ws-1")).resolves.toEqual(records)

        expect(em.query).toHaveBeenCalledWith(LIST_INSTALLATIONS, ["ws-1"])
    })

    it("finds an installation by id or answers null", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_INSTALLATION_BY_ID, [recordOf()]],
                [FIND_INSTALLATION_BY_ID, []],
            ],
        })
        const service = await build(em)

        await expect(service.findById("inst-1")).resolves.toEqual(recordOf())
        await expect(service.findById("missing")).resolves.toBeNull()

        expect(em.query).toHaveBeenNthCalledWith(1, FIND_INSTALLATION_BY_ID, ["inst-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, FIND_INSTALLATION_BY_ID, ["missing"])
    })

    it("finds the first installation of a module or answers null", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_FIRST_OF_MODULE, [recordOf()]],
                [FIND_FIRST_OF_MODULE, []],
            ],
        })
        const service = await build(em)

        await expect(service.firstOfModule("ws-1", "sales")).resolves.toEqual(recordOf())
        await expect(service.firstOfModule("ws-1", "booking")).resolves.toBeNull()

        expect(em.query).toHaveBeenNthCalledWith(1, FIND_FIRST_OF_MODULE, ["ws-1", "sales"])
        expect(em.query).toHaveBeenNthCalledWith(2, FIND_FIRST_OF_MODULE, ["ws-1", "booking"])
    })

    it("finds the installation driven by an agent or answers null", async () => {
        const em = mockEntityManager({
            query: [
                [FIND_OF_AGENT, [recordOf()]],
                [FIND_OF_AGENT, []],
            ],
        })
        const service = await build(em)

        await expect(service.ofAgent("ws-1", "agent-1")).resolves.toEqual(recordOf())
        await expect(service.ofAgent("ws-1", "unbound")).resolves.toBeNull()

        expect(em.query).toHaveBeenNthCalledWith(1, FIND_OF_AGENT, ["ws-1", "agent-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, FIND_OF_AGENT, ["ws-1", "unbound"])
    })

    it("lists the names of instances with the requested exclusion", async () => {
        const names = [{ id: "inst-2", name: "Front desk" }]
        const em = mockEntityManager({ query: [LIST_INSTANCE_NAMES, names] })
        const service = await build(em)

        await expect(service.instanceNames("ws-1", "sales", "inst-1")).resolves.toEqual(names)
        await expect(service.instanceNames("ws-1", "sales", null)).resolves.toEqual(names)

        expect(em.query).toHaveBeenNthCalledWith(1, LIST_INSTANCE_NAMES, ["ws-1", "sales", "inst-1"])
        expect(em.query).toHaveBeenNthCalledWith(2, LIST_INSTANCE_NAMES, ["ws-1", "sales", null])
    })

    it("reads the workspace requirement facts", async () => {
        const facts = { providers: ["facebook", "instagram"], chatAgents: 2, staff: 3, members: 9 }
        const em = mockEntityManager({ query: [FIND_REQUIREMENT_FACTS, [facts]] })
        const service = await build(em)

        await expect(service.requirementFacts("ws-1")).resolves.toEqual(facts)

        expect(em.query).toHaveBeenCalledWith(FIND_REQUIREMENT_FACTS, ["ws-1"])
    })

    it("lists OpenClaw installations within the requested workspace and limit", async () => {
        const installations = [{ id: "inst-1", workspaceId: "ws-1" }]
        const em = mockEntityManager({ query: [LIST_ON_OPENCLAW, installations] })
        const service = await build(em)

        await expect(service.onOpenclaw("ws-1", 20)).resolves.toEqual(installations)
        await expect(service.onOpenclaw(null, 100)).resolves.toEqual(installations)

        expect(em.query).toHaveBeenNthCalledWith(1, LIST_ON_OPENCLAW, ["ws-1", 20])
        expect(em.query).toHaveBeenNthCalledWith(2, LIST_ON_OPENCLAW, [null, 100])
    })

    describe("installationOfRecord", () => {
        it("answers no installation for an id that is not a record id, without reading", async () => {
            const service = await build(mockEntityManager())

            await expect(service.installationOfRecord("ws-1", "not-a-uuid")).resolves.toEqual({ installationId: null })
        })

        it("answers the installation that owns the record, or none", async () => {
            const em = mockEntityManager({
                query: [
                    [INSTALLATION_OF_RECORD, [{ installationId: "inst-1" }]],
                    [INSTALLATION_OF_RECORD, []],
                ],
            })
            const service = await build(em)

            await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({ installationId: "inst-1" })
            await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({ installationId: null })
        })
    })

    describe("find", () => {
        it("answers the row or null", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_INSTALLATION, [recordOf()]],
                    [FIND_INSTALLATION, []],
                ],
            })
            const service = await build(em)

            await expect(service.find("ws-1", "inst-1")).resolves.toEqual(recordOf())
            await expect(service.find("ws-1", "missing")).resolves.toBeNull()
        })
    })

    describe("boundAgentIds", () => {
        it("answers the ids of the bound agents", async () => {
            const service = await build(
                mockEntityManager({ query: [LIST_BOUND_AGENTS, [{ id: "agent-1" }, { id: "agent-2" }]] }),
            )

            await expect(service.boundAgentIds("ws-1")).resolves.toEqual(["agent-1", "agent-2"])
        })
    })

    describe("insert", () => {
        const installation: NewInstallation = {
            workspaceId: "ws-1",
            moduleKey: "sales",
            name: "Sales",
            agentId: "agent-1",
            operatingMode: "assist",
        }

        it("answers the id of the new installation", async () => {
            const em = mockEntityManager({ query: [INSERT_INSTALLATION, [{ id: "inst-9" }]] })
            const service = await build(em)

            await expect(service.insert(installation)).resolves.toBe("inst-9")
            expect(em.query).toHaveBeenCalledWith(INSERT_INSTALLATION, ["ws-1", "sales", "Sales", "agent-1", "assist"])
        })

        it("answers null when the label or the agent is taken", async () => {
            const em = mockEntityManager({ query: [INSERT_INSTALLATION, []] })
            em.query.mockRejectedValueOnce(UNIQUE_VIOLATION)
            const service = await build(em)

            await expect(service.insert(installation)).resolves.toBeNull()
        })

        it("lets any other failure through", async () => {
            const failure = { code: "57014" }
            const em = mockEntityManager({ query: [INSERT_INSTALLATION, []] })
            em.query.mockRejectedValueOnce(failure)
            const service = await build(em)

            await expect(service.insert(installation)).rejects.toBe(failure)
        })

        it("answers null when an insert returns no row", async () => {
            const em = mockEntityManager({ query: [INSERT_INSTALLATION, []] })
            const service = await build(em)

            await expect(service.insert(installation)).resolves.toBeNull()

            expect(em.query).toHaveBeenCalledWith(INSERT_INSTALLATION, ["ws-1", "sales", "Sales", "agent-1", "assist"])
        })

        it.each([null, "database down", { message: "database down" }])(
            "preserves a failure that does not report a database code: %p",
            async (failure) => {
                const em = mockEntityManager()
                em.query.mockRejectedValue(failure)
                const service = await build(em)

                await expect(service.insert(installation)).rejects.toBe(failure)

                expect(em.query).toHaveBeenCalledWith(INSERT_INSTALLATION, [
                    "ws-1",
                    "sales",
                    "Sales",
                    "agent-1",
                    "assist",
                ])
            },
        )
    })

    describe("writes", () => {
        it("writes the installation name, operating mode, live state and active version", async () => {
            const em = mockEntityManager({
                query: [
                    [RENAME_INSTALLATION, [{ id: "inst-1" }]],
                    [SET_OPERATING_MODE, [{ id: "inst-1" }]],
                    [SET_LIVE, [{ id: "inst-1" }]],
                    [ACTIVATE_VERSION, [{ id: "inst-1" }]],
                ],
            })
            const service = await build(em)

            await expect(service.rename("ws-1", "inst-1", "Front desk")).resolves.toBe("done")
            await expect(service.setOperatingMode("ws-1", "inst-1", "autopilot")).resolves.toBe("done")
            await expect(service.setLive("ws-1", "inst-1", true)).resolves.toBe("done")
            await expect(service.activateVersion("ws-1", "inst-1", "version-2", "ready")).resolves.toBe("done")

            expect(em.query).toHaveBeenNthCalledWith(1, RENAME_INSTALLATION, ["inst-1", "ws-1", "Front desk"])
            expect(em.query).toHaveBeenNthCalledWith(2, SET_OPERATING_MODE, ["inst-1", "ws-1", "autopilot"])
            expect(em.query).toHaveBeenNthCalledWith(3, SET_LIVE, ["inst-1", "ws-1", true, "live"])
            expect(em.query).toHaveBeenNthCalledWith(4, ACTIVATE_VERSION, ["inst-1", "ws-1", "version-2", "ready"])
        })

        it("answers done when the row changed and missing when there was none", async () => {
            const em = mockEntityManager({
                query: [
                    [RENAME_INSTALLATION, [{ id: "inst-1" }]],
                    [SET_LIVE, []],
                ],
            })
            const service = await build(em)

            await expect(service.rename("ws-1", "inst-1", "Front desk")).resolves.toBe("done")
            await expect(service.setLive("ws-1", "inst-9", false)).resolves.toBe("missing")
            expect(em.query).toHaveBeenCalledWith(SET_LIVE, ["inst-9", "ws-1", false, "paused"])
        })

        it("answers taken on a unique violation and stores the settings as JSON", async () => {
            const em = mockEntityManager({ query: [SAVE_SETTINGS, []] })
            em.query.mockRejectedValueOnce(UNIQUE_VIOLATION)
            const service = await build(em)

            await expect(service.saveSettings("ws-1", "inst-1", { holdingMessage: "One moment" })).resolves.toBe(
                "taken",
            )
            expect(em.query).toHaveBeenCalledWith(SAVE_SETTINGS, ["inst-1", "ws-1", '{"holdingMessage":"One moment"}'])
        })

        it("lets any other write failure through", async () => {
            const failure = { code: "57014" }
            const em = mockEntityManager({ query: [SET_LIVE, []] })
            em.query.mockRejectedValueOnce(failure)
            const service = await build(em)

            await expect(service.setLive("ws-1", "inst-1", true)).rejects.toBe(failure)
        })
    })

    describe("syncStatus", () => {
        const row = { syncedVersion: 1, activeVersion: 2, checkedAt: "2026-10-01T00:00:00.000Z", error: null }

        it("keeps a known state and reads anything else as none", async () => {
            const em = mockEntityManager({
                query: [
                    [FIND_SYNC_STATUS, [{ ...row, state: "ok" }]],
                    [FIND_SYNC_STATUS, [{ ...row, state: "error" }]],
                    [FIND_SYNC_STATUS, [{ ...row, state: null }]],
                ],
            })
            const service = await build(em)

            await expect(service.syncStatus("ws-1", "inst-1")).resolves.toEqual({ ...row, state: "ok" })
            await expect(service.syncStatus("ws-1", "inst-1")).resolves.toEqual({ ...row, state: "error" })
            await expect(service.syncStatus("ws-1", "inst-1")).resolves.toEqual({ ...row, state: "none" })
        })

        it("answers null for an installation of another workspace", async () => {
            const service = await build(mockEntityManager({ query: [FIND_SYNC_STATUS, []] }))

            await expect(service.syncStatus("ws-2", "inst-1")).resolves.toBeNull()
        })
    })
})
