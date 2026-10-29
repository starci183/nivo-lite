import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
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
    const moduleRef = await Test.createTestingModule({
        providers: [SetupMessagesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(SetupMessagesService)
}

describe("SetupMessagesService", () => {
    it("lists the chat of an installation", async () => {
        const em = mockEntityManager()
        const query = fakeQueryBuilder({ getMany: [row] })
        answerQueryBuilders(em, query)

        await expect((await build(em)).ofInstallation("inst-1")).resolves.toEqual([message])

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ModuleSetupMessageEntity, "m")
        expect(query.argsOf("where")).toEqual([["s.installationId = :installationId", { installationId: "inst-1" }]])
        expect(query.argsOf("orderBy")).toEqual([["m.createdAt", "ASC"]])
        expect(query.argsOf("addOrderBy")).toEqual([["m.id", "ASC"]])
        expect(query.argsOf("limit")).toEqual([[2000]])
    })

    it("lists the chat of one session", async () => {
        const em = mockEntityManager({ find: [ModuleSetupMessageEntity, [row]] })

        await expect((await build(em)).ofSession("ses-1")).resolves.toEqual([message])

        expect(em.find).toHaveBeenCalledWith(ModuleSetupMessageEntity, {
            where: { setupSessionId: "ses-1" },
            order: { createdAt: "ASC", id: "ASC" },
            take: 2000,
        })
    })

    it("finds one message of the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupMessageEntity, row] })

        await expect((await build(em)).find("ws-1", "msg-1")).resolves.toEqual(message)

        expect(em.findOne).toHaveBeenCalledWith(ModuleSetupMessageEntity, {
            where: { id: "msg-1", workspaceId: "ws-1" },
        })
    })

    it("answers nothing when the message is not in the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupMessageEntity, null] })

        await expect((await build(em)).find("ws-1", "missing")).resolves.toBeNull()
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
        const em = mockEntityManager({ save: [ModuleSetupMessageEntity, savedRow] })

        await expect((await build(em)).post(posted)).resolves.toEqual(stored)

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
    })
})
