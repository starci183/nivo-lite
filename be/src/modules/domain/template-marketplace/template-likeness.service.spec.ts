import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentTemplateVersionsService } from "@modules/domain/agent-templates"
import { AdminAccessService } from "@modules/domain/platform-admin"
import type { Principal } from "@modules/platform/cqrs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CREATOR } from "@tests/fixtures/builders/agent-template.builder"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateLikenessService } from "./template-likeness.service"
import { TemplateLikenessGrantEntity } from "./persistence/entities"

const NOW = new Date("2026-11-03T02:00:00.000Z")
const ADMIN: Principal = { id: "admin-1", email: "admin@nivo.vn", role: "authenticated" }

const grantRow = (over: Partial<TemplateLikenessGrantEntity> = {}): TemplateLikenessGrantEntity =>
    Object.assign(new TemplateLikenessGrantEntity(), {
        id: "grant-1",
        templateKey: "spa-booking-by-linh",
        personName: "Ngoc Trinh",
        allowedUses: ["name", "voice_style"],
        disclosure: "Tro ly AI cua Ngoc Trinh",
        grantedBy: CREATOR.accountId,
        verifiedBy: null,
        verifiedAt: null,
        expiresAt: null,
        revokedAt: null,
        ...over,
    })

const build = async (em: MockEntityManager = mockEntityManager(), owner: string = CREATOR.accountId) => {
    const versions = mock<AgentTemplateVersionsService>({
        templateOf: jest.fn().mockResolvedValue({ creatorAccountId: owner }),
    })
    const access = mock<AdminAccessService>({
        requireAdmin: jest.fn().mockReturnValue({ userId: "admin-1", email: "a@nivo.vn" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TemplateLikenessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentTemplateVersionsService, useValue: versions },
            { provide: AdminAccessService, useValue: access },
        ],
    }).compile()
    return { service: moduleRef.get(TemplateLikenessService), em, versions }
}

const CLAIM = { personName: "ngoc trinh", allowedUses: ["name" as const], disclosure: "AI" }
const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof TemplateMarketplaceError ? cause.code : cause
    }
}

