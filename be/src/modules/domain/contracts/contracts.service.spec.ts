import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { LeadReadService } from "@modules/domain/leads"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, REQUEST_LOCALE } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import { ContractLinkService } from "./contract-link.service"
import type { SaveContractParams } from "./contracts.contracts"
import { ContractsService } from "./contracts.service"
import { ContractsErrorCode } from "./errors/contracts.error"
import { ContractEntity } from "./persistence/entities"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { entityRowBuilder, namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"

const paramsOf = builder<SaveContractParams>({
    workspaceId: "ws-1",
    contractId: null,
    leadId: "lead-1",
    customerName: " Anh Minh ",
    plan: "Monthly",
    startsOn: "2026-10-01",
    endsOn: "2027-09-30",
    amountVnd: 5_000_000,
    status: "active",
    note: "",
    userId: "user-1",
    acceptLanguage: "en",
})

const rowOf = entityRowBuilder<ContractEntity>({
    id: "contract-1",
    workspaceId: "ws-1",
    leadId: "lead-1",
    customerName: "Anh Minh",
    plan: "Monthly",
    startsOn: "2026-10-01",
    endsOn: "2027-09-30",
    amountVnd: 5_000_000,
    status: "active",
    note: "",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})
const ROW = rowOf()

const FIELDS = {
    leadId: "lead-1",
    customerName: "Anh Minh",
    plan: "Monthly",
    startsOn: "2026-10-01",
    endsOn: "2027-09-30",
    amountVnd: 5_000_000,
    status: "active",
    note: "",
}

const build = async (entityManager: MockEntityManager) => {
    const messages = mock<MessageCatalog>()
    messages.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const requestLocale = mock<RequestLocale>()
    requestLocale.of.mockReturnValue("en")
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Linh",
        status: "active",
    })
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const links = mock<ContractLinkService>()
    links.linkCustomers.mockResolvedValue({ linked: 1, created: 0, unmatched: [] })
    const leads = mock<LeadReadService>()
    leads.isOwn.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContractsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: REQUEST_LOCALE, useValue: requestLocale },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
            { provide: ContractLinkService, useValue: links },
            { provide: LeadReadService, useValue: leads },
        ],
    }).compile()
    return { members, contracts: moduleRef.get(ContractsService), events, requestLocale, links, leads }
}

describe("ContractsService", () => {
    describe("saveContract", () => {
        it("adds a contract linked to a lead of the workspace and logs it in the same transaction", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const [insert] = queueQueryBuilders(tx.em, [{ execute: { raw: [ROW] } }])
            const { contracts, events, requestLocale, leads } = await build(tx.em)

            await expect(contracts.saveContract(paramsOf())).resolves.toEqual({
                id: "contract-1",
                leadId: "lead-1",
                customerName: "Anh Minh",
                plan: "Monthly",
                startsOn: "2026-10-01",
                endsOn: "2027-09-30",
                amountVnd: 5_000_000,
                status: "active",
                note: "",
            })

            expect(leads.isOwn).toHaveBeenCalledWith("ws-1", "lead-1", expect.anything())
            expect(isTransactionManager(leads.isOwn.mock.calls[0]?.[2])).toBe(true)
            expect(insert?.callsOf("values")).toEqual([[{ workspaceId: "ws-1", ...FIELDS }]])
            expect(requestLocale.of).toHaveBeenCalledWith("en")
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "contract.created",
                    actor: "Linh",
                    summary: 'contracts.created:{"who":"Linh","customer":"Anh Minh"}',
                    evidence: "2026-10-01 → 2027-09-30",
                },
                expect.anything(),
            )
            expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("edits a contract of the workspace without a lead link and logs the update", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const [update] = queueQueryBuilders(tx.em, [{ execute: { raw: [{ ...ROW, leadId: null }] } }])
            const { contracts, events } = await build(tx.em)

            await expect(
                contracts.saveContract(paramsOf({ contractId: "contract-1", leadId: null })),
            ).resolves.toMatchObject({ id: "contract-1", leadId: null })

            expect(update?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", contractId: "contract-1" })
            expect(update?.callsOf("set")[0]?.[0]).toMatchObject({ ...FIELDS, leadId: null })
            expect(evaluatedValues(update?.callsOf("set")[0]?.[0])).toMatchObject({ updatedAt: "now()" })
            expect(events.record).toHaveBeenCalledWith(
                expect.objectContaining({
                    leadId: null,
                    kind: "contract.updated",
                    summary: 'contracts.updated:{"who":"Linh","customer":"Anh Minh"}',
                }),
                expect.anything(),
            )
            expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
        })
    })
})

