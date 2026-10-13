import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { InstallationRecord, NewInstallation } from "./module-installations.contracts"
import { InstallationRecordsService } from "./installation-records.service"
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

const RECORD_ID = "11111111-1111-4111-8111-111111111111"
const installation: InstallationRecord = {
    id: "i-1",
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    name: "Front desk",
    isMulti: false,
    agentId: "a-1",
    agentName: "Mai",
    agentHandle: "mai",
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    activeVersion: null,
    settings: {},
    createdAt: "2026-10-12T00:00:00.000Z",
}
const created: NewInstallation = {
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    name: "Front desk",
    agentId: "a-1",
    operatingMode: "assist",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [InstallationRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(InstallationRecordsService), entityManager }
}

describe("InstallationRecordsService", () => {
    it("lists the installations of a workspace", async () => {
        const { service, entityManager } = await build(
            mockEntityManager({ query: [LIST_INSTALLATIONS, [installation]] }),
        )

        await expect(service.list("ws-1")).resolves.toEqual([installation])
        expect(entityManager.query).toHaveBeenCalledWith(LIST_INSTALLATIONS, ["ws-1"])
    })

    it("refuses a record id that is not a uuid without reading", async () => {
        const { service, entityManager } = await build(mockEntityManager())

        await expect(service.installationOfRecord("ws-1", "not-a-uuid")).resolves.toEqual({ installationId: null })
        expect(entityManager.query).not.toHaveBeenCalled()
    })

    it("reads the installation that owns a record", async () => {
        const { service } = await build(
            mockEntityManager({ query: [INSTALLATION_OF_RECORD, [{ installationId: "i-1" }]] }),
        )

        await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({ installationId: "i-1" })
    })

    it("answers no installation when the record names none", async () => {
        const { service } = await build(mockEntityManager({ query: [INSTALLATION_OF_RECORD, []] }))

        await expect(service.installationOfRecord("ws-1", RECORD_ID)).resolves.toEqual({ installationId: null })
    })

    it("finds one installation of a workspace and answers null when it is gone", async () => {
        const found = await build(mockEntityManager({ query: [FIND_INSTALLATION, [installation]] }))
        const missing = await build(mockEntityManager({ query: [FIND_INSTALLATION, []] }))

        await expect(found.service.find("ws-1", "i-1")).resolves.toEqual(installation)
        await expect(missing.service.find("ws-1", "i-9")).resolves.toBeNull()
        expect(found.entityManager.query).toHaveBeenCalledWith(FIND_INSTALLATION, ["ws-1", "i-1"])
    })

    it("finds an installation by id across workspaces", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_INSTALLATION_BY_ID, []] }))

        await expect(service.findById("i-9")).resolves.toBeNull()
    })

    it("reads the oldest installation of a module and the installation of an agent", async () => {
        const oldest = await build(mockEntityManager({ query: [FIND_FIRST_OF_MODULE, [installation]] }))
        const agent = await build(mockEntityManager({ query: [FIND_OF_AGENT, []] }))

        await expect(oldest.service.firstOfModule("ws-1", "chatbot")).resolves.toEqual(installation)
        await expect(agent.service.ofAgent("ws-1", "a-9")).resolves.toBeNull()
        expect(oldest.entityManager.query).toHaveBeenCalledWith(FIND_FIRST_OF_MODULE, ["ws-1", "chatbot"])
    })

    it("lists instance names and the agents an installation already drives", async () => {
        const names = await build(
            mockEntityManager({ query: [LIST_INSTANCE_NAMES, [{ id: "i-1", name: "Front desk" }]] }),
        )
        const agents = await build(mockEntityManager({ query: [LIST_BOUND_AGENTS, [{ id: "a-1" }, { id: "a-2" }]] }))

        await expect(names.service.instanceNames("ws-1", "chatbot", null)).resolves.toEqual([
            { id: "i-1", name: "Front desk" },
        ])
        await expect(agents.service.boundAgentIds("ws-1")).resolves.toEqual(["a-1", "a-2"])
        expect(names.entityManager.query).toHaveBeenCalledWith(LIST_INSTANCE_NAMES, ["ws-1", "chatbot", null])
    })

    it("returns the id of a new installation", async () => {
        const { service, entityManager } = await build(
            mockEntityManager({ query: [INSERT_INSTALLATION, [{ id: "i-1" }]] }),
        )

        await expect(service.insert(created)).resolves.toBe("i-1")
        expect(entityManager.query).toHaveBeenCalledWith(INSERT_INSTALLATION, [
            "ws-1",
            "chatbot",
            "Front desk",
            "a-1",
            "assist",
        ])
    })

    it("answers null when the label or the agent is already taken", async () => {
        const entityManager = mockEntityManager()
        entityManager.query.mockRejectedValue({ code: "23505" })
        const { service } = await build(entityManager)

        await expect(service.insert(created)).resolves.toBeNull()
    })

    it("rethrows a write failure that is not a unique violation", async () => {
        const failure = new Error("database unavailable")
        const entityManager = mockEntityManager()
        entityManager.query.mockRejectedValue(failure)
        const { service } = await build(entityManager)

        await expect(service.insert(created)).rejects.toBe(failure)
    })

    it("reports a rename as done, missing, or taken", async () => {
        const done = await build(mockEntityManager({ query: [RENAME_INSTALLATION, [{ id: "i-1" }]] }))
        const missing = await build(mockEntityManager({ query: [RENAME_INSTALLATION, []] }))
        const takenManager = mockEntityManager()
        takenManager.query.mockRejectedValue({ code: "23505" })
        const taken = await build(takenManager)

        await expect(done.service.rename("ws-1", "i-1", "Desk")).resolves.toBe("done")
        await expect(missing.service.rename("ws-1", "i-1", "Desk")).resolves.toBe("missing")
        await expect(taken.service.rename("ws-1", "i-1", "Desk")).resolves.toBe("taken")
        expect(done.entityManager.query).toHaveBeenCalledWith(RENAME_INSTALLATION, ["i-1", "ws-1", "Desk"])
    })

    it("stores the operating mode, the live flag, the settings and the applied version", async () => {
        const mode = await build(mockEntityManager({ query: [SET_OPERATING_MODE, [{ id: "i-1" }]] }))
        const live = await build(mockEntityManager({ query: [SET_LIVE, [{ id: "i-1" }]] }))
        const paused = await build(mockEntityManager({ query: [SET_LIVE, [{ id: "i-1" }]] }))
        const settings = await build(mockEntityManager({ query: [SAVE_SETTINGS, [{ id: "i-1" }]] }))
        const version = await build(mockEntityManager({ query: [ACTIVATE_VERSION, [{ id: "i-1" }]] }))

        await expect(mode.service.setOperatingMode("ws-1", "i-1", "autopilot")).resolves.toBe("done")
        await expect(live.service.setLive("ws-1", "i-1", true)).resolves.toBe("done")
        await expect(paused.service.setLive("ws-1", "i-1", false)).resolves.toBe("done")
        await expect(settings.service.saveSettings("ws-1", "i-1", { replyTimeout: 30 })).resolves.toBe("done")
        await expect(version.service.activateVersion("ws-1", "i-1", "v-2", "ready")).resolves.toBe("done")

        expect(mode.entityManager.query).toHaveBeenCalledWith(SET_OPERATING_MODE, ["i-1", "ws-1", "autopilot"])
        expect(live.entityManager.query).toHaveBeenCalledWith(SET_LIVE, ["i-1", "ws-1", true, "live"])
        expect(paused.entityManager.query).toHaveBeenCalledWith(SET_LIVE, ["i-1", "ws-1", false, "paused"])
        expect(settings.entityManager.query).toHaveBeenCalledWith(SAVE_SETTINGS, [
            "i-1",
            "ws-1",
            JSON.stringify({ replyTimeout: 30 }),
        ])
        expect(version.entityManager.query).toHaveBeenCalledWith(ACTIVATE_VERSION, ["i-1", "ws-1", "v-2", "ready"])
    })

    it("answers null when the installation is not in the workspace", async () => {
        const { service } = await build(mockEntityManager({ query: [FIND_SYNC_STATUS, []] }))

        await expect(service.syncStatus("ws-1", "i-9")).resolves.toBeNull()
    })

    it("keeps an ok or error copy and treats any other stored state as none", async () => {
        const ok = await build(
            mockEntityManager({
                query: [
                    FIND_SYNC_STATUS,
                    [
                        {
                            state: "ok",
                            syncedVersion: 2,
                            activeVersion: 2,
                            checkedAt: "2026-10-12T00:00:00.000Z",
                            error: null,
                        },
                    ],
                ],
            }),
        )
        const other = await build(
            mockEntityManager({
                query: [
                    FIND_SYNC_STATUS,
                    [{ state: "pending", syncedVersion: null, activeVersion: 2, checkedAt: null, error: null }],
                ],
            }),
        )

        await expect(ok.service.syncStatus("ws-1", "i-1")).resolves.toEqual({
            state: "ok",
            syncedVersion: 2,
            activeVersion: 2,
            checkedAt: "2026-10-12T00:00:00.000Z",
            error: null,
        })
        await expect(other.service.syncStatus("ws-1", "i-1")).resolves.toEqual({
            state: "none",
            syncedVersion: null,
            activeVersion: 2,
            checkedAt: null,
            error: null,
        })
    })

    it("reads the requirement facts and the OpenClaw installations", async () => {
        const facts = { providers: ["zalo"], chatAgents: 1, staff: 2, members: 3 }
        const requirements = await build(mockEntityManager({ query: [FIND_REQUIREMENT_FACTS, [facts]] }))
        const openclaw = await build(
            mockEntityManager({ query: [LIST_ON_OPENCLAW, [{ id: "i-1", workspaceId: "ws-1" }]] }),
        )

        await expect(requirements.service.requirementFacts("ws-1")).resolves.toEqual(facts)
        await expect(openclaw.service.onOpenclaw(null, 10)).resolves.toEqual([{ id: "i-1", workspaceId: "ws-1" }])
        expect(requirements.entityManager.query).toHaveBeenCalledWith(FIND_REQUIREMENT_FACTS, ["ws-1"])
        expect(openclaw.entityManager.query).toHaveBeenCalledWith(LIST_ON_OPENCLAW, [null, 10])
    })
})
