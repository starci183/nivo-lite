import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    TURN,
    PERSON,
    TELEGRAM_ACCOUNT,
    WHERE,
    build,
    contact,
    identity,
    SEND,
    CALL,
    HOLDING,
} from "@tests/fixtures/builders/channel-send-executor.builder"

/** The send as the accounts judge takes it, on the account of the given provider. */
const sendOn = (provider: string, connectionId: string, routeId: string, step?: { nodeKey: string; versionId: string; workflowId: string }) => ({
    workspaceId: "ws-1",
    agentId: TURN.agentId,
    effect: TOOL.customerMessageSend,
    target: { provider, connectionId },
    step,
    runId: TURN.turnId,
    conversationId: routeId,
})

describe("ChannelSendExecutorService send on the person's channel", () => {
    it("asks the accounts judge on the account the person is reached through: not attached refuses, attached sends", async () => {
        const { executor, access, delivery, ledger } = await build()

        access.judgeSend.mockResolvedValue({ kind: "refuse", reason: "not_attached", providers: ["telegram"] })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "channel_no_access",
            facts: { ...WHERE, provider: "telegram", ability: TOOL.customerMessageSend, reason: "not_attached" },
        })
        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
        expect(ledger.rows[0]).toMatchObject({ state: "refused", reason: "channel_no_access" })

        access.judgeSend.mockResolvedValue({ kind: "allow", provider: "telegram", connectionId: TELEGRAM_ACCOUNT })
        await expect(executor.execute(TURN, SEND, { key: "run:3", dedupeKey: null })).resolves.toMatchObject({ kind: "message" })
        expect(access.judgeSend).toHaveBeenLastCalledWith(sendOn("telegram", TELEGRAM_ACCOUNT, "route-1"))
    })

    it("judges the provider of the channel the person is reached on, and no provider right at all on the website chat", async () => {
        const { executor, access, contacts, routes } = await build()

        contacts.get.mockResolvedValue(contact([identity({ provider: "zalo", account: "z1", value: "123" })]))
        const zalo = (await routes.ensure("ws-1", { contactId: PERSON, channel: "zalo", accountId: "z1" })).routeId
        await executor.execute({ ...TURN, conversationId: zalo }, SEND, CALL)
        expect(access.judgeSend).toHaveBeenLastCalledWith(sendOn("zalo_oa", "z1", zalo))

        access.judgeSend.mockClear()
        contacts.get.mockResolvedValue(contact([identity({ provider: "website", account: "site-1", value: "visitor-1" })]))
        await expect(executor.execute({ ...TURN, conversationId: null }, SEND, { key: "run:2", dedupeKey: null })).resolves.toMatchObject({
            kind: "message",
        })
        expect(access.judgeSend).not.toHaveBeenCalled()
    })

    it("names the workflow step the host put on the turn to the accounts judge (the audit line says which node sent)", async () => {
        const { executor, access } = await build()
        const step = { nodeKey: "answer", versionId: "v-6", workflowId: "wf-front-desk" }

        await executor.execute({ ...TURN, step }, SEND, CALL)

        expect(access.judgeSend).toHaveBeenLastCalledWith(sendOn("telegram", TELEGRAM_ACCOUNT, "route-1", step))
    })

    it("keeps the node of the step in the ledger row", async () => {
        const { executor, ledger } = await build()

        await executor.execute({ ...TURN, step: { nodeKey: "answer", versionId: "v-6", workflowId: "wf" } }, SEND, CALL)

        expect(ledger.rows[0]?.stepKey).toBe("answer")
    })
})

describe("ChannelSendExecutorService send on the person's channel: the engine's holding line", () => {
    it("is asked as the engine's own line (its call key says so), with the step, the run and the route, and recorded in the ledger like any send", async () => {
        const { executor, access, ledger } = await build()
        const step = { nodeKey: "consult", versionId: "wv-7", workflowId: "wf-consult" }

        await expect(executor.execute({ ...TURN, step }, SEND, HOLDING)).resolves.toMatchObject({
            kind: "message",
            id: HOLDING.key,
        })

        expect(access.judgeSend).not.toHaveBeenCalled()
        expect(access.judgeEngineLine).toHaveBeenCalledWith(sendOn("telegram", TELEGRAM_ACCOUNT, "route-1", step))
        expect(ledger.rows[0]).toMatchObject({ sendKey: HOLDING.key, state: "delivered", text: "Hello" })
    })

    it("a detached agent's holding line is refused (the kill switch), with no node rule named, and no message goes out", async () => {
        const { executor, access, delivery } = await build()
        access.judgeEngineLine.mockResolvedValue({ kind: "refuse", reason: "not_attached", providers: ["telegram"] })

        const refused = await executor.execute(TURN, SEND, HOLDING)

        expect(refused).toMatchObject({ kind: "refused", id: "channel_no_access", facts: { reason: "not_attached" } })
        expect(refused.facts).not.toHaveProperty("rule")
        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
    })
})