describe("ContractsService", () => {
    describe("saveContract policy", () => {
        it("refuses a contract that fails the policy and writes nothing", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { contracts, events } = await build(tx.em)

            await expect(contracts.saveContract(paramsOf({ customerName: "  " }))).rejects.toMatchObject({
                code: ContractsErrorCode.CustomerRequired,
            })

            expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
            expect(events.record).not.toHaveBeenCalled()
            expect(tx.rollbacks).toBe(1)
        })

        it("carries the parameters of a refusal", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { contracts } = await build(tx.em)

            await expect(contracts.saveContract(paramsOf({ status: "paused" }))).rejects.toMatchObject({
                code: ContractsErrorCode.StatusInvalid,
                params: { list: "active, ended, cancelled" },
            })
        })
    })
})

describe("ContractsService", () => {
    describe("saveContract refusals", () => {
        it("refuses a lead the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const [insert] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
            const { contracts, events, leads } = await build(tx.em)
            leads.isOwn.mockResolvedValue(false)

            await expect(contracts.saveContract(paramsOf())).rejects.toMatchObject({
                code: ContractsErrorCode.LeadNotFound,
                params: { id: "lead-1" },
            })

            expect(insert?.callsOf("execute")).toEqual([])
            expect(events.record).not.toHaveBeenCalled()
        })

        it("refuses an edit that names a lead the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const [update] = queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
            const { contracts, leads } = await build(tx.em)
            leads.isOwn.mockResolvedValue(false)

            await expect(contracts.saveContract(paramsOf({ contractId: "contract-1" }))).rejects.toMatchObject({
                code: ContractsErrorCode.NotFound,
            })
            expect(update?.callsOf("execute")).toEqual([])
        })

        it("refuses an edit whose write answers no row list", async () => {
            const tx = fakeTransaction(mockEntityManager())
            queueQueryBuilders(tx.em, [{ execute: { raw: undefined } }])
            const { contracts } = await build(tx.em)

            await expect(
                contracts.saveContract(paramsOf({ contractId: "contract-9", leadId: null })),
            ).rejects.toMatchObject({ code: ContractsErrorCode.NotFound, params: { id: "contract-9" } })
        })

        it("refuses an edit of a contract the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager())
            queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
            const { contracts } = await build(tx.em)

            await expect(
                contracts.saveContract(paramsOf({ contractId: "contract-9", leadId: null })),
            ).rejects.toMatchObject({ code: ContractsErrorCode.NotFound, params: { id: "contract-9" } })
        })
    })

    describe("attachLead", () => {
        it("links the lead to the workspace's contract on the system's behalf", async () => {
            const em = mockEntityManager()
            const [attach] = queueQueryBuilders(em, [{ execute: {} }])
            const { contracts, members } = await build(em)

            await expect(contracts.attachLead("ws-1", "contract-1", "lead-9")).resolves.toBeUndefined()
            expect(attach?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", contractId: "contract-1" })
            expect(members.require).not.toHaveBeenCalled()
            expect(evaluatedValues(attach?.callsOf("set")[0]?.[0])).toEqual({ leadId: "lead-9", updatedAt: "now()" })
        })
    })

    describe("attachLead refusals", () => {
        it("links nothing when the lead is not the workspace own", async () => {
            const em = mockEntityManager()
            const [attach] = queueQueryBuilders(em, [{ execute: {} }])
            const { contracts, leads } = await build(em)
            leads.isOwn.mockResolvedValue(false)

            await expect(contracts.attachLead("ws-1", "contract-1", "lead-9")).resolves.toBeUndefined()
            expect(attach?.callsOf("execute")).toEqual([])
        })
    })

    describe("list", () => {
        it("lists the workspace contracts after proving membership", async () => {
            const em = mockEntityManager({ find: [ContractEntity, [ROW, rowOf({ id: "contract-2", leadId: null })]] })
            const { contracts, members } = await build(em)

            await expect(contracts.list("ws-1", "user-1")).resolves.toEqual([
                {
                    id: "contract-1",
                    leadId: "lead-1",
                    customerName: "Anh Minh",
                    plan: "Monthly",
                    startsOn: "2026-10-01",
                    endsOn: "2027-09-30",
                    amountVnd: 5_000_000,
                    status: "active",
                    note: "",
                },
                {
                    id: "contract-2",
                    leadId: null,
                    customerName: "Anh Minh",
                    plan: "Monthly",
                    startsOn: "2026-10-01",
                    endsOn: "2027-09-30",
                    amountVnd: 5_000_000,
                    status: "active",
                    note: "",
                },
            ])
            expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
            expect(namedCalls(em.find.mock.calls)).toEqual([
                ["ContractEntity", { where: { workspaceId: "ws-1" }, order: { endsOn: "ASC", id: "ASC" }, take: 300 }],
            ])
        })
    })
})

