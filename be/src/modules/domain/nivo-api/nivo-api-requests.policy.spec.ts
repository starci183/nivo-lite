import { Test } from "@nestjs/testing"
import { requestBuilderOf } from "./nivo-api-requests.policy"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import { NIVO_API_TABLE } from "./nivo-api.declarations"

const SUBJECT = Symbol("nivo-api-requests.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { requestBuilderOf } }],
    }).compile()
    return moduleRef.get<typeof import("./nivo-api-requests.policy")>(SUBJECT)
}


const ID = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const WS = { workspaceId: "ws-1" }
const CALL = { workspaceId: "ws-1", opKey: "op-1" }
const FILE = { via: "blocks-core.sales.api.order.list", type: "blocks-core.sales.order", recordId: ID, field: "invoice" }
const FILE_CALL = { workspaceId: "ws-1", ...FILE }
const THEME = { hue: 17.59, chroma: 0.222, lightness: 0.5858, base: 0.5, font: "inter", radius: "medium" }

/** Per op: valid arguments, and the request its message is built with (the one its GraphQL resolver builds). */
const CASES: ReadonlyArray<readonly [string, Readonly<Record<string, unknown>>, unknown]> = [
    [NIVO_API.contact.list, { search: "Lan", size: 5 }, { ...WS, search: "Lan", size: 5 }],
    [NIVO_API.contact.get, { id: ID }, { ...WS, id: ID }],
    [NIVO_API.contact.blockList, { contactId: ID }, { ...WS, contactId: ID, locale: "vi" }],
    [NIVO_API.customerMessage.list, { routeId: ID, since: "2026-11-14T01:00:00.000Z", limit: 20 }, { ...WS, routeId: ID, since: "2026-11-14T01:00:00.000Z", limit: 20 }],
    [NIVO_API.contact.update, { id: ID, displayName: "Lan" }, { ...WS, id: ID, displayName: "Lan" }],
    [NIVO_API.contact.identityLink, { contactId: ID, kind: "phone", value: "0901" }, { ...WS, contactId: ID, kind: "phone", value: "0901" }],
    [NIVO_API.contact.identityUnlink, { contactId: ID, identityId: OTHER }, { ...WS, contactId: ID, identityId: OTHER }],
    [NIVO_API.contact.merge, { intoContactId: ID, fromContactId: OTHER }, { ...WS, intoContactId: ID, fromContactId: OTHER }],
    [NIVO_API.contact.memoryForget, { contactId: ID, facts: ["phone"] }, { ...WS, contactId: ID, facts: ["phone"] }],
    [NIVO_API.contact.delete, { id: ID }, { ...WS, id: ID }],
    [NIVO_API.file.upload, { ...FILE, name: "a.pdf", mime: "application/pdf", size: 10 }, { call: FILE_CALL, facts: { name: "a.pdf", mime: "application/pdf", size: 10 } }],
    [NIVO_API.file.confirm, { ...FILE, key: "k", name: "a.pdf" }, { call: FILE_CALL, key: "k", name: "a.pdf" }],
    [NIVO_API.file.link, { ...FILE, key: "k", name: "a.pdf" }, { call: FILE_CALL, key: "k", name: "a.pdf" }],
    [NIVO_API.file.get, FILE, { call: FILE_CALL }],
    [NIVO_API.file.get, { ...FILE, key: "k" }, { call: { ...FILE_CALL, key: "k" } }],
    [NIVO_API.file.delete, FILE, { call: FILE_CALL }],
    [NIVO_API.file.delete, { ...FILE, key: "k" }, { call: { ...FILE_CALL, key: "k" } }],
    [NIVO_API.chatThread.list, {}, { ...WS, kind: null, member: null }],
    [NIVO_API.chatThread.list, { kind: "group", member: ID }, { ...WS, kind: "group", member: ID }],
    [NIVO_API.chatThread.get, { threadId: ID }, { ...WS, roomId: ID, first: null, after: null, pinnedOnly: false }],
    [NIVO_API.chatThread.get, { threadId: ID, first: 10, after: "c-1", pinnedOnly: true }, { ...WS, roomId: ID, first: 10, after: "c-1", pinnedOnly: true }],
    [NIVO_API.brain.search, { limit: 5 }, { ...WS, limit: 5 }],
    [NIVO_API.workbench.read, { name: "n" }, { ...WS, name: "n", payload: "{}", locale: "vi" }],
    [NIVO_API.workbench.read, { name: "n", vars: { q: "A12" }, locale: "en" }, { ...WS, name: "n", payload: '{"q":"A12"}', locale: "en" }],
    [NIVO_API.workbench.action, { name: "n" }, { ...WS, name: "n", payload: "{}", locale: "vi" }],
    [NIVO_API.workbench.action, { name: "n", input: { code: "A12" }, locale: "en" }, { ...WS, name: "n", payload: '{"code":"A12"}', locale: "en" }],
    [NIVO_API.record.typeList, {}, WS],
    [NIVO_API.accountData.typeList, { connectionId: ID }, { ...WS, connectionId: ID }],
    [NIVO_API.accountData.rowList, { connectionId: ID, type: "sepay.transaction" }, { ...WS, connectionId: ID, type: "sepay.transaction", limit: null }],
    [NIVO_API.accountData.rowList, { connectionId: ID, type: "sepay.transaction", limit: 5 }, { ...WS, connectionId: ID, type: "sepay.transaction", limit: 5 }],
    [NIVO_API.agent.list, {}, WS],
    [NIVO_API.agent.deletionImpact, { installationId: ID }, { ...WS, installationId: ID }],
    [NIVO_API.workflow.list, { installationId: ID }, { ...WS, installationId: ID, locale: null }],
    [NIVO_API.workflow.get, { installationId: ID, workflowId: OTHER }, { ...WS, installationId: ID, workflowId: OTHER, locale: null }],
    [NIVO_API.workflow.get, { installationId: ID, workflowId: OTHER, locale: "en" }, { ...WS, installationId: ID, workflowId: OTHER, locale: "en" }],
    [NIVO_API.workflow.run, { installationId: ID, workflowId: OTHER, inputs: { a: 1 } }, { ...WS, installationId: ID, workflowId: OTHER, inputs: { a: 1 }, opKey: "op-1" }],
    [NIVO_API.run.list, { installationId: ID }, { ...WS, installationId: ID }],
    [NIVO_API.run.get, { installationId: ID, runId: OTHER }, { ...WS, installationId: ID, runId: OTHER, locale: "vi" }],
    [NIVO_API.run.get, { installationId: ID, runId: OTHER, locale: "en" }, { ...WS, installationId: ID, runId: OTHER, locale: "en" }],
    [NIVO_API.theme.get, {}, WS],
    [NIVO_API.theme.update, THEME, { ...WS, ...THEME }],
    [NIVO_API.theme.reset, {}, WS],
    [NIVO_API.stop.list, {}, { ...WS, limit: null, cursor: null }],
    [NIVO_API.stop.list, { limit: 5, cursor: "2" }, { ...WS, limit: 5, cursor: "2" }],
    [NIVO_API.stop.answer, { runId: ID, action: "retry" }, { ...WS, runId: ID, stepKey: null, action: "retry", text: null }],
    [NIVO_API.stop.answer, { runId: ID, stepKey: "match", action: "answer", text: "DH-1" }, { ...WS, runId: ID, stepKey: "match", action: "answer", text: "DH-1" }],
    [NIVO_API.run.stepDecide, { installationId: ID, runId: OTHER, verdict: "approve" }, { ...WS, installationId: ID, runId: OTHER, verdict: "approve", stepKey: null, locale: "vi" }],
    [NIVO_API.run.stepDecide, { installationId: ID, runId: OTHER, verdict: "reject", stepKey: "s", locale: "en" }, { ...WS, installationId: ID, runId: OTHER, verdict: "reject", stepKey: "s", locale: "en" }],
]

