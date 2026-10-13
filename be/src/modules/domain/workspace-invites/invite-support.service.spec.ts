import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceInvitesErrorCode } from "./errors/workspace-invites.error"
import { InviteSupportService } from "./invite-support.service"
import { MINT_TOKEN, ROTATE_INVITE } from "./persistence/workspace-invites.sql"
import type { InviteDeliveryPort } from "./workspace-invites.contracts"
import { INVITE_DELIVERY, WORKSPACE_INVITES_OPTIONS } from "./workspace-invites.port"

const NOW = new Date("2026-10-12T00:00:00.000Z")

const build = async (rotated: ReadonlyArray<object>) => {
    const em = mockEntityManager({
        query: [
            [MINT_TOKEN, [{ token: "tok" }]],
            [ROTATE_INVITE, rotated],
        ],
    })
    const delivery = mock<InviteDeliveryPort>()
    delivery.deliverInvite.mockResolvedValue("invited")
    const moduleRef = await Test.createTestingModule({
        providers: [
            InviteSupportService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            {
                provide: WORKSPACE_INVITES_OPTIONS,
                useValue: { siteUrl: "https://nivo.vn", inviteDays: 7, delivery: "x" },
            },
            { provide: INVITE_DELIVERY, useValue: delivery },
        ],
    }).compile()
    return { support: moduleRef.get(InviteSupportService), em, delivery }
}

describe("InviteSupportService", () => {
    it("rotates the token, extends the life and emails the new link", async () => {
        const { support, em, delivery } = await build([{ id: "i-1", email: "ha@nivo.vn", role: "staff" }])

        await expect(support.reissue("ws-1", "i-1")).resolves.toEqual({
            email: "ha@nivo.vn",
            link: "https://nivo.vn/invite/tok",
            delivery: "invited",
        })

        expect(em.query).toHaveBeenCalledWith(ROTATE_INVITE, [
            "i-1",
            "ws-1",
            "tok",
            new Date("2026-10-19T00:00:00.000Z"),
        ])
        expect(delivery.deliverInvite).toHaveBeenCalledWith(
            "ha@nivo.vn",
            "https://nivo.vn/auth/confirm?next=%2Finvite%2Ftok",
        )
    })

    it("answers not found for an invitation that is not pending and sends nothing", async () => {
        const { support, delivery } = await build([])

        await expect(support.reissue("ws-1", "i-9")).rejects.toMatchObject({ code: WorkspaceInvitesErrorCode.NotFound })
        expect(delivery.deliverInvite).not.toHaveBeenCalled()
    })
})
