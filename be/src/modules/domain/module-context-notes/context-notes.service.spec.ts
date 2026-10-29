import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContextNotesService } from "./context-notes.service"
import { ModuleContextNotesErrorCode } from "./errors/module-context-notes.error"
import { ModuleContextNoteEntity } from "./persistence/entities"

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

const NOTE_ROW = Object.assign(new ModuleContextNoteEntity(), {
    ...NOTE,
    factKey: "note_abcd",
    createdAt: new Date(NOTE.createdAt),
})

const build = async (em: MockEntityManager = mockEntityManager()) => {
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
        const { service, em, members } = await build(mockEntityManager({ find: [ModuleContextNoteEntity, [NOTE_ROW]] }))

        await expect(service.pending("u1", "w1", "i1")).resolves.toEqual([NOTE])

        expect(members.require).toHaveBeenCalledWith("u1", "w1", ["owner", "manager"])
        expect(em.find).toHaveBeenCalledWith(ModuleContextNoteEntity, {
            where: { workspaceId: "w1", installationId: "i1", status: "pending" },
            order: { createdAt: "ASC" },
            take: 200,
        })
    })

    it("dismisses a pending note and drops its fact from the open draft", async () => {
        const { service, em, sessions } = await build()
        const update = fakeQueryBuilder({ execute: { raw: [{ installation_id: "i1", fact_key: "note_abcd" }] } })
        answerQueryBuilders(em, update)

        await expect(service.dismiss("u1", "w1", "n1")).resolves.toEqual({
            installationId: "i1",
            factKey: "note_abcd",
        })

        expect(update.argsOf("set")).toEqual([
            [{ status: "dismissed", decidedBy: "Lan", decidedAt: new Date("2026-10-13T02:00:00.000Z") }],
        ])
        expect(update.argsOf("where")).toEqual([[{ workspaceId: "w1", id: "n1", status: "pending" }]])
        expect(sessions.dropFact).toHaveBeenCalledWith("i1", "note_abcd")
    })

    it("refuses to dismiss a note that is not pending", async () => {
        const { service, em, sessions } = await build()
        answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }))

        await expect(service.dismiss("u1", "w1", "n1")).rejects.toMatchObject({
            code: ModuleContextNotesErrorCode.NotFound,
        })
        expect(sessions.dropFact).not.toHaveBeenCalled()
    })
})