const CURRENT = rowOf({ startsOn: "2026-01-01", endsOn: "2027-01-01", note: "VIP" })
const RENEWED = { ...CURRENT, startsOn: "2027-01-01", endsOn: "2028-01-01", note: "VIP\ncontracts.renewalNote" }
const RESULT_2028 = {
    id: "contract-1",
    leadId: "lead-1",
    customerName: "Anh Minh",
    plan: "Monthly",
    startsOn: "2027-01-01",
    endsOn: "2028-01-01",
    amountVnd: 5_000_000,
    status: "active",
    note: "VIP\ncontracts.renewalNote",
}

describe("ContractsService", () => {
    describe("extendForPaidRenewal", () => {
        it("renews inside the manager of the caller's transaction without opening one", async () => {
            const own = mockEntityManager()
            const callers = mockEntityManager()
            queueQueryBuilders(callers, [{ getOne: CURRENT }, { execute: { raw: [RENEWED] } }])
            const { contracts } = await build(own)

            await expect(
                contracts.extendForPaidRenewal("ws-1", "contract-1", "2027-01-01", "INV-202612-0001", callers),
            ).resolves.toMatchObject({ extended: true, previousEndsOn: "2027-01-01" })

            expect(own.transaction).not.toHaveBeenCalled()
            expect(callers.transaction).not.toHaveBeenCalled()
        })

        it("moves a contract still ending on the paid period to its next term and logs it in the same transaction", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const [lock, extend] = queueQueryBuilders(tx.em, [{ getOne: CURRENT }, { execute: { raw: [RENEWED] } }])
            const { contracts, events, members } = await build(tx.em)

            await expect(
                contracts.extendForPaidRenewal("ws-1", "contract-1", "2027-01-01", "INV-202612-0001"),
            ).resolves.toEqual({
                extended: true,
                previousEndsOn: "2027-01-01",
                contract: RESULT_2028,
            })

            expect(lock?.callsOf("setLock")).toEqual([["pessimistic_write"]])
            expect(lock?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", contractId: "contract-1" })
            expect(extend?.callsOf("where")[0]?.[1]).toEqual({
                workspaceId: "ws-1",
                contractId: "contract-1",
                periodEndsOn: "2027-01-01",
            })
            expect(evaluatedValues(extend?.callsOf("set")[0]?.[0])).toEqual({
                startsOn: "2027-01-01",
                endsOn: "2028-01-01",
                status: "active",
                note: 'VIP\ncontracts.renewalNote:{"until":"01/01/2028","no":"INV-202612-0001"}',
                updatedAt: "now()",
            })
            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    leadId: "lead-1",
                    kind: "contract.updated",
                    actor: "NIVO",
                    summary: 'contracts.renewed:{"customer":"Anh Minh","until":"01/01/2028","no":"INV-202612-0001"}',
                    evidence: "2027-01-01 → 2028-01-01",
                },
                expect.anything(),
            )
            expect(isTransactionManager(events.record.mock.calls[0]?.[1])).toBe(true)
            expect(members.require).not.toHaveBeenCalled()
        })
    })
})

