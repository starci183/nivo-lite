import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import { AdminAccessService } from "./admin-access.service"
import { PlatformAdminErrorCode } from "./errors/platform-admin.error"
import { PLATFORM_ADMIN_OPTIONS } from "./platform-admin.decorators"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const build = async () => {
    const audits = mock<PlatformAuditService>()
    audits.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AdminAccessService,
            { provide: PlatformAuditService, useValue: audits },
            { provide: PLATFORM_ADMIN_OPTIONS, useValue: { admins: ["team@nivo.vn"] } },
        ],
    }).compile()
    return { access: moduleRef.get(AdminAccessService), audits }
}

const admin = { userId: "u-1", email: "team@nivo.vn" }

describe("AdminAccessService", () => {
    describe("requireAdmin", () => {
        it("answers the admin identity with a lower-cased email", async () => {
            const { access } = await build()

            expect(access.requireAdmin({ id: "u-1", email: " Team@Nivo.vn", role: "authenticated" })).toEqual(admin)
        })

        it.each([
            ["a caller who is not on the team", "other@nivo.vn"],
            ["a caller whose token carries no email", undefined],
        ])("answers not found for %s", async (_name, email) => {
            const { access } = await build()

            expect(thrownBy(() => access.requireAdmin({ id: "u-2", email, role: "authenticated" }))).toEqual(
                objectLike({ code: PlatformAdminErrorCode.NotFound }),
            )
        })
    })

    describe("audit", () => {
        it("records what the admin did", async () => {
            const { access, audits } = await build()

            await access.audit(admin, "view.workspace", "ws-1", { filter: "all" })

            expect(audits.record).toHaveBeenCalledWith({
                actorId: "u-1",
                actorEmail: "team@nivo.vn",
                action: "view.workspace",
                workspaceId: "ws-1",
                data: { filter: "all" },
            })
        })

        it("records an empty context when none is given", async () => {
            const { access, audits } = await build()

            await access.audit(admin, "view.health", null)

            expect(audits.record).toHaveBeenCalledWith(objectLike({ workspaceId: null, data: {} }))
        })
    })
})
