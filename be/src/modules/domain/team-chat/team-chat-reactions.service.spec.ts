import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { messageOf, seatOf } from "@tests/fixtures/builders/team-chat.builder"
import { TeamChatErrorCode } from "./errors/team-chat.error"
import type { MessageView, TeamChatResult } from "./team-chat.contracts"
import { MIN_GAP_MS, TIMES_MAX } from "./team-chat-reaction.policy"
import { TeamChatReactionStoreService } from "./team-chat-reaction-store.service"
import { TeamChatReactionsService } from "./team-chat-reactions.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatViewsService } from "./team-chat-views.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ANA = "22222222-1111-4111-8111-111111111111"
const MSG = "51111111-1111-4111-8111-111111111111"
const HEART = "\u{2764}\u{FE0F}"
const THUMB = "\u{1F44D}"

const refusalOf = <V>(result: TeamChatResult<V>): string => (result.ok ? "done" : result.refusal)

const build = async () => {
    const store = mock<TeamChatStoreService>()
    const reactions = mock<TeamChatReactionStoreService>()
    const views = mock<TeamChatViewsService>()
    const message = messageOf({ id: MSG })
    store.messagesByIds.mockResolvedValue([message])
    store.memberOf.mockResolvedValue(seatOf("user", ANA))
    reactions.heldOf.mockResolvedValue(null)
    reactions.addTaps.mockResolvedValue()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatReactionsService,
            { provide: TeamChatStoreService, useValue: store },
            { provide: TeamChatReactionStoreService, useValue: reactions },
            { provide: TeamChatViewsService, useValue: views },
        ],
    }).compile()
    return { subject: moduleRef.get(TeamChatReactionsService), store, reactions, views, message }
}

describe("TeamChatReactionsService react", () => {
    it("counts the taps of a member and answers the message as the member sees it", async () => {
        const { subject, reactions, views, message } = await build()
        const view = mock<MessageView>()
        views.viewOf.mockResolvedValue(view)
        const result = await subject.react(WS, ANA, MSG, THUMB, 5)
        assert(result.ok, "expected a value")
        expect(result.value).toBe(view)
        expect(reactions.heldOf).toHaveBeenCalledWith(MSG, { memberKind: "user", memberId: ANA }, THUMB)
        expect(reactions.addTaps).toHaveBeenCalledWith(message, { memberKind: "user", memberId: ANA }, THUMB, 5)
        expect(views.viewOf).toHaveBeenCalledWith(WS, message, ANA)
    })

    it("counts one tap when no count is given, and a heart without its selector as the heart", async () => {
        const { subject, reactions, views } = await build()
        views.viewOf.mockResolvedValue(mock<MessageView>())
        await subject.react(WS, ANA, MSG, "\u{2764}", null)
        expect(reactions.addTaps).toHaveBeenCalledWith(expect.anything(), expect.anything(), HEART, 1)
    })

    it("clamps a batch to the bound of a call and counts what fits since the last tap", async () => {
        const { subject, reactions, views } = await build()
        views.viewOf.mockResolvedValue(mock<MessageView>())
        await subject.react(WS, ANA, MSG, THUMB, 500)
        expect(reactions.addTaps).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), THUMB, TIMES_MAX)
        reactions.heldOf.mockResolvedValue({ count: 30, idleMs: 600 })
        await subject.react(WS, ANA, MSG, THUMB, 30)
        expect(reactions.addTaps).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), THUMB, 8)
    })

    it("refuses a call that follows the last tap too fast, and adds nothing", async () => {
        const { subject, reactions } = await build()
        reactions.heldOf.mockResolvedValue({ count: 2, idleMs: MIN_GAP_MS - 1 })
        expect(refusalOf(await subject.react(WS, ANA, MSG, THUMB, 1))).toBe(TeamChatErrorCode.ReactionRateLimited)
        expect(reactions.addTaps).not.toHaveBeenCalled()
    })

    it("refuses a member who already tapped the emoji as often as the chat counts", async () => {
        const { subject, reactions } = await build()
        reactions.heldOf.mockResolvedValue({ count: 999, idleMs: 60_000 })
        expect(refusalOf(await subject.react(WS, ANA, MSG, THUMB, 1))).toBe(TeamChatErrorCode.ReactionRateLimited)
        expect(reactions.addTaps).not.toHaveBeenCalled()
    })

    it("refuses an emoji that is not one of the six before it reads anything", async () => {
        const { subject, store } = await build()
        expect(refusalOf(await subject.react(WS, ANA, MSG, "\u{1F4A9}", 1))).toBe(TeamChatErrorCode.ReactionInvalid)
        expect(store.messagesByIds).not.toHaveBeenCalled()
    })

    it("refuses a message the workspace does not have", async () => {
        const { subject, store, reactions } = await build()
        store.messagesByIds.mockResolvedValue([])
        expect(refusalOf(await subject.react(WS, ANA, MSG, THUMB, 1))).toBe(TeamChatErrorCode.NotFound)
        expect(reactions.addTaps).not.toHaveBeenCalled()
    })

    it("is for members only: a viewer who does not sit in the room of the message cannot react", async () => {
        const { subject, store, reactions } = await build()
        store.memberOf.mockResolvedValue(null)
        expect(refusalOf(await subject.react(WS, ANA, MSG, THUMB, 1))).toBe(TeamChatErrorCode.NotMember)
        expect(reactions.addTaps).not.toHaveBeenCalled()
    })

    it("lets a member react to the message of an agent", async () => {
        const { subject, store, views } = await build()
        store.messagesByIds.mockResolvedValue([messageOf({ id: MSG, authorKind: "agent", authorId: "bot" })])
        views.viewOf.mockResolvedValue(mock<MessageView>())
        expect((await subject.react(WS, ANA, MSG, THUMB, 1)).ok).toBe(true)
    })
})
