import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { DirectoryMember } from "@modules/domain/member-grants"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    AGENT,
    DIRECTORY,
    HA,
    HA_REF,
    MINH,
    MINH_REF,
    NOW,
    OWNER,
    OWNER_REF,
    approvalRequestOf,
    ESCALATION_EXPIRY_SET,
} from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { ApprovalLogEvent } from "./approval-requests.log-events"
import { APPROVAL_AGENT_OWNERS } from "./approval-requests.decorators"
import type { AgentOwnerRef, ApprovalAgentOwners } from "./approval-requests.port"
import { ApprovalRequestEntity } from "./persistence/entities"

const FIND_OWNER_SEAT = "SELECT * FROM public.workspace_owner_member($1)"

const build = async (owners: AgentOwnerRef | Error, seat: string | null = "member-owner") => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [FIND_OWNER_SEAT, seat === null ? [] : [{ workspace_owner_member: seat }]],
            update: [ApprovalRequestEntity, { affected: 1 }],
        }),
    )
    const agentOwners = mock<ApprovalAgentOwners>()
    if (owners instanceof Error) agentOwners.ownerOf.mockRejectedValue(owners)
    else agentOwners.ownerOf.mockResolvedValue(owners)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalEscalationService,
            { provide: LOGGER, useValue: logger },
            { provide: APPROVAL_AGENT_OWNERS, useValue: agentOwners },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalEscalationService), tx, agentOwners, logger }
}

const expireWith = async (
    owners: AgentOwnerRef | Error,
    options: { readonly directory?: ReadonlyArray<DirectoryMember>; readonly seat?: string | null } = {},
) => {
    const built = await build(owners, options.seat)
    const row = approvalRequestOf()
    const event = await built.service.expire(built.tx.em, row, options.directory ?? DIRECTORY, new Date(NOW))
    return { ...built, event, resolved: built.tx.em.update.mock.calls.at(-1) }
}

describe("ApprovalEscalationService > expire", () => {
    it("hands the request to the owner of the agent that asked and settles it as expired", async () => {
        const { event, resolved, agentOwners } = await expireWith({
            ownerMemberId: "member-minh",
            fallbackMemberId: null,
        })

        expect(event).toEqual({
            requestId: "request-1",
            outcome: "expired",
            decidedBy: null,
            decidedByName: null,
            action: "give_discount",
            workspaceId: "ws-1",
            chainStepId: "step-1",
            escalatedTo: MINH_REF,
        })
        expect(resolved).toEqual([ApprovalRequestEntity, { id: "request-1", status: "pending" }, ESCALATION_EXPIRY_SET])
        expect(agentOwners.ownerOf).toHaveBeenCalledWith(AGENT)
    })

    it("hands the request to the fallback when the owner of the agent is disabled", async () => {
        const directory = [{ ...MINH, status: "disabled" as const }, HA, ...DIRECTORY.slice(3)]

        const { event } = await expireWith(
            { ownerMemberId: "member-minh", fallbackMemberId: "member-ha" },
            { directory },
        )

        expect(event.escalatedTo).toEqual(HA_REF)
    })

    it("hands the request to the workspace owner when the agent has no owner and no fallback", async () => {
        const { event } = await expireWith({ ownerMemberId: null, fallbackMemberId: null })

        expect(event.escalatedTo).toEqual(OWNER_REF)
    })

    it("hands the request to the workspace owner when the agent can no longer be read, and logs it", async () => {
        const cause = new Error("agent gone")

        const { event, logger } = await expireWith(cause)

        expect(event.escalatedTo).toEqual(OWNER_REF)
        expect(logger.error).toHaveBeenCalledWith(ApprovalLogEvent.OwnerUnreadable, cause, { requestId: "request-1" })
    })

    it("leaves the request with nobody when not even the workspace owner is active", async () => {
        const directory = [{ ...OWNER, status: "disabled" as const }, ...DIRECTORY.slice(1)]

        const { event, resolved } = await expireWith(
            { ownerMemberId: null, fallbackMemberId: null },
            { directory, seat: "member-owner" },
        )

        expect(event.escalatedTo).toBeNull()
        expect(resolved?.[2]).toMatchObject({ escalatedTo: null })
    })

    it("leaves the request with nobody when the workspace has no owner seat at all", async () => {
        const { event, resolved } = await expireWith({ ownerMemberId: null, fallbackMemberId: null }, { seat: null })

        expect(event.escalatedTo).toBeNull()
        expect(resolved?.[2]).toMatchObject({ escalatedTo: null })
    })

    it("does not ask the agents when the agent that asked was deleted", async () => {
        const built = await build({ ownerMemberId: "member-minh", fallbackMemberId: null })
        const row = approvalRequestOf({ requested_by_agent_id: null })

        const event = await built.service.expire(built.tx.em, row, DIRECTORY, new Date(NOW))

        expect(event.escalatedTo).toEqual(OWNER_REF)
        expect(built.agentOwners.ownerOf).not.toHaveBeenCalled()
    })
})
