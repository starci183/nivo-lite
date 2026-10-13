import { builder } from "@starci/jest-preset"
import type { ResendWorkspaceInviteResult } from "../../application/resend-workspace-invite.contracts"
import { toResendWorkspaceInviteRequest, toResendWorkspaceInviteResponse } from "./resend-workspace-invite.mapper"

const resultOf = builder<ResendWorkspaceInviteResult>({ email: "staff@example.test", delivery: "invited" })

describe("resend-workspace-invite mapper", () => {
    it("copies both path ids into the request", () => {
        expect(toResendWorkspaceInviteRequest("workspace-1", "invite-1")).toEqual({
            workspaceId: "workspace-1",
            inviteId: "invite-1",
        })
    })

    it("preserves the invitation delivery result", () => {
        const result = resultOf()

        expect(toResendWorkspaceInviteResponse(result)).toBe(result)
        expect(toResendWorkspaceInviteResponse(result)).toEqual({ email: "staff@example.test", delivery: "invited" })
    })
})
