import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { NewSetupSession, SetupRevisionRecord, SetupSessionRecord } from "./module-setup-sessions.contracts"
import { ModuleSetupSessionEntity } from "./persistence/entities"
import { SetupSessionsService } from "./setup-sessions.service"

const session: SetupSessionRecord = {
    id: "ses-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "Tea", facts: [{ key: "city", text: "Hue" }] },
    gateEvidence: { tone: { status: "proposed", evidence: "warm" } },
    createdAt: "2026-10-12T10:00:00.000Z",
}

const row = Object.assign(new ModuleSetupSessionEntity(), {
    id: "ses-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft" as const,
    draftSnapshot: session.draft,
    gateEvidence: session.gateEvidence,
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
})

const opening: NewSetupSession = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    draft: session.draft,
    gateEvidence: session.gateEvidence,
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [SetupSessionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(SetupSessionsService)
}

describe("SetupSessionsService", () => {
    it("finds the newest revision", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, row] })

        await expect((await build(em)).latest("inst-1")).resolves.toEqual(session)

        expect(em.findOne).toHaveBeenCalledWith(ModuleSetupSessionEntity, {
            where: { installationId: "inst-1" },
            order: { revision: "DESC" },
        })
    })

    it("answers nothing before the chat was opened", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, null] })

        await expect((await build(em)).latest("inst-1")).resolves.toBeNull()
    })

    it("finds one session of the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, row] })

        await expect((await build(em)).find("ws-1", "ses-1")).resolves.toEqual(session)

        expect(em.findOne).toHaveBeenCalledWith(ModuleSetupSessionEntity, {
            where: { id: "ses-1", workspaceId: "ws-1" },
        })
    })

    it("answers nothing when the session is not in the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, null] })

        await expect((await build(em)).find("ws-1", "missing")).resolves.toBeNull()
    })

    it("lists every revision, oldest first", async () => {
        const revisions: ReadonlyArray<SetupRevisionRecord> = [{ id: "ses-1", revision: 1, status: "draft" }]
        const em = mockEntityManager({ find: [ModuleSetupSessionEntity, [row]] })

        await expect((await build(em)).revisions("inst-1")).resolves.toEqual(revisions)

        expect(em.find).toHaveBeenCalledWith(ModuleSetupSessionEntity, {
            select: { id: true, revision: true, status: true },
            where: { installationId: "inst-1" },
            order: { revision: "ASC" },
            take: 100,
        })
    })

    it("opens the next draft and reads it back for the time the database set", async () => {
        const em = mockEntityManager({
            save: [ModuleSetupSessionEntity, Object.assign(new ModuleSetupSessionEntity(), { id: "ses-1" })],
            findOneOrFail: [ModuleSetupSessionEntity, row],
        })

        await expect((await build(em)).open(opening)).resolves.toEqual(session)

        expect(em.save).toHaveBeenCalledWith(
            ModuleSetupSessionEntity,
            expect.objectContaining({
                workspaceId: "ws-1",
                installationId: "inst-1",
                revision: 1,
                draftSnapshot: session.draft,
                gateEvidence: session.gateEvidence,
            }),
        )
        expect(em.findOneOrFail).toHaveBeenCalledWith(ModuleSetupSessionEntity, { where: { id: "ses-1" } })
    })
})

describe("SetupSessionsService > open races", () => {
    it("answers nothing when the same revision was opened first", async () => {
        const em = mockEntityManager()
        em.save.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }))

        await expect((await build(em)).open(opening)).resolves.toBeNull()
    })

    it("answers nothing when a plain object reports the unique violation", async () => {
        const em = mockEntityManager()
        em.save.mockRejectedValueOnce({ code: "23505" })

        await expect((await build(em)).open(opening)).resolves.toBeNull()
    })
})

describe("SetupSessionsService", () => {
    it("rethrows a database error that is not a unique violation", async () => {
        const em = mockEntityManager()
        em.save.mockRejectedValueOnce(Object.assign(new Error("foreign key"), { code: "23503" }))

        await expect((await build(em)).open(opening)).rejects.toThrow("foreign key")
    })

    it("rethrows an error that carries no code", async () => {
        const em = mockEntityManager()
        em.save.mockRejectedValueOnce(new Error("down"))

        await expect((await build(em)).open(opening)).rejects.toThrow("down")
    })

    it("rethrows a null failure", async () => {
        const em = mockEntityManager()
        em.save.mockRejectedValueOnce(null)

        await expect((await build(em)).open(opening)).rejects.toBeNull()
    })

    it("rethrows a text failure", async () => {
        const em = mockEntityManager()
        em.save.mockRejectedValueOnce("down")

        await expect((await build(em)).open(opening)).rejects.toBe("down")
    })

    it("changes the draft inside one transaction that locks the row and reads it again there", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [ModuleSetupSessionEntity, row],
                update: [ModuleSetupSessionEntity, { affected: 1 }],
            }),
        )
        const next = jest.fn(() => ({ draft: { summary: "Tea", facts: [] }, gateEvidence: {} }))

        await expect((await build(tx.em)).change("ses-1", next)).resolves.toEqual({
            ...session,
            draft: { summary: "Tea", facts: [] },
            gateEvidence: {},
        })

        expect(next.mock.calls).toEqual([[{ draft: session.draft, gateEvidence: session.gateEvidence }]])
        expect(tx.em.findOne).toHaveBeenCalledWith(ModuleSetupSessionEntity, {
            where: { id: "ses-1", status: "draft" },
            lock: { mode: "pessimistic_write" },
        })
        expect(tx.committedWrites.map((write) => write.method)).toEqual(["update"])
        expect(tx.em.update).toHaveBeenCalledWith(
            ModuleSetupSessionEntity,
            { id: "ses-1" },
            { draftSnapshot: { summary: "Tea", facts: [] }, gateEvidence: {} },
        )
    })
})

