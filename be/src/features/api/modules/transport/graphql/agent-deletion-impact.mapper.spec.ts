import { toAgentDeletionImpactRequest, toAgentDeletionImpactType } from "./agent-deletion-impact.mapper"

describe("the agent deletion impact mapper", () => {
    it("builds the request from the workspace and the installation the input names", () => {
        expect(toAgentDeletionImpactRequest("ws-1", { installationId: "inst-1" })).toEqual({
            workspaceId: "ws-1",
            installationId: "inst-1",
        })
    })

    it("maps the impact field by field, record types most first as the service answers them", () => {
        expect(
            toAgentDeletionImpactType({
                installationId: "inst-1",
                agentId: null,
                recordTypes: [{ type: "blocks-core.chatbot.message", title: "Message", count: 4 }],
                records: 4,
                files: 1,
                channels: [
                    { kind: "connection", name: "Tiem hoa Lan", provider: "zalo_oa", connectionId: "conn-1" },
                    { kind: "website", name: "site-key-1", provider: null, connectionId: null },
                ],
            }),
        ).toEqual({
            agentId: null,
            files: 1,
            installationId: "inst-1",
            recordTypes: [{ count: 4, title: "Message", type: "blocks-core.chatbot.message" }],
            records: 4,
            channels: [
                { kind: "connection", name: "Tiem hoa Lan", provider: "zalo_oa", connectionId: "conn-1" },
                { kind: "website", name: "site-key-1", provider: null, connectionId: null },
            ],
        })
    })
})
