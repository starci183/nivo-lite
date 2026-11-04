import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TemplateInstallEntity, TemplateLicenseEntity } from "./persistence/entities"
import { TemplateRecordsService } from "./template-records.service"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [TemplateRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(TemplateRecordsService), em }
}

const INSTALLATION = { id: "inst-1", workspaceId: "ws-1" }

describe("TemplateRecordsService reads", () => {
    it("names the installations among these that already have an install row", async () => {
        const { service, em } = await build(
            mockEntityManager({
                find: [
                    TemplateInstallEntity,
                    [Object.assign(new TemplateInstallEntity(), { installationId: "inst-1" })],
                ],
            }),
        )

        const known = await service.installedAmong(["inst-1", "inst-2"])

        expect([...known]).toEqual(["inst-1"])
        expect(em.find).toHaveBeenCalledWith(TemplateInstallEntity, expect.objectContaining({ take: 2 }))
    })

    it("answers the oldest paid license nobody runs on, a license by id, the installs of a workspace and one install", async () => {
        const license = Object.assign(new TemplateLicenseEntity(), { id: "license-1" })
        const install = Object.assign(new TemplateInstallEntity(), { installationId: "inst-1" })
        const { service } = await build(
            mockEntityManager({
                findOne: [
                    [TemplateLicenseEntity, license],
                    [TemplateInstallEntity, install],
                ],
                find: [TemplateInstallEntity, [install]],
            }),
        )

        await expect(service.unclaimedPaidLicense("ws-1", "key", "listing-1")).resolves.toBe(license)
        await expect(service.licenseById("license-1")).resolves.toBe(license)
        await expect(service.installsOf("ws-1", 10)).resolves.toEqual([install])
        await expect(service.installOf("ws-1", "inst-1")).resolves.toBe(install)
    })

    it("tells whether an order already has its license, in the transaction of the caller", async () => {
        const some = await build(
            mockEntityManager({
                findOne: [TemplateLicenseEntity, Object.assign(new TemplateLicenseEntity(), { id: "license-1" })],
            }),
        )
        const none = await build(mockEntityManager({ findOne: [TemplateLicenseEntity, null] }))

        await expect(some.service.hasLicenseForOrder(some.em, "order-1")).resolves.toBe(true)
        await expect(none.service.hasLicenseForOrder(none.em, "order-1")).resolves.toBe(false)
    })
})

describe("TemplateRecordsService writes", () => {
    it("writes the paid license of a settled order with the manager it is given", async () => {
        const { service, em } = await build(mockEntityManager({ insert: [TemplateLicenseEntity, {}] }))

        await service.grantPaid(em, {
            workspaceId: "ws-1",
            templateKey: "key",
            listingId: "listing-1",
            orderId: "order-1",
        })

        expect(em.insert).toHaveBeenCalledWith(
            TemplateLicenseEntity,
            expect.objectContaining({ kind: "paid", orderId: "order-1", installationId: null, status: "active" }),
        )
    })

    it("records an adopted installation as a free license and an install of version 1, and a missing license id as none", async () => {
        const given = await build(
            mockEntityManager({
                insert: [
                    [TemplateLicenseEntity, { identifiers: [{ id: "license-1" }] }],
                    [TemplateInstallEntity, {}],
                ],
            }),
        )
        const missing = await build(
            mockEntityManager({
                insert: [
                    [TemplateLicenseEntity, { identifiers: [] }],
                    [TemplateInstallEntity, {}],
                ],
            }),
        )

        await given.service.adopt(INSTALLATION, "nivo-accounting")
        await missing.service.adopt(INSTALLATION, "nivo-accounting")

        expect(given.em.insert).toHaveBeenCalledWith(
            TemplateLicenseEntity,
            expect.objectContaining({ kind: "free", installationId: "inst-1", templateKey: "nivo-accounting" }),
        )
        expect(given.em.insert).toHaveBeenCalledWith(
            TemplateInstallEntity,
            expect.objectContaining({ version: 1, parameterValues: {}, licenseId: "license-1", installedBy: null }),
        )
        expect(missing.em.insert).toHaveBeenCalledWith(
            TemplateInstallEntity,
            expect.objectContaining({ licenseId: null }),
        )
    })

    it("moves an install to a newer version with its values", async () => {
        const { service, em } = await build(mockEntityManager({ update: [TemplateInstallEntity, { affected: 1 }] }))

        await service.moveInstall({ installationId: "inst-1", version: 2, parameterValues: { a: 1 } })

        expect(em.update).toHaveBeenCalledWith(
            TemplateInstallEntity,
            { installationId: "inst-1" },
            { version: 2, parameterValues: { a: 1 } },
        )
    })
})