describe("TemplateLikenessService", () => {
    it("records the consent of a person to a persona of a template of the caller, unverified until a reviewer checks it", async () => {
        const { service, em } = await build(
            mockEntityManager({
                insert: [TemplateLikenessGrantEntity, { identifiers: [{ id: "grant-1" }] }],
                findOneOrFail: [TemplateLikenessGrantEntity, grantRow()],
            }),
        )

        const view = await service.record(CREATOR.accountId, {
            templateKey: "spa-booking-by-linh",
            personName: " Ngoc Trinh ",
            allowedUses: ["name", "voice_style"],
            disclosure: " Tro ly AI cua Ngoc Trinh ",
            expiresAt: null,
        })

        expect(em.insert).toHaveBeenCalledWith(
            TemplateLikenessGrantEntity,
            expect.objectContaining({
                personName: "Ngoc Trinh",
                grantedBy: CREATOR.accountId,
                disclosure: "Tro ly AI cua Ngoc Trinh",
            }),
        )
        expect(view).toEqual({
            id: "grant-1",
            templateKey: "spa-booking-by-linh",
            personName: "Ngoc Trinh",
            allowedUses: ["name", "voice_style"],
            disclosure: "Tro ly AI cua Ngoc Trinh",
            verified: false,
            expiresAt: null,
            revoked: false,
        })
    })

    it("refuses to record, list or revoke for a template of another account", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [TemplateLikenessGrantEntity, grantRow()] }),
            "someone-else",
        )

        expect(
            await codeOf(
                service.record(CREATOR.accountId, {
                    templateKey: "spa-booking-by-linh",
                    personName: "x",
                    allowedUses: ["name"],
                    disclosure: "AI",
                    expiresAt: null,
                }),
            ),
        ).toBe(TemplateMarketplaceErrorCode.NotYours)
        expect(await codeOf(service.list(CREATOR.accountId, "spa-booking-by-linh"))).toBe(
            TemplateMarketplaceErrorCode.NotYours,
        )
        expect(await codeOf(service.revoke(CREATOR.accountId, "grant-1"))).toBe(TemplateMarketplaceErrorCode.NotYours)
        expect(em.update).not.toHaveBeenCalled()
    })

    it("lists the records of a template of the caller, with their end date and whether they were taken back", async () => {
        const { service } = await build(
            mockEntityManager({
                find: [
                    TemplateLikenessGrantEntity,
                    [
                        grantRow({
                            expiresAt: new Date("2027-01-01T00:00:00.000Z"),
                            revokedAt: NOW,
                            verifiedBy: "admin-1",
                        }),
                    ],
                ],
            }),
        )

        await expect(service.list(CREATOR.accountId, "spa-booking-by-linh")).resolves.toEqual([
            expect.objectContaining({ verified: true, revoked: true, expiresAt: "2027-01-01T00:00:00.000Z" }),
        ])
    })

    it("takes a consent back at the time of the clock, and says so when it does not exist", async () => {
        const { service, em } = await build(
            mockEntityManager({
                findOne: [TemplateLikenessGrantEntity, grantRow()],
                update: [TemplateLikenessGrantEntity, { affected: 1 }],
                findOneOrFail: [TemplateLikenessGrantEntity, grantRow({ revokedAt: NOW })],
            }),
        )
        const none = await build(mockEntityManager({ findOne: [TemplateLikenessGrantEntity, null] }))

        await expect(service.revoke(CREATOR.accountId, "grant-1")).resolves.toMatchObject({ revoked: true })
        expect(em.update).toHaveBeenCalledWith(TemplateLikenessGrantEntity, { id: "grant-1" }, { revokedAt: NOW })
        expect(await codeOf(none.service.revoke(CREATOR.accountId, "grant-1"))).toBe(
            TemplateMarketplaceErrorCode.GrantNotFound,
        )
    })

    it("lets a platform reviewer verify the identity of the person, and says so when the record does not exist", async () => {
        const { service, em } = await build(
            mockEntityManager({
                findOne: [TemplateLikenessGrantEntity, grantRow()],
                update: [TemplateLikenessGrantEntity, { affected: 1 }],
                findOneOrFail: [TemplateLikenessGrantEntity, grantRow({ verifiedBy: "admin-1" })],
            }),
        )
        const none = await build(mockEntityManager({ findOne: [TemplateLikenessGrantEntity, null] }))

        await expect(service.verify(ADMIN, "grant-1")).resolves.toMatchObject({ verified: true })
        expect(em.update).toHaveBeenCalledWith(
            TemplateLikenessGrantEntity,
            { id: "grant-1" },
            { verifiedBy: "admin-1", verifiedAt: NOW },
        )
        expect(await codeOf(none.service.verify(ADMIN, "grant-1"))).toBe(TemplateMarketplaceErrorCode.GrantNotFound)
    })

    it("covers a persona only with a verified, valid consent of that person; a neutral persona needs none", async () => {
        const verified = await build(
            mockEntityManager({ find: [TemplateLikenessGrantEntity, [grantRow({ verifiedBy: "admin-1" })]] }),
        )
        const unverified = await build(mockEntityManager({ find: [TemplateLikenessGrantEntity, [grantRow()]] }))
        const taken = await build(
            mockEntityManager({
                find: [TemplateLikenessGrantEntity, [grantRow({ verifiedBy: "admin-1", revokedAt: NOW })]],
            }),
        )

        await expect(verified.service.covers("spa-booking-by-linh", CLAIM)).resolves.toBe(true)
        await expect(unverified.service.covers("spa-booking-by-linh", CLAIM)).resolves.toBe(false)
        await expect(taken.service.covers("spa-booking-by-linh", CLAIM)).resolves.toBe(false)
        await expect(unverified.service.covers("spa-booking-by-linh", null)).resolves.toBe(true)
    })
})
