import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG, REQUEST_LOCALE } from "@modules/platform/i18n"
import type { MessageCatalog, RequestLocale } from "@modules/platform/i18n"
import type { SaveContractParams } from "./contracts.contracts"
import { ContractsService } from "./contracts.service"
import { ContractsErrorCode } from "./errors/contracts.error"
import { ATTACH_CONTRACT_LEAD, INSERT_CONTRACT, UPDATE_CONTRACT } from "./persistence/contracts.sql"

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

const ROW = {
    id: "contract-1",
    lead_id: "lead-1",
    customer_name: "Anh Minh",
    plan: "Monthly",
    starts_on: "2026-10-01",
    ends_on: "2027-09-30",
    amount_vnd: 5_000_000,
    status: "active",
    note: "",
}

const FIELDS = ["lead-1", "Anh Minh", "Monthly", "2026-10-01", "2027-09-30", 5_000_000, "active", ""]

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
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContractsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: messages },
            { provide: REQUEST_LOCALE, useValue: requestLocale },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { members, contracts: moduleRef.get(ContractsService), events, requestLocale }
}

describe("ContractsService", () => {
    describe("saveContract", () => {
        it("adds a contract linked to a lead of the workspace and logs it in the same transaction", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_CONTRACT, [ROW]] }))
            const { contracts, events, requestLocale } = await build(tx.em)

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

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_CONTRACT, ["ws-1", ...FIELDS])
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
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_CONTRACT, [{ ...ROW, lead_id: null }]] }))
            const { contracts, events } = await build(tx.em)

            await expect(
                contracts.saveContract(paramsOf({ contractId: "contract-1", leadId: null })),
            ).resolves.toMatchObject({ id: "contract-1", leadId: null })

            expect(tx.em.query).toHaveBeenCalledWith(UPDATE_CONTRACT, ["ws-1", "contract-1", null, ...FIELDS.slice(1)])
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

        it("refuses a contract that fails the policy and writes nothing", async () => {
            const tx = fakeTransaction(mockEntityManager())
            const { contracts, events } = await build(tx.em)

            await expect(contracts.saveContract(paramsOf({ customerName: "  " }))).rejects.toMatchObject({
                code: ContractsErrorCode.CustomerRequired,
            })

            expect(tx.em.query).not.toHaveBeenCalled()
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

        it("refuses a lead the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_CONTRACT, []] }))
            const { contracts, events } = await build(tx.em)

            await expect(contracts.saveContract(paramsOf())).rejects.toMatchObject({
                code: ContractsErrorCode.LeadNotFound,
                params: { id: "lead-1" },
            })

            expect(events.record).not.toHaveBeenCalled()
        })

        it("refuses an edit of a contract the workspace does not have", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [UPDATE_CONTRACT, []] }))
            const { contracts } = await build(tx.em)

            await expect(
                contracts.saveContract(paramsOf({ contractId: "contract-9", leadId: null })),
            ).rejects.toMatchObject({ code: ContractsErrorCode.NotFound, params: { id: "contract-9" } })
        })
    })

    describe("attachLead", () => {
        it("links the lead to the workspace's contract on the system's behalf", async () => {
            const em = mockEntityManager({ query: [ATTACH_CONTRACT_LEAD, []] })
            const { contracts, members } = await build(em)

            await expect(contracts.attachLead("ws-1", "contract-1", "lead-9")).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(ATTACH_CONTRACT_LEAD, ["ws-1", "contract-1", "lead-9"])
            expect(members.require).not.toHaveBeenCalled()
        })
    })
})