const EXPOSED = Object.entries(NIVO_API_TABLE)
    .filter(([, declaration]) => declaration.exposed)
    .map(([name]) => name)

describe("the requests of the NIVO data ops", () => {
    let subject: Awaited<ReturnType<typeof build>>

    beforeEach(async () => {
        subject = await build()
    })

    describe("NIVO_API_REQUESTS: the request each exposed op sends to its message", () => {
        it("has a builder for every exposed op, and for no other", () => {
            expect(EXPOSED.filter((name) => subject.requestBuilderOf(name) === undefined)).toEqual([])
            expect(subject.requestBuilderOf(NIVO_API.workspace.delete)).toBeUndefined()
            expect(new Set(CASES.map(([name]) => name))).toEqual(new Set(EXPOSED))
        })

        it.each(CASES)("builds the request of %s from its arguments, with the defaults its resolver carries (%#)", (name, args, request) => {
            const builder = subject.requestBuilderOf(name)

            expect(builder?.(args, CALL)).toEqual(request)
        })

        it.each([
            [NIVO_API.contact.list, { size: 5000 }],
            [NIVO_API.contact.get, {}],
            [NIVO_API.chatThread.get, { threadId: "not-a-uuid" }],
            [NIVO_API.workflow.run, { installationId: ID, workflowId: OTHER }],
        ])("refuses arguments %s does not take, with the declared input validator", (name, args) => {
            const builder = subject.requestBuilderOf(name)

            expect(() => builder?.(args, CALL)).toThrow()
        })

        it("keys a workflow start by an empty opKey when the call has none (the executor refuses a write without one before this)", () => {
            const builder = subject.requestBuilderOf(NIVO_API.workflow.run)

            expect(builder?.({ installationId: ID, workflowId: OTHER, inputs: {} }, { workspaceId: "ws-1", opKey: null })).toMatchObject({
                opKey: "",
            })
        })
    })
})
