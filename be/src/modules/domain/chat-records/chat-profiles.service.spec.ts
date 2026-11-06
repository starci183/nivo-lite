import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CHAT_WORKSPACE, addConversation, fakeChat } from "../../../tests/fixtures/builders/chat-records.builder"
import type { FakeChat } from "../../../tests/fixtures/builders/chat-records.builder"
import { ChatEntitiesService } from "./chat-entities.service"
import { ChatProfilesService } from "./chat-profiles.service"
import { ChatRecordsErrorCode } from "./errors/chat-records.error"

const CONNECTION = "22222222-2222-4222-8222-222222222222"
const OTHER_CONNECTION = "66666666-6666-4666-8666-666666666666"
const AT = new Date("2026-11-07T10:00:00.000Z")
const DUE = {
    connectionId: CONNECTION,
    refreshedBefore: new Date("2026-10-31T10:00:00.000Z"),
    triedBefore: new Date("2026-11-07T09:00:00.000Z"),
    limit: 10,
}

const build = async (chat: FakeChat) => {
    const entities = mock<ChatEntitiesService>()
    entities.run.mockImplementation((_workspace, work) => work(chat.api))
    const moduleRef = await Test.createTestingModule({
        providers: [ChatProfilesService, { provide: ChatEntitiesService, useValue: entities }],
    }).compile()
    return { service: moduleRef.get(ChatProfilesService), entities }
}

const zalo = (externalId: string, extra: Record<string, string | null> = {}) => ({
    channel: "zalo",
    externalId,
    name: "Zalo guest",
    ...extra,
})

describe("ChatProfilesService: who owes a profile", () => {
    it("answers the zalo customers of the connection never read or read long ago, newest first, and not the ones tried lately", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const fresh = await addConversation(chat, zalo("u-new", { lastAt: "2026-11-07T09:50:00.000Z" }))
        const stale = await addConversation(
            chat,
            zalo("u-stale", { lastAt: "2026-11-07T09:40:00.000Z", profileAt: "2026-10-01T00:00:00.000Z" }),
        )
        await addConversation(chat, zalo("u-read", { profileAt: "2026-11-05T00:00:00.000Z" }))
        await addConversation(chat, zalo("u-tried", { profileTriedAt: "2026-11-07T09:30:00.000Z" }))
        await addConversation(chat, zalo("u-other", { connectionId: OTHER_CONNECTION }))
        await addConversation(chat, { channel: "telegram", externalId: "t-1" })

        const due = await service.due(CHAT_WORKSPACE, DUE)

        expect(due).toEqual([
            { id: fresh.id, externalId: "u-new" },
            { id: stale.id, externalId: "u-stale" },
        ])
    })

    it("answers at most the limit it was given", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        await addConversation(chat, zalo("u-1", { lastAt: "2026-11-07T09:50:00.000Z" }))
        await addConversation(chat, zalo("u-2", { lastAt: "2026-11-07T09:40:00.000Z" }))

        await expect(service.due(CHAT_WORKSPACE, { ...DUE, limit: 1 })).resolves.toHaveLength(1)
    })
})

describe("ChatProfilesService: keeping a profile", () => {
    it("keeps the name, the picture and the moment of a read on the conversation", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat, zalo("u-1"))

        await service.record(CHAT_WORKSPACE, row.id, { name: "Minh", avatarUrl: "https://zalo.test/a.png" }, AT)

        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data).toMatchObject({
            name: "Minh",
            avatarUrl: "https://zalo.test/a.png",
            profileAt: "2026-11-07T10:00:00.000Z",
            profileTriedAt: "2026-11-07T10:00:00.000Z",
        })
    })

    it("keeps the name it has when the channel gave none", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat, zalo("u-1"))

        await service.record(CHAT_WORKSPACE, row.id, { name: "", avatarUrl: "" }, AT)

        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data).toMatchObject({
            name: "Zalo guest",
            avatarUrl: null,
            profileAt: "2026-11-07T10:00:00.000Z",
        })
    })

    it("keeps only the moment of a failed try, so the name stays and the profile stays owed", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat, zalo("u-1"))

        await service.tried(CHAT_WORKSPACE, row.id, AT)

        const data = chat.rows.get("chat.conversation")?.get(row.id)?.data
        expect(data).toMatchObject({ name: "Zalo guest", profileTriedAt: "2026-11-07T10:00:00.000Z" })
        expect(data?.["profileAt"]).toBeUndefined()
    })

    it("writes again from what another writer wrote when it moved the conversation first", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat, zalo("u-1"))
        chat.staleFor("chat.conversation", 2)

        await service.tried(CHAT_WORKSPACE, row.id, AT)

        expect(chat.rows.get("chat.conversation")?.get(row.id)?.data["profileTriedAt"]).toBe("2026-11-07T10:00:00.000Z")
    })

    it("refuses a conversation that is gone, and a write another writer keeps outrunning", async () => {
        const chat = fakeChat()
        const { service } = await build(chat)
        const row = await addConversation(chat, zalo("u-1"))

        await expect(service.tried(CHAT_WORKSPACE, "00000000-0000-4000-8000-0000000000ff", AT)).rejects.toMatchObject({
            code: ChatRecordsErrorCode.NotFound,
        })
        chat.staleFor("chat.conversation", 9)
        await expect(service.tried(CHAT_WORKSPACE, row.id, AT)).rejects.toMatchObject({
            code: ChatRecordsErrorCode.NotStored,
        })
    })
})