describe("SetupSessionsService > change in a row", () => {
    it("lets two changes in a row both land, the second reading what the first wrote", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [ModuleSetupSessionEntity, { affected: 1 }] }))
        const held = { current: row }
        tx.em.findOne.mockImplementation(() => Promise.resolve(held.current))
        tx.em.update.mockImplementation((_entity, _where, set) => {
            held.current = Object.assign(new ModuleSetupSessionEntity(), held.current, set)
            return Promise.resolve({ affected: 1, raw: [], generatedMaps: [] })
        })
        const service = await build(tx.em)

        await service.change("ses-1", (current) => ({
            draft: current.draft,
            gateEvidence: { ...current.gateEvidence, scope: { status: "confirmed", evidence: "A" } },
        }))
        const second = await service.change("ses-1", (current) => ({
            draft: current.draft,
            gateEvidence: { ...current.gateEvidence, hours: { status: "confirmed", evidence: "B" } },
        }))

        expect(second?.gateEvidence).toEqual({
            tone: { status: "proposed", evidence: "warm" },
            scope: { status: "confirmed", evidence: "A" },
            hours: { status: "confirmed", evidence: "B" },
        })
    })

    it("leaves the row alone when the edit answers null", async () => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [ModuleSetupSessionEntity, row] }))

        await expect((await build(tx.em)).change("ses-1", () => null)).resolves.toEqual(session)

        expect(tx.committedWrites).toEqual([])
    })

    it("answers null, and never runs the edit, when the session is no longer a draft", async () => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [ModuleSetupSessionEntity, null] }))
        const next = jest.fn(() => null)

        await expect((await build(tx.em)).change("ses-1", next)).resolves.toBeNull()

        expect(next).not.toHaveBeenCalled()
    })

    it("closes the draft as applied", async () => {
        const em = mockEntityManager({ update: [ModuleSetupSessionEntity, { affected: 1 }] })

        await expect((await build(em)).close("ses-1")).resolves.toBeUndefined()

        expect(em.update).toHaveBeenCalledWith(ModuleSetupSessionEntity, { id: "ses-1" }, { status: "applied" })
    })

    it("does not drop a fact when the installation has no session", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, null] })
        const service = await build(em)

        await expect(service.dropFact("inst-1", "city")).resolves.toBeUndefined()

        expect(em.findOne).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("SetupSessionsService", () => {
    it.each(["applied", "discarded"] as const)("leaves facts on a %s session unchanged", async (status) => {
        const closed = Object.assign(new ModuleSetupSessionEntity(), row, { status })
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, closed] })
        const service = await build(em)

        await expect(service.dropFact("inst-1", "city")).resolves.toBeUndefined()

        expect(em.findOne).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("leaves the draft unchanged when the requested fact is absent", async () => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [ModuleSetupSessionEntity, row] }))
        const service = await build(tx.em)

        await expect(service.dropFact("inst-1", "missing")).resolves.toBeUndefined()

        expect(tx.committedWrites).toEqual([])
    })

    it("removes matching facts while retaining the other facts, draft summary and evidence", async () => {
        const draft = {
            summary: "Tea shop in Hue",
            facts: [
                { key: "city", text: "Hue" },
                { key: "hours", text: "9 to 5" },
                { key: "city", text: "Old city" },
            ],
        }
        const current = Object.assign(new ModuleSetupSessionEntity(), row, { draftSnapshot: draft })
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [ModuleSetupSessionEntity, current],
                update: [ModuleSetupSessionEntity, { affected: 1 }],
            }),
        )
        const service = await build(tx.em)

        await expect(service.dropFact("inst-1", "city")).resolves.toBeUndefined()

        expect(tx.em.update).toHaveBeenCalledWith(
            ModuleSetupSessionEntity,
            { id: "ses-1" },
            {
                draftSnapshot: { summary: "Tea shop in Hue", facts: [{ key: "hours", text: "9 to 5" }] },
                gateEvidence: { tone: { status: "proposed", evidence: "warm" } },
            },
        )
        expect(draft.facts).toEqual([
            { key: "city", text: "Hue" },
            { key: "hours", text: "9 to 5" },
            { key: "city", text: "Old city" },
        ])
    })
})
