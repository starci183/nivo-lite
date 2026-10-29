import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MemberGrantsService } from "./member-grants.service"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ResolvedOfficeAuthority } from "@modules/domain/workspace-seed"
import { OfficeAuthorityService } from "./office-authority.service"

const AUTHORITY: ResolvedOfficeAuthority = {
    rules: [
        {
            department: "sales",
            action: "give_discount",
            unit: "percent",
            auto_max: 3,
            ask_max: 15,
            approver_group: { roles: ["manager"], rooms: ["sales"], members: [] },
            approval_policy: "any",
            timeout_minutes: 30,
            agents: ["agent-sales"],
            required_fields: ["customer"],
            note: "Discount",
        },
        {
            department: "accounting",
            action: "issue_invoice",
            unit: "vnd",
            auto_max: null,
            ask_max: 500_000_000,
            approver_group: { roles: [], rooms: ["accounting"], members: ["m-van"] },
            approval_policy: "any",
            timeout_minutes: 30,
            agents: ["agent-accounting"],
            required_fields: ["customer", "amount_vnd"],
            note: "Invoice",
        },
    ],
    grants: [
        { member_id: "m-minh", action: "give_discount", unit: "percent", limit: 15 },
        { member_id: "m-van", action: "issue_invoice", unit: "vnd", limit: 500_000_000 },
        { member_id: "m-ha", action: "give_discount", unit: "percent", limit: 10 },
    ],
}

const build = async () => {
    const rules = mock<AuthorityRulesService>()
    rules.save.mockResolvedValue(mock())
    const grants = mock<MemberGrantsService>()
    grants.replaceForAction.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeAuthorityService,
            { provide: AuthorityRulesService, useValue: rules },
            { provide: MemberGrantsService, useValue: grants },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeAuthorityService), rules, grants }
}

describe("OfficeAuthorityService", () => {
    it("saves each rule with its bands, approver group, policy, time and agents; the mode follows the auto band", async () => {
        const { service, rules } = await build()

        await service.apply("ws-1", AUTHORITY)

        expect(rules.save).toHaveBeenNthCalledWith(1, "ws-1", {
            action: "give_discount",
            department: "sales",
            mode: "auto",
            limit_vnd: null,
            required_fields: ["customer"],
            note: "Discount",
            unit: "percent",
            auto_max: 3,
            ask_max: 15,
            approver_roles: ["manager"],
            approver_rooms: ["sales"],
            approver_members: [],
            approval_policy: "any",
            timeout_minutes: 30,
            agents: ["agent-sales"],
        })
        expect(rules.save).toHaveBeenNthCalledWith(
            2,
            "ws-1",
            expect.objectContaining({ action: "issue_invoice", mode: "ask", approver_members: ["m-van"] }),
        )
    })

    it("makes the grants of each action exactly the seed's, one call per action", async () => {
        const { service, grants } = await build()

        await service.apply("ws-1", AUTHORITY)

        expect(grants.replaceForAction).toHaveBeenCalledTimes(2)
        expect(grants.replaceForAction).toHaveBeenNthCalledWith(1, "ws-1", "give_discount", [
            { memberId: "m-minh", maxAmount: 15 },
            { memberId: "m-ha", maxAmount: 10 },
        ])
        expect(grants.replaceForAction).toHaveBeenNthCalledWith(2, "ws-1", "issue_invoice", [
            { memberId: "m-van", maxAmount: 500_000_000 },
        ])
    })

    it("stops at the first rule the authority rules refuse, before any grant", async () => {
        const { service, rules, grants } = await build()
        rules.save.mockRejectedValueOnce(new Error("unknown action"))

        await expect(service.apply("ws-1", AUTHORITY)).rejects.toThrow("unknown action")

        expect(grants.replaceForAction).not.toHaveBeenCalled()
    })
})
