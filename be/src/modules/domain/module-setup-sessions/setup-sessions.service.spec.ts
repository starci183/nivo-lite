import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { NewSetupSession, SetupRevisionRecord, SetupSessionRecord } from "./module-setup-sessions.contracts"
import {
    CLOSE_SESSION,
    FIND_LATEST_SESSION,
    FIND_SESSION,
    INSERT_SESSION,
    LIST_REVISIONS,
    SAVE_TURN,
} from "./persistence/module-setup-sessions.sql"
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
        const em = mockEntityManager({ query: [FIND_LATEST_SESSION, [session]] })

        await expect((await build(em)).latest("inst-1")).resolves.toEqual(session)

        expect(em.query).toHaveBeenCalledWith(FIND_LATEST_SESSION, ["inst-1"])
    })

    it("answers nothing before the chat was opened", async () => {
        const em = mockEntityManager({ query: [FIND_LATEST_SESSION, []] })

        await expect((await build(em)).latest("inst-1")).resolves.toBeNull()
    })

    it("finds one session of the workspace", async () => {
        const em = mockEntityManager({ query: [FIND_SESSION, [session]] })

        await expect((await build(em)).find("ws-1", "ses-1")).resolves.toEqual(session)

        expect(em.query).toHaveBeenCalledWith(FIND_SESSION, ["ses-1", "ws-1"])
    })

    it("answers nothing when the session is not in the workspace", async () => {
        const em = mockEntityManager({ query: [FIND_SESSION, []] })

        await expect((await build(em)).find("ws-1", "missing")).resolves.toBeNull()
    })

    it("lists every revision, oldest first", async () => {
        const revisions: ReadonlyArray<SetupRevisionRecord> = [{ id: "ses-1", revision: 1, status: "draft" }]
        const em = mockEntityManager({ query: [LIST_REVISIONS, revisions] })

        await expect((await build(em)).revisions("inst-1")).resolves.toEqual(revisions)

        expect(em.query).toHaveBeenCalledWith(LIST_REVISIONS, ["inst-1"])
    })

    it("opens the next draft", async () => {
        const em = mockEntityManager({ query: [INSERT_SESSION, [session]] })

        await expect((await build(em)).open(opening)).resolves.toEqual(session)

        expect(em.query).toHaveBeenCalledWith(INSERT_SESSION, [
            "ws-1",
            "inst-1",
            1,
            JSON.stringify(session.draft),
            JSON.stringify(session.gateEvidence),
        ])
    })

    it("answers nothing when the insert writes no row", async () => {
        const em = mockEntityManager({ query: [INSERT_SESSION, []] })

        await expect((await build(em)).open(opening)).resolves.toBeNull()
    })

    it("answers nothing when the same revision was opened first", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "23505" }))

        await expect((await build(em)).open(opening)).resolves.toBeNull()
    })

    it("answers nothing when a plain object reports the unique violation", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValueOnce({ code: "23505" })

        await expect((await build(em)).open(opening)).resolves.toBeNull()
    })

    it("rethrows a database error that is not a unique violation", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValueOnce(Object.assign(new Error("foreign key"), { code: "23503" }))

        await expect((await build(em)).open(opening)).rejects.toThrow("foreign key")
    })

    it("rethrows an error that carries no code", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValueOnce(new Error("down"))

        await expect((await build(em)).open(opening)).rejects.toThrow("down")
    })

    it("rethrows a null failure", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValueOnce(null)

        await expect((await build(em)).open(opening)).rejects.toBeNull()
    })

    it("rethrows a text failure", async () => {
        const em = mockEntityManager()
        em.query.mockRejectedValueOnce("down")

        await expect((await build(em)).open(opening)).rejects.toBe("down")
    })

    it("stores the draft of an open session", async () => {
        const em = mockEntityManager({ query: [SAVE_TURN, [session]] })
        const change = { draft: session.draft, gateEvidence: session.gateEvidence }

        await expect((await build(em)).save("ses-1", change)).resolves.toEqual(session)

        expect(em.query).toHaveBeenCalledWith(SAVE_TURN, [
            "ses-1",
            JSON.stringify(session.draft),
            JSON.stringify(session.gateEvidence),
        ])
    })

    it("answers nothing when the session is no longer a draft", async () => {
        const em = mockEntityManager({ query: [SAVE_TURN, []] })

        await expect((await build(em)).save("ses-1", { draft: session.draft, gateEvidence: {} })).resolves.toBeNull()
    })

    it("closes the draft as applied", async () => {
        const em = mockEntityManager({ query: [CLOSE_SESSION, [{ id: "ses-1" }]] })

        await expect((await build(em)).close("ses-1")).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledWith(CLOSE_SESSION, ["ses-1"])
    })
})
