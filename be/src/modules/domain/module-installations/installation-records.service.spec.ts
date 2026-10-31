import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull, MoreThan, Not } from "typeorm"
import {
    ANY_FUNCTION,
    answerQueryBuilders,
    fakeQueryBuilder,
} from "@tests/fixtures/builders/fake-query-builder.builder"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InstallationRecordsService } from "./installation-records.service"
import type { InstallationRecord, NewInstallation } from "./module-installations.contracts"
import { ModuleInstallationEntity } from "./persistence/entities"

const UNIQUE_VIOLATION = { code: "23505" }

const recordOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "sales",
    name: "Sales",
    isMulti: false,
    agentId: "agent-1",
    status: "live",
    operatingMode: "assist",
    liveEnabled: true,
    activeContextVersionId: "version-1",
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
})

/** The stored row of a record: the entity with a Date in place of the ISO text. */
const entityOf = (over: Partial<InstallationRecord> = {}): ModuleInstallationEntity => {
    const record = recordOf(over)
    return Object.assign(new ModuleInstallationEntity(), { ...record, createdAt: new Date(record.createdAt) })
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [InstallationRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(InstallationRecordsService)
}

const installation: NewInstallation = {
    workspaceId: "ws-1",
    moduleKey: "sales",
    name: "Sales",
    agentId: "agent-1",
    operatingMode: "assist",
}

describe("InstallationRecordsService", () => {
    it("lists the installations of the workspace", async () => {
        const records = [recordOf(), recordOf({ id: "inst-2", name: "Bookings" })]
        const em = mockEntityManager({ find: [ModuleInstallationEntity, records.map((record) => entityOf(record))] })
        const service = await build(em)

        await expect(service.list("ws-1")).resolves.toEqual(records)

        expect(em.find).toHaveBeenCalledWith(ModuleInstallationEntity, {
            where: { workspaceId: "ws-1", status: Not("removed") },
            order: { createdAt: "ASC", id: "ASC" },
            take: 200,
        })
    })
    it("finds an installation by id or answers null", async () => {
        const em = mockEntityManager({
            findOne: [
                [ModuleInstallationEntity, entityOf()],
                [ModuleInstallationEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.findById("inst-1")).resolves.toEqual(recordOf())
        await expect(service.findById("missing")).resolves.toBeNull()

        expect(em.findOne).toHaveBeenNthCalledWith(1, ModuleInstallationEntity, { where: { id: "inst-1" } })
        expect(em.findOne).toHaveBeenNthCalledWith(2, ModuleInstallationEntity, { where: { id: "missing" } })
    })
    it("finds the first installation of a module or answers null", async () => {
        const em = mockEntityManager({
            findOne: [
                [ModuleInstallationEntity, entityOf()],
                [ModuleInstallationEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.firstOfModule("ws-1", "sales")).resolves.toEqual(recordOf())
        await expect(service.firstOfModule("ws-1", "booking")).resolves.toBeNull()

        expect(em.findOne).toHaveBeenNthCalledWith(1, ModuleInstallationEntity, {
            where: { workspaceId: "ws-1", moduleKey: "sales", status: Not("removed") },
            order: { createdAt: "ASC", id: "ASC" },
        })
    })
})

describe("InstallationRecordsService", () => {
    it("lists the workspaces where a module is installed", async () => {
        const em = mockEntityManager()
        const query = fakeQueryBuilder({ getRawMany: [{ id: "ws-1" }] })
        answerQueryBuilders(em, query)
        const service = await build(em)

        await expect(service.workspacesOf("accounting")).resolves.toEqual(["ws-1"])

        expect(query.argsOf("select")).toEqual([["i.workspaceId", "id"]])
        expect(query.argsOf("distinct")).toEqual([[true]])
        expect(query.argsOf("where")).toEqual([
            ["i.moduleKey = :moduleKey AND i.status <> 'removed'", { moduleKey: "accounting" }],
        ])
        expect(query.argsOf("limit")).toEqual([[1000]])
    })
    it("finds the installation driven by an agent or answers null", async () => {
        const em = mockEntityManager({
            findOne: [
                [ModuleInstallationEntity, entityOf()],
                [ModuleInstallationEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.ofAgent("ws-1", "agent-1")).resolves.toEqual(recordOf())
        await expect(service.ofAgent("ws-1", "unbound")).resolves.toBeNull()

        expect(em.findOne).toHaveBeenNthCalledWith(1, ModuleInstallationEntity, {
            where: { workspaceId: "ws-1", agentId: "agent-1" },
        })
    })
})

describe("InstallationRecordsService", () => {
    it("lists the names of instances with the requested exclusion", async () => {
        const names = [{ id: "inst-2", name: "Front desk" }]
        const stored = names.map((name) => Object.assign(new ModuleInstallationEntity(), name))
        const em = mockEntityManager({ find: [ModuleInstallationEntity, stored] })
        const service = await build(em)

        await expect(service.instanceNames("ws-1", "sales", "inst-1")).resolves.toEqual(names)
        await expect(service.instanceNames("ws-1", "sales", null)).resolves.toEqual(names)

        expect(em.find).toHaveBeenNthCalledWith(1, ModuleInstallationEntity, {
            select: { id: true, name: true },
            where: { workspaceId: "ws-1", moduleKey: "sales", status: Not("removed"), id: Not("inst-1") },
            take: 1000,
        })
        expect(em.find).toHaveBeenNthCalledWith(2, ModuleInstallationEntity, {
            select: { id: true, name: true },
            where: { workspaceId: "ws-1", moduleKey: "sales", status: Not("removed") },
            take: 1000,
        })
    })
})

describe("InstallationRecordsService", () => {
    it("lists OpenClaw installations within the requested workspace and limit", async () => {
        const installations = [{ id: "inst-1", workspaceId: "ws-1" }]
        const em = mockEntityManager()
        const scoped = fakeQueryBuilder({ getRawMany: installations })
        const everywhere = fakeQueryBuilder({ getRawMany: installations })
        answerQueryBuilders(em, scoped, everywhere)
        const service = await build(em)

        await expect(service.onOpenclaw("ws-1", 20)).resolves.toEqual(installations)
        await expect(service.onOpenclaw(null, 100)).resolves.toEqual(installations)

        expect(scoped.argsOf("andWhere")).toEqual([
            ["COALESCE(i.settings ->> 'processor', '') <> 'nivo'"],
            ["i.workspaceId = :workspaceId", { workspaceId: "ws-1" }],
        ])
        expect(scoped.argsOf("limit")).toEqual([[20]])
        expect(everywhere.argsOf("andWhere")).toEqual([["COALESCE(i.settings ->> 'processor', '') <> 'nivo'"]])
        expect(everywhere.argsOf("limit")).toEqual([[100]])
    })
})

describe("InstallationRecordsService / find", () => {
    it("answers the row or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [ModuleInstallationEntity, entityOf()],
                [ModuleInstallationEntity, null],
            ],
        })
        const service = await build(em)

        await expect(service.find("ws-1", "inst-1")).resolves.toEqual(recordOf())
        await expect(service.find("ws-1", "missing")).resolves.toBeNull()

        expect(em.findOne).toHaveBeenNthCalledWith(1, ModuleInstallationEntity, {
            where: { workspaceId: "ws-1", id: "inst-1" },
        })
    })
})

describe("InstallationRecordsService / boundAgentIds", () => {
    it("answers the ids of the bound agents", async () => {
        const stored = ["agent-1", "agent-2"].map((agentId) =>
            Object.assign(new ModuleInstallationEntity(), { agentId }),
        )
        const em = mockEntityManager({ find: [ModuleInstallationEntity, stored] })
        const service = await build(em)

        await expect(service.boundAgentIds("ws-1")).resolves.toEqual(["agent-1", "agent-2"])

        em.find.mockResolvedValueOnce([Object.assign(new ModuleInstallationEntity(), { agentId: null })])
        await expect(service.boundAgentIds("ws-1")).resolves.toEqual([])

        expect(em.find).toHaveBeenCalledWith(ModuleInstallationEntity, {
            select: { agentId: true },
            where: { workspaceId: "ws-1", agentId: Not(IsNull()) },
            take: 1000,
        })
    })
})

describe("InstallationRecordsService / insert", () => {
    it("answers the id of the new installation", async () => {
        const em = mockEntityManager({ insert: [ModuleInstallationEntity, { identifiers: [{ id: "inst-9" }] }] })
        const service = await build(em)

        await expect(service.insert(installation)).resolves.toBe("inst-9")
        expect(em.insert).toHaveBeenCalledWith(ModuleInstallationEntity, {
            workspaceId: "ws-1",
            moduleKey: "sales",
            name: "Sales",
            agentId: "agent-1",
            status: "setup",
            operatingMode: "assist",
        })
    })
    it("answers null when the label or the agent is taken", async () => {
        const em = mockEntityManager()
        em.insert.mockRejectedValueOnce(UNIQUE_VIOLATION)
        const service = await build(em)

        await expect(service.insert(installation)).resolves.toBeNull()
    })
    it("lets any other failure through", async () => {
        const failure = { code: "57014" }
        const em = mockEntityManager()
        em.insert.mockRejectedValueOnce(failure)
        const service = await build(em)

        await expect(service.insert(installation)).rejects.toBe(failure)
    })
    it("answers null when an insert returns no identifier", async () => {
        const em = mockEntityManager({ insert: [ModuleInstallationEntity, { identifiers: [] }] })
        const service = await build(em)

        await expect(service.insert(installation)).resolves.toBeNull()
    })
    it.each([null, "database down", { message: "database down" }])(
        "preserves a failure that does not report a database code: %p",
        async (failure) => {
            const em = mockEntityManager()
            em.insert.mockRejectedValue(failure)
            const service = await build(em)

            await expect(service.insert(installation)).rejects.toBe(failure)
        },
    )
})

describe("InstallationRecordsService / writes", () => {
    it("writes the installation name, operating mode, live state and active version", async () => {
        const em = mockEntityManager({ update: [ModuleInstallationEntity, { affected: 1 }] })
        const service = await build(em)

        await expect(service.rename("ws-1", "inst-1", "Front desk")).resolves.toBe("done")
        await expect(service.setOperatingMode("ws-1", "inst-1", "autopilot")).resolves.toBe("done")
        await expect(service.setLive("ws-1", "inst-1", true, false)).resolves.toBe("done")
        await expect(service.activateVersion("ws-1", "inst-1", "version-2", "ready")).resolves.toBe("done")

        const where = { id: "inst-1", workspaceId: "ws-1" }
        expect(em.update).toHaveBeenNthCalledWith(1, ModuleInstallationEntity, where, { name: "Front desk" })
        expect(em.update).toHaveBeenNthCalledWith(2, ModuleInstallationEntity, where, { operatingMode: "autopilot" })
        expect(em.update).toHaveBeenNthCalledWith(
            3,
            ModuleInstallationEntity,
            { ...where, activeContextVersionId: Not(IsNull()) },
            { liveEnabled: true, status: "live" },
        )
        expect(em.update).toHaveBeenNthCalledWith(4, ModuleInstallationEntity, where, {
            activeContextVersionId: "version-2",
            status: "ready",
        })
    })
    it("answers done when the row changed and missing when there was none", async () => {
        const em = mockEntityManager({
            update: [
                [ModuleInstallationEntity, { affected: 1 }],
                [ModuleInstallationEntity, { affected: 0 }],
            ],
        })
        const service = await build(em)

        await expect(service.rename("ws-1", "inst-1", "Front desk")).resolves.toBe("done")
        await expect(service.setLive("ws-1", "inst-9", false, false)).resolves.toBe("missing")
        expect(em.update).toHaveBeenLastCalledWith(
            ModuleInstallationEntity,
            { id: "inst-9", workspaceId: "ws-1" },
            { liveEnabled: false, status: "paused" },
        )
    })
    it("records a live agent that waits for a connection as needs_connection", async () => {
        const em = mockEntityManager({ update: [ModuleInstallationEntity, { affected: 1 }] })
        const service = await build(em)

        await expect(service.setLive("ws-1", "inst-1", true, true)).resolves.toBe("done")
        expect(em.update).toHaveBeenCalledWith(
            ModuleInstallationEntity,
            { id: "inst-1", workspaceId: "ws-1", activeContextVersionId: Not(IsNull()) },
            { liveEnabled: true, status: "needs_connection" },
        )
    })
    it("answers taken on a unique violation and stores the settings", async () => {
        const em = mockEntityManager()
        em.update.mockRejectedValueOnce(UNIQUE_VIOLATION)
        const service = await build(em)

        await expect(service.saveSettings("ws-1", "inst-1", { holdingMessage: "One moment" })).resolves.toBe("taken")
        expect(em.update).toHaveBeenCalledWith(
            ModuleInstallationEntity,
            { id: "inst-1", workspaceId: "ws-1" },
            { settings: { holdingMessage: "One moment" } },
        )
    })
    it("lets any other write failure through", async () => {
        const failure = { code: "57014" }
        const em = mockEntityManager()
        em.update.mockRejectedValueOnce(failure)
        const service = await build(em)

        await expect(service.setLive("ws-1", "inst-1", true, false)).rejects.toBe(failure)
    })
})

describe("InstallationRecordsService / settleConnection", () => {
    it("answers the status the connection check moved the installation to, or null when it did not move", async () => {
        const em = mockEntityManager()
        const moved = fakeQueryBuilder({ execute: { raw: [{ status: "needs_connection" }] } })
        const stayed = fakeQueryBuilder({ execute: { raw: [] } })
        answerQueryBuilders(em, moved, stayed)
        const service = await build(em)

        await expect(service.settleConnection("ws-1", "inst-1", false)).resolves.toBe("needs_connection")
        await expect(service.settleConnection("ws-1", "inst-1", true)).resolves.toBeNull()

        expect(writeExpressionOf(moved.argsOf("set")[0]?.[0], "status")).toContain("CASE WHEN NOT :ready::boolean")
        expect(moved.argsOf("where")).toEqual([
            ["id = :installationId AND workspace_id = :workspaceId", { installationId: "inst-1", workspaceId: "ws-1" }],
        ])
        expect(moved.argsOf("setParameter")).toEqual([["ready", false]])
        expect(stayed.argsOf("setParameter")).toEqual([["ready", true]])
        expect(moved.argsOf("returning")).toEqual([["status"]])
    })
})

describe("InstallationRecordsService > markRemoved", () => {
    it("removes the row through the manager it is given, and says when there is nothing to remove", async () => {
        const em = mockEntityManager({ update: [ModuleInstallationEntity, { affected: 1 }] })
        const service = await build(mockEntityManager())

        await expect(service.markRemoved("ws-1", "inst-1", "Lan", em)).resolves.toBe("done")
        expect(em.update).toHaveBeenCalledWith(
            ModuleInstallationEntity,
            { id: "inst-1", workspaceId: "ws-1", status: Not("removed") },
            { status: "removed", liveEnabled: false, removedAt: ANY_FUNCTION, removedBy: "Lan" },
        )

        expect(writeExpressionOf(em.update.mock.calls[0]?.[2], "removedAt")).toBe("now()")

        const none = mockEntityManager({ update: [ModuleInstallationEntity, { affected: 0 }] })
        await expect(service.markRemoved("ws-1", "inst-1", "Lan", none)).resolves.toBe("missing")
        const unknown = mockEntityManager({ update: [ModuleInstallationEntity, {}] })
        await expect(service.markRemoved("ws-1", "inst-1", "Lan", unknown)).resolves.toBe("missing")
    })
})

describe("InstallationRecordsService.page", () => {
    it("reads a page of installations after an id, by id, leaving out removed ones", async () => {
        const em = mockEntityManager({ find: [ModuleInstallationEntity, []] })
        const service = await build(em)

        await expect(service.page("inst-5", 200)).resolves.toEqual([])
        await service.page("", 50)

        expect(em.find.mock.calls.map((call) => call[1])).toEqual([
            { where: { status: Not("removed"), id: MoreThan("inst-5") }, order: { id: "ASC" }, take: 200 },
            { where: { status: Not("removed"), id: MoreThan("") }, order: { id: "ASC" }, take: 50 },
        ])
    })
})
