import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CREATOR, packageOf } from "@tests/fixtures/builders/agent-template.builder"
import { AgentTemplateVersionsService } from "./agent-template-versions.service"
import { AgentTemplatesError, AgentTemplatesErrorCode } from "./errors/agent-templates.error"
import { AgentTemplateEntity, AgentTemplateVersionEntity } from "./persistence/entities"

const AT = new Date("2026-11-03T01:00:00.000Z")

const template = (over: Partial<AgentTemplateEntity> = {}): AgentTemplateEntity =>
    Object.assign(new AgentTemplateEntity(), {
        id: "template-1",
        key: "spa-booking-by-linh",
        creatorAccountId: CREATOR.accountId,
        baseModule: "accounting",
        name: { vi: "Dat lich spa", en: "Spa booking" },
        firstParty: false,
        ...over,
    })

const versionRow = (over: Partial<AgentTemplateVersionEntity> = {}): AgentTemplateVersionEntity =>
    Object.assign(new AgentTemplateVersionEntity(), {
        id: "row-1",
        templateId: "template-1",
        key: "spa-booking-by-linh",
        version: 1,
        package: packageOf(),
        hash: packageOf().hash,
        changelog: "First",
        breaking: false,
        createdAt: AT,
        ...over,
    })

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const tx = fakeTransaction(em)
    const moduleRef = await Test.createTestingModule({
        providers: [AgentTemplateVersionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentTemplateVersionsService), em, tx }
}

describe("AgentTemplateVersionsService reads", () => {
    it("answers the template of a key and the newest version number, zero when there is none", async () => {
        const some = await build(
            mockEntityManager({
                findOne: [
                    [AgentTemplateEntity, template()],
                    [AgentTemplateVersionEntity, versionRow({ version: 3 })],
                ],
            }),
        )
        const none = await build(mockEntityManager({ findOne: [AgentTemplateVersionEntity, null] }))

        await expect(some.service.templateOf("spa-booking-by-linh")).resolves.toMatchObject({ id: "template-1" })
        await expect(some.service.latestNumber("spa-booking-by-linh")).resolves.toBe(3)
        await expect(none.service.latestNumber("spa-booking-by-linh")).resolves.toBe(0)
    })

    it("reads a version back through the closed schema, with the account that owns the template", async () => {
        const { service } = await build(
            mockEntityManager({
                findOne: [
                    [AgentTemplateEntity, template({ firstParty: true })],
                    [AgentTemplateVersionEntity, versionRow()],
                ],
            }),
        )

        const found = await service.find("spa-booking-by-linh", 1)

        expect(found).toMatchObject({
            key: "spa-booking-by-linh",
            version: 1,
            creatorAccountId: CREATOR.accountId,
            firstParty: true,
            breaking: false,
        })
        expect(found?.package.hash).toBe(packageOf().hash)
    })

    it("answers none for a version that is missing, whose template is gone, or whose package no longer parses", async () => {
        const missing = await build(
            mockEntityManager({
                findOne: [
                    [AgentTemplateEntity, template()],
                    [AgentTemplateVersionEntity, null],
                ],
            }),
        )
        const orphan = await build(
            mockEntityManager({
                findOne: [
                    [AgentTemplateEntity, null],
                    [AgentTemplateVersionEntity, versionRow()],
                ],
            }),
        )
        const broken = await build(
            mockEntityManager({
                findOne: [
                    [AgentTemplateEntity, template()],
                    [
                        AgentTemplateVersionEntity,
                        versionRow({ package: Object.assign({}, packageOf(), { format: 2 }) }),
                    ],
                ],
            }),
        )

        await expect(missing.service.find("spa-booking-by-linh", 1)).resolves.toBeNull()
        await expect(orphan.service.find("spa-booking-by-linh", 1)).resolves.toBeNull()
        await expect(broken.service.find("spa-booking-by-linh", 1)).resolves.toBeNull()
        await expect(broken.service.require("spa-booking-by-linh", 1)).rejects.toMatchObject({
            code: AgentTemplatesErrorCode.VersionNotFound,
        })
    })

    it("lists the templates of an account with their versions, newest first", async () => {
        const { service } = await build(
            mockEntityManager({
                find: [
                    [AgentTemplateEntity, [template()]],
                    [AgentTemplateVersionEntity, [versionRow({ version: 2 }), versionRow({ version: 1 })]],
                ],
            }),
        )

        const listed = await service.listOf(CREATOR.accountId)

        expect(listed).toHaveLength(1)
        expect(listed[0]?.versions.map((entry) => entry.version)).toEqual([2, 1])
        expect(listed[0]?.versions[0]?.createdAt).toBe(AT.toISOString())
    })
})

describe("AgentTemplateVersionsService.save", () => {
    const pkg = packageOf()
    const input = {
        package: pkg,
        creatorAccountId: CREATOR.accountId,
        sourceWorkspaceId: "ws-1",
        changelog: "First",
        breaking: false,
    }

    it("creates the template with its first version in one transaction", async () => {
        const { service, em, tx } = await build(
            mockEntityManager({
                findOne: [
                    [AgentTemplateEntity, null],
                    [AgentTemplateVersionEntity, versionRow()],
                ],
                insert: [
                    [AgentTemplateEntity, { identifiers: [{ id: "template-1" }] }],
                    [AgentTemplateVersionEntity, { identifiers: [{ id: "row-1" }] }],
                ],
                findOneOrFail: [AgentTemplateVersionEntity, versionRow()],
            }),
        )

        const saved = await service.save({ ...input, firstParty: true, forkedFrom: "chatbot" })

        expect(saved).toMatchObject({ key: "spa-booking-by-linh", version: 1, hash: pkg.hash })
        expect(tx.commits).toBe(1)
        expect(em.insert).toHaveBeenCalledWith(
            AgentTemplateEntity,
            expect.objectContaining({ firstParty: true, forkedFrom: "chatbot", creatorAccountId: CREATOR.accountId }),
        )
        expect(em.insert).toHaveBeenCalledWith(
            AgentTemplateVersionEntity,
            expect.objectContaining({ templateId: "template-1", version: 1 }),
        )
    })

    it("adds a version to the template of the same account without making another template", async () => {
        const { service, em } = await build(
            mockEntityManager({
                findOne: [AgentTemplateEntity, template()],
                insert: [AgentTemplateVersionEntity, { identifiers: [{ id: "row-1" }] }],
                findOneOrFail: [AgentTemplateVersionEntity, versionRow()],
            }),
        )

        await service.save(input)

        expect(em.insert).toHaveBeenCalledTimes(1)
        expect(em.insert).toHaveBeenCalledWith(
            AgentTemplateVersionEntity,
            expect.objectContaining({ templateId: "template-1" }),
        )
    })

    it("refuses a key another account owns, and writes nothing", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentTemplateEntity, template({ creatorAccountId: "someone-else" })] }),
        )

        await expect(service.save(input)).rejects.toBeInstanceOf(AgentTemplatesError)
        await expect(service.save(input)).rejects.toMatchObject({ code: AgentTemplatesErrorCode.KeyTaken })
        expect(em.insert).not.toHaveBeenCalled()
    })
})
