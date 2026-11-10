import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { ChatRoomMessageEntity, ChatRoomMessageReactionEntity } from "./persistence/entities"
import { TeamChatReactionStoreService } from "./team-chat-reaction-store.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const ROOM = "41111111-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const THUMB = "\u{1F44D}"
const ana = { memberKind: "user", memberId: ANA } as const
const message = Object.assign(new ChatRoomMessageEntity(), { id: MSG, roomId: ROOM, workspaceId: WS })

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [TeamChatReactionStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(TeamChatReactionStoreService)
}

describe("TeamChatReactionStoreService heldOf", () => {
    it("reads what the member tapped and how long ago by the database clock, or null when they never tapped it", async () => {
        const em = mockEntityManager()
        const [held, none] = queueQueryBuilders(em, [
            { getRawOne: { count: 4, idle_ms: "250.5" } },
            { getRawOne: undefined },
        ])
        const store = await build(em)
        await expect(store.heldOf(MSG, ana, THUMB)).resolves.toEqual({ count: 4, idleMs: 250.5 })
        await expect(store.heldOf(MSG, ana, THUMB)).resolves.toBeNull()
        expect(held?.callsOf("addSelect")[0]?.[0]).toContain("now() - r.updated_at")
        expect(held?.callsOf("where")[0]?.[1]).toEqual({ messageId: MSG, kind: "user", memberId: ANA, emoji: THUMB })
        expect(none?.callsOf("where")).toHaveLength(1)
    })
})

describe("TeamChatReactionStoreService addTaps", () => {
    it("makes the row on the first tap and grows nothing", async () => {
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [{ message_id: MSG }] } }])
        const store = await build(em)
        await store.addTaps(message, ana, THUMB, 3)
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    messageId: MSG,
                    roomId: ROOM,
                    workspaceId: WS,
                    memberKind: "user",
                    memberId: ANA,
                    emoji: THUMB,
                    count: 3,
                },
            ],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
    })

    it("grows the row of an earlier tap by the taps, up to the bound, when the insert found it", async () => {
        const em = mockEntityManager()
        const [insert, update] = queueQueryBuilders(em, [{ execute: { raw: [] } }, { execute: {} }])
        const store = await build(em)
        await store.addTaps(message, ana, THUMB, 5)
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(update?.callsOf("update")).toEqual([[ChatRoomMessageReactionEntity]])
        const [values] = update?.callsOf("set")[0] ?? []
        const grown: unknown = isRecord(values) ? values["count"] : undefined
        expect(typeof grown === "function" ? Reflect.apply(grown, undefined, []) : undefined).toBe(
            "LEAST(count + :taps, 999)",
        )
        expect(update?.callsOf("setParameter")).toEqual([["taps", 5]])
        expect(update?.callsOf("where")[0]?.[1]).toEqual({ messageId: MSG, kind: "user", memberId: ANA, emoji: THUMB })
    })
})

describe("TeamChatReactionStoreService rowsAmong", () => {
    it("reads the rows of the messages as plain rows, bounded", async () => {
        const row = Object.assign(new ChatRoomMessageReactionEntity(), {
            messageId: MSG,
            memberKind: "user",
            memberId: ANA,
            emoji: THUMB,
            roomId: ROOM,
            workspaceId: WS,
            count: 2,
        })
        const em = mockEntityManager({ find: [ChatRoomMessageReactionEntity, [row]] })
        const store = await build(em)
        await expect(store.rowsAmong([MSG])).resolves.toEqual([
            { messageId: MSG, memberKind: "user", memberId: ANA, emoji: THUMB, count: 2 },
        ])
        expect(em.find).toHaveBeenCalledWith(ChatRoomMessageReactionEntity, {
            where: { messageId: In([MSG]) },
            take: 1 * 200 * 6,
        })
    })

    it("reads nothing for no message", async () => {
        const em = mockEntityManager({})
        const store = await build(em)
        await expect(store.rowsAmong([])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
})
