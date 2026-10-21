import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { FlowGate } from "./flows.contracts"
import { FLOW_GATE } from "./flows.decorators"
import { FlowsService } from "./flows.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const gate = mock<FlowGate>()
    gate.run.mockResolvedValue({ data: { ok: true } })
    const moduleRef = await Test.createTestingModule({
        providers: [
            FlowsService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: FLOW_GATE, useValue: gate },
        ],
    }).compile()
    return { flows: moduleRef.get(FlowsService), members, gate }
}

describe("FlowsService", () => {
    describe("run", () => {
        it.each(["save_authority", "save_rule", "save_staff", "assign", "authority_from_chat"] as const)(
            "asks for an owner or manager before %s",
            async (kind) => {
                const { flows, members, gate } = await build()

                await expect(flows.run("user-1", "ws-1", { kind, payload: { a: 1 } })).resolves.toEqual({
                    data: { ok: true },
                })

                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
                expect(gate.run).toHaveBeenCalledWith({ kind, workspaceId: "ws-1", member: MEMBER, payload: { a: 1 } })
            },
        )

        it.each(["decide", "hold", "take_over", "send_as_human", "owner_chat"] as const)(
            "asks only for a member before %s",
            async (kind) => {
                const { flows, members } = await build()

                await flows.run("user-1", "ws-1", { kind, payload: {} })

                expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", [])
            },
        )

        it("does not reach the engine for a stranger", async () => {
            const { flows, members, gate } = await build()
            members.require.mockRejectedValue(new Error("refused"))

            await expect(flows.run("user-9", "ws-1", { kind: "decide", payload: {} })).rejects.toThrow("refused")

            expect(gate.run).not.toHaveBeenCalled()
        })
    })
})
