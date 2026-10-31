import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { NewSetupMessage, SetupMessageRecord } from "./module-setup-messages.contracts"
import { ModuleSetupMessageEntity } from "./persistence/entities"
import { SetupMessagesService } from "./setup-messages.service"

const message: SetupMessageRecord = {
    id: "msg-1",
    setupSessionId: "ses-1",
    role: "user",
    author: "Lan",
    body: "We sell tea",
    createdAt: "2026-10-12T10:00:00.000Z",
}

const row = Object.assign(new ModuleSetupMessageEntity(), {
    ...message,
    workspaceId: "ws-1",
    createdAt: new Date(message.createdAt),
})

const posted: NewSetupMessage = {
    workspaceId: "ws-1",
    setupSessionId: "ses-1",
    role: "assistant",
    author: "NIVO",
    body: "Noted",
}

const build = async (entityManager: MockEntityManager) => {
    const sessions = mock<SetupSessionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupMessagesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: SetupSessionsService, useValue: sessions },
        ],
    }).compile()
    return { service: moduleRef.get(SetupMessagesService), sessions }
}

describe("SetupMessagesService", () => {
    it("lists the chat of an installation across its revisions", async () => {
        const em = mockEntityManager({ find: [ModuleSetupMessageEntity, [row]] })
        const { service, sessions } = await build(em)
        sessions.revisions.mockResolvedValue([
            { id: "ses-1", revision: 1, status: "applied" },
            { id: "ses-2", revision: 2, status: "draft" },
        ])

        await expect(service.ofInstallation("inst-1")).resolves.toEqual([message])

        expect(sessions.revisions).toHaveBeenCalledWith("inst-1")
        expect(em.find).toHaveBeenCalledWith(ModuleSetupMessageEntity, {
            where: { setupSessionId: In(["ses-1", "ses-2"]) },
            order: { createdAt: "ASC", id: "ASC" },
            take: 2000,
        })
    })

    it("lists nothing for an installation that never opened a session", async () => {
        const em = mockEntityManager()
        const { service, sessions } = await build(em)
        sessions.revisions.mockResolvedValue([])

        await expect(service.ofInstallation("inst-1")).resolves.toEqual([])

        expect(em.find).not.toHaveBeenCalled()
    })

    it("lists the chat of one session", async () => {
        const em = mockEntityManager({ find: [ModuleSetupMessageEntity, [row]] })

        await expect((await build(em)).service.ofSession("ses-1")).resolves.toEqual([message])

        expect(em.find).toHaveBeenCalledWith(ModuleSetupMessageEntity, {
            where: { setupSessionId: "ses-1" },
            order: { createdAt: "ASC", id: "ASC" },
            take: 2000,
        })
    })
})

describe("SetupMessagesService > lines", () => {
    it("finds one message of the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupMessageEntity, row] })

        await expect((await build(em)).service.find("ws-1", "msg-1")).resolves.toEqual(message)

        expect(em.findOne).toHaveBeenCalledWith(ModuleSetupMessageEntity, {
            where: { id: "msg-1", workspaceId: "ws-1" },
        })
    })

    it("answers nothing when the message is not in the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupMessageEntity, null] })

        await expect((await build(em)).service.find("ws-1", "missing")).resolves.toBeNull()
    })

    it("stores one line of the chat", async () => {
        const stored: SetupMessageRecord = {
            id: "msg-2",
            setupSessionId: "ses-1",
            role: "assistant",
            author: "NIVO",
            body: "Noted",
            createdAt: "2026-10-12T10:01:00.000Z",
        }
        const savedRow = Object.assign(new ModuleSetupMessageEntity(), {
            ...stored,
            workspaceId: "ws-1",
            createdAt: new Date(stored.createdAt),
        })
        const em = mockEntityManager({
            save: [ModuleSetupMessageEntity, Object.assign(new ModuleSetupMessageEntity(), { id: "msg-2" })],
            findOneOrFail: [ModuleSetupMessageEntity, savedRow],
        })

        await expect((await build(em)).service.post(posted)).resolves.toEqual(stored)

        expect(em.save).toHaveBeenCalledWith(
            ModuleSetupMessageEntity,
            expect.objectContaining({
                workspaceId: "ws-1",
                setupSessionId: "ses-1",
                role: "assistant",
                author: "NIVO",
                body: "Noted",
            }),
        )
        expect(em.findOneOrFail).toHaveBeenCalledWith(ModuleSetupMessageEntity, { where: { id: "msg-2" } })
    })

    it("stores and reads the line back through the transaction it is given", async () => {
        const own = mockEntityManager()
        const tx = mockEntityManager({
            save: [ModuleSetupMessageEntity, Object.assign(new ModuleSetupMessageEntity(), { id: "msg-1" })],
            findOneOrFail: [ModuleSetupMessageEntity, row],
        })

        await expect((await build(own)).service.post(posted, tx)).resolves.toEqual(message)

        expect(tx.save).toHaveBeenCalledTimes(1)
        expect(own.save).not.toHaveBeenCalled()
    })
})