describe("ContractsService", () => {
    describe("extendForPaidRenewal", () => {
        it("re-activates an ended contract", async () => {
            const tx = fakeTransaction(mockEntityManager())
            queueQueryBuilders(tx.em, [{ getOne: { ...CURRENT, status: "ended" } }, { execute: { raw: [RENEWED] } }])
            const { contracts } = await build(tx.em)

            await expect(
                contracts.extendForPaidRenewal("ws-1", "contract-1", "2027-01-01", "INV-1"),
            ).resolves.toMatchObject({ extended: true, contract: { status: "active" } })
        })

        it.each([
            ["the contract moved to another term", { endsOn: "2028-01-01" }, "2028-01-01"],
            ["the contract was cancelled", { status: "cancelled" }, "2027-01-01"],
        ])("changes nothing when %s", async (_name, change, previousEndsOn) => {
            const tx = fakeTransaction(mockEntityManager())
            queueQueryBuilders(tx.em, [{ getOne: { ...CURRENT, ...change } }])
            const { contracts, events } = await build(tx.em)

            await expect(
                contracts.extendForPaidRenewal("ws-1", "contract-1", "2027-01-01", "INV-1"),
            ).resolves.toMatchObject({ extended: false, previousEndsOn })

            expect(tx.em.createQueryBuilder).toHaveBeenCalledTimes(1)
            expect(events.record).not.toHaveBeenCalled()
        })

        it("changes nothing when the guarded write finds the term already moved", async () => {
            const tx = fakeTransaction(mockEntityManager())
            queueQueryBuilders(tx.em, [{ getOne: CURRENT }, { execute: { raw: [] } }])
            const { contracts, events } = await build(tx.em)

            await expect(
                contracts.extendForPaidRenewal("ws-1", "contract-1", "2027-01-01", "INV-1"),
            ).resolves.toMatchObject({ extended: false, contract: { endsOn: "2027-01-01" } })
            expect(events.record).not.toHaveBeenCalled()
        })

        it("refuses a contract the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager())
            queueQueryBuilders(tx.em, [{ getOne: null }])
            const { contracts } = await build(tx.em)

            await expect(
                contracts.extendForPaidRenewal("ws-1", "contract-9", "2027-01-01", "INV-1"),
            ).rejects.toMatchObject({ code: ContractsErrorCode.NotFound, params: { id: "contract-9" } })
        })
    })
})

describe("ContractsService", () => {
    describe("linkCustomers", () => {
        it("links the contracts on the system's behalf without asking for a member", async () => {
            const { contracts, links, members } = await build(mockEntityManager())

            await expect(contracts.linkCustomers("ws-1")).resolves.toEqual({ linked: 1, created: 0, unmatched: [] })

            expect(links.linkCustomers).toHaveBeenCalledWith("ws-1")
            expect(members.require).not.toHaveBeenCalled()
        })

        it("proves the caller belongs to the workspace before linking for them", async () => {
            const { contracts, links, members } = await build(mockEntityManager())
            members.require.mockRejectedValueOnce(new Error("not a member"))

            await expect(contracts.linkCustomersFor("user-9", "ws-1")).rejects.toThrow("not a member")
            expect(links.linkCustomers).not.toHaveBeenCalled()

            await expect(contracts.linkCustomersFor("user-1", "ws-1")).resolves.toMatchObject({ linked: 1 })
            expect(members.require).toHaveBeenLastCalledWith("user-1", "ws-1")
        })
    })
})
