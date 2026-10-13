import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContextNotesService } from "./context-notes.service"
import { ModuleContextNotesErrorCode } from "./errors/module-context-notes.error"
import { DISMISS_NOTE, LIST_PENDING_NOTES } from "./persistence/context-notes.sql"

const MEMBER: WorkspaceMember = {
    userId: "u1",
    workspaceId: "w1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const NOTE = {
    id: "n1",
    installationId: "i1",
    body: "Combo price rose to 650000",
    source: "office" as const,
    authorName: "Lan",
    authorRole: "manager",
    status: "pending" as const,
    createdAt: "2026-10-13T01:00:00.000Z",
}

const build = async () => {
    const em = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const sessions = mock<SetupSessionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContextNotesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T02:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: SetupSessionsService, useValue: sessions },
        ],
    }).compile()
    return { service: moduleRef.get(ContextNotesService), em, members, sessions }
}

describe("ContextNotesService", () => {
    it("lists the pending notes of an installation for a manager", async () => {
        const { service, em, members } = await build()
        em.query.mockResolvedValueOnce([NOTE])

        await expect(service.pending("u1", "w1", "i1")).resolves.toEqual([NOTE])

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(em.query).toHaveBeenCalledWith(LIST_PENDING_NOTES, ["w1", "i1"])
    })

    it("dismisses a pending note and drops its fact from the open draft", async () => {
        const { service, em, sessions } = await build()
        em.query.mockResolvedValueOnce([{ installationId: "i1", factKey: "note_abcd" }])

        await expect(service.dismiss("u1", "w1", "n1")).resolves.toEqual({
            installationId: "i1",
            factKey: "note_abcd",
        })

        expect(em.query).toHaveBeenCalledWith(DISMISS_NOTE, ["w1", "n1", "Lan", "2026-10-13T02:00:00.000Z"])
        expect(sessions.dropFact).toHaveBeenCalledWith("i1", "note_abcd")
    })

    it("refuses to dismiss a note that is not pending", async () => {
        const { service, em, sessions } = await build()
        em.query.mockResolvedValueOnce([])

        await expect(service.dismiss("u1", "w1", "n1")).rejects.toMatchObject({
            code: ModuleContextNotesErrorCode.NotFound,
        })
        expect(sessions.dropFact).not.toHaveBeenCalled()
    })
})
