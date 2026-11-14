import type { SandboxCall, SandboxCase } from "@modules/domain/provider-sandbox"
import {
    toOpenSandboxAccountRequest,
    toSandboxAccountType,
    toSandboxAgentRequest,
    toSandboxCallType,
    toSandboxCaseType,
    toSandboxLatestRequestType,
    toSandboxSendResultType,
} from "./provider-sandbox.mapper"

describe("provider-sandbox mapper", () => {
    it("maps an answered call with its request and answer as JSON text, oldest-first order untouched", () => {
        const call: SandboxCall = {
            id: "call-1",
            operation: "transfer",
            key: "DH1",
            request: { amount: 5 },
            result: { outcome: "answered", value: { ok: true } },
            at: "2026-11-14T00:00:00.000Z",
        }

        expect(toSandboxCallType(call)).toEqual({
            id: "call-1",
            operation: "transfer",
            key: "DH1",
            at: "2026-11-14T00:00:00.000Z",
            outcome: "answered",
            error: null,
            requestJson: '{"amount":5}',
            answerJson: '{"ok":true}',
        })
    })

    it("maps a call that threw with its error and no answer, and an undefined request as null", () => {
        const call: SandboxCall = {
            id: "call-2",
            operation: "renew",
            key: "",
            request: undefined,
            result: { outcome: "threw", error: "PROVIDER_REFUSED" },
            at: "2026-11-14T00:00:01.000Z",
        }

        expect(toSandboxCallType(call)).toMatchObject({ outcome: "threw", error: "PROVIDER_REFUSED", requestJson: "null", answerJson: null })
    })

    it("maps the latest request's inputs to text (numbers as decimal text) and no request to null", () => {
        expect(toSandboxLatestRequestType(null)).toBeNull()
        expect(
            toSandboxLatestRequestType({ operation: "transfer", at: "2026-11-14T00:00:00.000Z", input: { content: "DH1", amount: 250000 } }),
        ).toEqual({
            operation: "transfer",
            at: "2026-11-14T00:00:00.000Z",
            inputs: [
                { name: "content", value: "DH1" },
                { name: "amount", value: "250000" },
            ],
        })
    })

    it("maps an inbound case with its fields (example as text) and an outbound case with its operation and default flag", () => {
        const inbound: SandboxCase = {
            id: "SEPAY-1",
            label: "money in",
            inbound: {
                trigger: "money.received",
                path: () => "api/x",
                inputs: [{ name: "amount", label: "Amount", kind: "integer", example: 1000 }],
                eventsOf: () => Promise.resolve([]),
            },
        }
        const outbound: SandboxCase = { id: "SEPAY-2", label: "ok", operation: "transfer", default: true }

        expect(toSandboxCaseType(inbound)).toEqual({
            id: "SEPAY-1",
            label: "money in",
            direction: "inbound",
            operation: null,
            isDefault: false,
            trigger: "money.received",
            inputs: [{ name: "amount", label: "Amount", kind: "integer", example: "1000" }],
        })
        expect(toSandboxCaseType(outbound)).toEqual({
            id: "SEPAY-2",
            label: "ok",
            direction: "outbound",
            operation: "transfer",
            isDefault: true,
            trigger: null,
            inputs: [],
        })
    })

    it("maps a send result: inputs as text, each delivery's body as JSON text or null", () => {
        expect(
            toSandboxSendResultType({
                caseId: "SEPAY-1",
                input: { amount: 7 },
                deliveries: [
                    { path: "api/x", status: 200, body: { ok: true } },
                    { path: "api/x", status: 204, body: undefined },
                ],
            }),
        ).toEqual({
            caseId: "SEPAY-1",
            inputs: [{ name: "amount", value: "7" }],
            deliveries: [
                { path: "api/x", status: 200, bodyJson: '{"ok":true}' },
                { path: "api/x", status: 204, bodyJson: null },
            ],
        })
    })

    it("maps an account without secrets, and passes the provider key on (the domain refuses a provider with no sandbox)", () => {
        const account = { id: "c-1", provider: "sepay", name: "Bank", status: "connected", createdAt: "2026-11-14T00:00:00.000Z" } as never
        expect(toSandboxAccountType({ account, agents: [{ id: "a-1", label: "Lan" }] })).toEqual({
            id: "c-1",
            provider: "sepay",
            name: "Bank",
            status: "connected",
            createdAt: "2026-11-14T00:00:00.000Z",
            agents: [{ id: "a-1", label: "Lan" }],
        })
        expect(toSandboxAccountType({ account, agents: [] }).agents).toEqual([])
        expect(toOpenSandboxAccountRequest("ws-1", { provider: "sepay", name: "Bank" })).toEqual({
            workspaceId: "ws-1",
            provider: "sepay",
            name: "Bank",
            attachTo: [],
        })
        expect(toOpenSandboxAccountRequest("ws-1", { provider: "sepay", name: "Bank", attachTo: ["a-1", "a-2"] }).attachTo).toEqual(["a-1", "a-2"])
        expect(toSandboxAgentRequest("ws-1", { connectionId: "c-1", agentId: "a-1" })).toEqual({
            workspaceId: "ws-1",
            connectionId: "c-1",
            agentId: "a-1",
        })
    })
})
