import { Test } from "@nestjs/testing"
import type { ChannelChoice } from "./agent-instances.contracts"
import {
    channelChoicesOf as channelChoicesOfImplementation,
    channelProblemOf as channelProblemOfImplementation,
    copiedGrantsOf as copiedGrantsOfImplementation,
    judgeRequest as judgeRequestImplementation,
} from "./agent-instances.policy"
import { AgentInstancesErrorCode } from "./errors/agent-instances.error"

const SUBJECT = Symbol("agent-instances.policy")
type Subject = {
    channelChoicesOf: typeof channelChoicesOfImplementation
    channelProblemOf: typeof channelProblemOfImplementation
    copiedGrantsOf: typeof copiedGrantsOfImplementation
    judgeRequest: typeof judgeRequestImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    channelChoicesOf: channelChoicesOfImplementation,
                    channelProblemOf: channelProblemOfImplementation,
                    copiedGrantsOf: copiedGrantsOfImplementation,
                    judgeRequest: judgeRequestImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const choiceOf = (overrides: Partial<ChannelChoice> = {}): ChannelChoice => ({
    connectionId: "tg1",
    name: "Shop bot",
    provider: "telegram",
    botUsername: "shop_bot",
    status: "connected",
    purpose: "outbound_chat",
    ownerAgentId: null,
    ownerAgentName: null,
    ...overrides,
})

describe("agent instances policy > judgeRequest", () => {
    it("cleans the name and the typed handle and keeps the picture", async () => {
        const subject = await buildSubject()

        expect(
            subject.judgeRequest({
                name: "  Sales   Lan ",
                handle: "@Sales-Lan",
                avatarPreset: "role",
                avatarPath: null,
            }),
        ).toEqual({
            kind: "ok",
            value: { name: "Sales Lan", handle: "sales-lan", avatar: { kind: "preset", preset: "role" } },
        })
    })

    it("leaves a blank handle to be made from the name", async () => {
        const subject = await buildSubject()

        expect(subject.judgeRequest({ name: "Lan", handle: "  ", avatarPreset: null, avatarPath: null })).toEqual({
            kind: "ok",
            value: { name: "Lan", handle: null, avatar: null },
        })
    })

    it("refuses a name outside its limits", async () => {
        const subject = await buildSubject()

        expect(subject.judgeRequest({ name: " x ", handle: null, avatarPreset: null, avatarPath: null })).toMatchObject(
            {
                kind: "refused",
                code: AgentInstancesErrorCode.NameInvalid,
                params: { min: 2, max: 40 },
            },
        )
    })

    it("refuses a typed handle that cleans into no handle", async () => {
        const subject = await buildSubject()

        expect(subject.judgeRequest({ name: "Lan", handle: "9!", avatarPreset: null, avatarPath: null })).toMatchObject(
            {
                kind: "refused",
                code: AgentInstancesErrorCode.HandleInvalid,
            },
        )
    })

    it("refuses a preset that is not offered, and lets an upload through", async () => {
        const subject = await buildSubject()

        expect(
            subject.judgeRequest({ name: "Lan", handle: null, avatarPreset: "dragon", avatarPath: null }),
        ).toMatchObject({
            kind: "refused",
            code: AgentInstancesErrorCode.AvatarPresetInvalid,
            params: { preset: "dragon" },
        })
        expect(
            subject.judgeRequest({ name: "Lan", handle: null, avatarPreset: "role", avatarPath: "agents/x.png" }).kind,
        ).toBe("ok")
    })
})

describe("agent instances policy > channelChoicesOf", () => {
    it("lists the connections the role speaks on, not disconnected, each with its owner", async () => {
        const subject = await buildSubject()

        const choices = subject.channelChoicesOf(
            [
                { id: "tg1", name: "Shop bot", provider: "telegram", status: "connected", botUsername: "shop_bot" },
                { id: "zl1", name: "Zalo OA", provider: "zalo_oa", status: "disconnected", botUsername: null },
                { id: "sp1", name: "SePay", provider: "sepay", status: "connected", botUsername: null },
                { id: "db1", name: "Sheet", provider: "database", status: "connected", botUsername: null },
            ],
            (provider) => {
                if (provider === "telegram" || provider === "zalo_oa") return "outbound_chat"
                if (provider === "database") return "data_source"
                return null
            },
            (connectionId) =>
                connectionId === "tg1"
                    ? { ownerAgentId: "s1", ownerAgentName: "Lan" }
                    : { ownerAgentId: null, ownerAgentName: null },
        )

        expect(choices).toEqual([choiceOf({ ownerAgentId: "s1", ownerAgentName: "Lan" })])
    })
})

describe("agent instances policy > channelProblemOf", () => {
    it("finds no problem when every chosen channel is free", async () => {
        const subject = await buildSubject()

        expect(subject.channelProblemOf([choiceOf()], ["tg1"])).toBeNull()
        expect(subject.channelProblemOf([choiceOf()], [])).toBeNull()
    })

    it("names a channel another agent of the role answers", async () => {
        const subject = await buildSubject()

        expect(subject.channelProblemOf([choiceOf({ ownerAgentId: "s1", ownerAgentName: "Lan" })], ["tg1"])).toEqual({
            kind: "owned",
            connectionId: "tg1",
            agentName: "Lan",
        })
    })

    it("names a channel that is no choice of the role", async () => {
        const subject = await buildSubject()

        expect(subject.channelProblemOf([choiceOf()], ["tg1", "sp1"])).toEqual({
            kind: "unavailable",
            connectionId: "sp1",
        })
    })
})

describe("agent instances policy > copiedGrantsOf", () => {
    it("copies the shared connections the sibling is bound to, never a channel nor an unused one", async () => {
        const subject = await buildSubject()

        expect(
            subject.copiedGrantsOf([
                { id: "db1", purpose: "data_source", bound: true },
                { id: "api1", purpose: "tool", bound: true },
                { id: "tg1", purpose: "outbound_chat", bound: true },
                { id: "fb1", purpose: "lead_source", bound: true },
                { id: "db2", purpose: "data_source", bound: false },
            ]),
        ).toEqual([{ connectionId: "db1" }, { connectionId: "api1" }])
    })
})
