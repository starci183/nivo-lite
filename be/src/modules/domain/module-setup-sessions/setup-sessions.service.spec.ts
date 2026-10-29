import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
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

const savedRaw = () => ({
    id: "ses-1",
    workspace_id: "ws-1",
    installation_id: "inst-1",
    revision: 1,
    status: "draft",
    draft_snapshot: session.draft,
    gate_evidence: session.gateEvidence,
    created_at: new Date("2026-10-12T10:00:00.000Z"),
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

    it("opens the next draft", async () => {
        const em = mockEntityManager({ save: [ModuleSetupSessionEntity, row] })

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
    })

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

    it("stores the draft of an open session", async () => {
        const em = mockEntityManager()
        const update = fakeQueryBuilder({ execute: { raw: [savedRaw()] } })
        answerQueryBuilders(em, update)
        const change = { draft: session.draft, gateEvidence: session.gateEvidence }

        await expect((await build(em)).save("ses-1", change)).resolves.toEqual(session)

        expect(update.argsOf("set")).toEqual([[{ draftSnapshot: session.draft, gateEvidence: session.gateEvidence }]])
        expect(update.argsOf("where")).toEqual([[{ id: "ses-1", status: "draft" }]])
    })

    it("answers nothing when the session is no longer a draft", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }))

        await expect((await build(em)).save("ses-1", { draft: session.draft, gateEvidence: {} })).resolves.toBeNull()
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
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, row] })
        const service = await build(em)

        await expect(service.dropFact("inst-1", "missing")).resolves.toBeUndefined()

        expect(em.findOne).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
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
        const em = mockEntityManager({ findOne: [ModuleSetupSessionEntity, current] })
        const update = fakeQueryBuilder({ execute: { raw: [savedRaw()] } })
        answerQueryBuilders(em, update)
        const service = await build(em)

        await expect(service.dropFact("inst-1", "city")).resolves.toBeUndefined()

        expect(update.argsOf("set")).toEqual([
            [
                {
                    draftSnapshot: { summary: "Tea shop in Hue", facts: [{ key: "hours", text: "9 to 5" }] },
                    gateEvidence: { tone: { status: "proposed", evidence: "warm" } },
                },
            ],
        ])
        expect(update.argsOf("where")).toEqual([[{ id: "ses-1", status: "draft" }]])
        expect(draft.facts).toEqual([
            { key: "city", text: "Hue" },
            { key: "hours", text: "9 to 5" },
            { key: "city", text: "Old city" },
        ])
    })
})
