import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { NewSetupMessage, SetupMessageRecord } from "./module-setup-messages.contracts"
import {
    FIND_MESSAGE,
    INSERT_SETUP_MESSAGE,
    LIST_INSTALLATION_MESSAGES,
    LIST_SESSION_MESSAGES,
} from "./persistence/module-setup-messages.sql"
import { SetupMessagesService } from "./setup-messages.service"

const message: SetupMessageRecord = {
    id: "msg-1",
    setupSessionId: "ses-1",
    role: "user",
    author: "Lan",
    body: "We sell tea",
    createdAt: "2026-10-12T10:00:00.000Z",
}

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
        const em = mockEntityManager({ query: [LIST_INSTALLATION_MESSAGES, [message]] })

        await expect((await build(em)).ofInstallation("inst-1")).resolves.toEqual([message])

        expect(em.query).toHaveBeenCalledWith(LIST_INSTALLATION_MESSAGES, ["inst-1"])
    })

    it("lists the chat of one session", async () => {
        const em = mockEntityManager({ query: [LIST_SESSION_MESSAGES, [message]] })

        await expect((await build(em)).ofSession("ses-1")).resolves.toEqual([message])

        expect(em.query).toHaveBeenCalledWith(LIST_SESSION_MESSAGES, ["ses-1"])
    })

    it("finds one message of the workspace", async () => {
        const em = mockEntityManager({ query: [FIND_MESSAGE, [message]] })

        await expect((await build(em)).find("ws-1", "msg-1")).resolves.toEqual(message)

        expect(em.query).toHaveBeenCalledWith(FIND_MESSAGE, ["msg-1", "ws-1"])
    })

    it("answers nothing when the message is not in the workspace", async () => {
        const em = mockEntityManager({ query: [FIND_MESSAGE, []] })

        await expect((await build(em)).find("ws-1", "missing")).resolves.toBeNull()
    })

    it("stores one line of the chat", async () => {
        const stored: SetupMessageRecord = { ...posted, id: "msg-2", createdAt: "2026-10-12T10:01:00.000Z" }
        const em = mockEntityManager({ query: [INSERT_SETUP_MESSAGE, [stored]] })

        await expect((await build(em)).post(posted)).resolves.toEqual(stored)

        expect(em.query).toHaveBeenCalledWith(INSERT_SETUP_MESSAGE, ["ws-1", "ses-1", "assistant", "NIVO", "Noted"])
    })
})
