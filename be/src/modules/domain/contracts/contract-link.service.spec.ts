import { ConnectionEntity } from "@modules/domain/connections"
import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ContractLinkService } from "./contract-link.service"
import type { ContractLinkRead, CustomerRecordRead } from "./contract-link.policy"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import type { TableQuery } from "@tests/fixtures/builders/table-query-builder.builder"
import { expressionValues } from "@tests/fixtures/builders/sql-expression.builder"

/** The statement `advisoryXactLock` sends. */
const LOCK_CONTRACT_LINKING = "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))"

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const leads = mock<LeadRecordsService>()
    const conversations = mock<AgentConversationsService>()
    conversations.latestOfLead.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContractLinkService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LeadRecordsService, useValue: leads },
            { provide: AgentConversationsService, useValue: conversations },
        ],
    }).compile()
    return { links: moduleRef.get(ContractLinkService), leads, conversations }
}

const PHONE = "84786346888"

const contractOf = builder<ContractLinkRead>({
    id: "contract-1",
    leadId: null,
    customerName: "H\u00e0 Trung L\u01b0u",
    plan: "Hosting",
    note: "KETOANNGANVIET-HOST \u00b7 Tino",
    leadPhone: null,
    leadEmail: null,
})

const RECORD: CustomerRecordRead = {
    externalId: "HTL-250728",
    title: "H\u00c0 TRUNG L\u01afU",
    data: {
        "T\u00ean kh\u00e1ch h\u00e0ng": "H\u00c0 TRUNG L\u01afU",
        SDT: "0786346888",
        "M\u00e3 kh\u00e1ch h\u00e0ng": "HTL-250728",
    },
    source: "Kh\u00e1ch h\u00e0ng NIVO 2026",
}

const leadRowOf = builder<LeadRecordRow>({
    id: "lead-9",
    workspace_id: "ws-1",
    contact_name: "H\u00c0 TRUNG L\u01afU",
    company: "\u2014",
    channel: "Kh\u00e1ch h\u00e0ng NIVO 2026",
    need: "Gia h\u1ea1n Hosting",
    stage: "qualified",
    context_summary: null,
    phone: PHONE,
    email: null,
})

/** A link run whose reads answer the contracts and the customer record, and whose n-th relink answers the n-th rows given. */
const linkRunOf = (
    record: CustomerRecordRead,
    contracts: ReadonlyArray<ContractLinkRead>,
    ...relinks: ReadonlyArray<ReadonlyArray<unknown>>
) => {
    const tx = fakeTransaction(mockEntityManager({ query: [LOCK_CONTRACT_LINKING, []] }))
    let relinked = 0
    const seen = answerByTable(tx.em, {
        "": (query: TableQuery) => {
            if (query.callsOf("leftJoin").some(([target]) => target === ConnectionEntity)) return [record]
            return query.callsOf("update").length > 0 ? (relinks[relinked++] ?? []) : contracts
        },
    })
    const relinkQueries = () => seen.queries.filter((query) => query.callsOf("update").length > 0)
    return {
        tx,
        relinkWheres: () => relinkQueries().map((query) => query.callsOf("where")[0]?.[1]),
        relinkSets: () => relinkQueries().map((query) => expressionValues(query.callsOf("set")[0]?.[0])),
    }
}

const linkRun = (contracts: ReadonlyArray<ContractLinkRead>, ...relinks: ReadonlyArray<ReadonlyArray<unknown>>) =>
    linkRunOf(RECORD, contracts, ...relinks)

describe("ContractLinkService", () => {
    describe("linkCustomers", () => {
        it("creates one lead for a new customer and links both of its contracts to it, never a second lead", async () => {
            const { tx, relinkWheres } = linkRun(
                [contractOf(), contractOf({ id: "contract-2", customerName: "HA TRUNG LUU" })],
                [{ id: "contract-1" }],
                [{ id: "contract-2" }],
            )
            const { links, leads } = await build(tx.em)
            leads.matchAllByContact.mockResolvedValueOnce([]).mockResolvedValueOnce([leadRowOf()])
            leads.capture.mockResolvedValue(leadRowOf())

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({ linked: 2, created: 1, unmatched: [] })

            expect(leads.capture).toHaveBeenCalledTimes(1)
            expect(leads.capture).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    contactName: "H\u00c0 TRUNG L\u01afU",
                    company: "\u2014",
                    channel: "Kh\u00e1ch h\u00e0ng NIVO 2026",
                    need: 'contracts.linkNeed:{"plan":"Hosting"}',
                    phone: PHONE,
                    email: null,
                },
                expect.anything(),
            )
            expect(leads.classify).toHaveBeenCalledWith(
                { workspaceId: "ws-1", leadId: "lead-9", stage: "qualified", contextSummary: null },
                expect.anything(),
            )
            expect(isTransactionManager(leads.capture.mock.calls[0]?.[1])).toBe(true)
            expect(relinkWheres()).toEqual([
                { workspaceId: "ws-1", contractId: "contract-1", readLeadId: null, leadId: "lead-9" },
                { workspaceId: "ws-1", contractId: "contract-2", readLeadId: null, leadId: "lead-9" },
            ])
            expect(tx.commits).toBe(1)
        })

        it("opens a lead named after a company customer that has no source, on the default channel", async () => {
            const company: CustomerRecordRead = {
                ...RECORD,
                source: null,
                data: { ...RECORD.data, "Khách hàng": "Công ty" },
            }
            const { tx, relinkSets } = linkRunOf(company, [contractOf()], [{ id: "contract-1" }])
            const { links, leads } = await build(tx.em)
            leads.matchAllByContact.mockResolvedValue([])
            leads.capture.mockResolvedValue(leadRowOf())

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({ linked: 1, created: 1, unmatched: [] })

            expect(leads.capture).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    contactName: "HÀ TRUNG LƯU",
                    company: "HÀ TRUNG LƯU",
                    channel: "contracts.linkChannel:{}",
                    need: 'contracts.linkNeed:{"plan":"Hosting"}',
                    phone: PHONE,
                    email: null,
                },
                expect.anything(),
            )
            expect(relinkSets()).toEqual([{ leadId: "lead-9", updatedAt: "now()" }])
        })

        it("changes nothing on a repeat: the contract already links to the lead holding the phone", async () => {
            const { tx, relinkWheres } = linkRun([contractOf({ leadId: "lead-9", leadPhone: PHONE })])
            const { links, leads } = await build(tx.em)
            leads.matchAllByContact.mockResolvedValue([leadRowOf()])

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({ linked: 0, created: 0, unmatched: [] })

            expect(leads.capture).not.toHaveBeenCalled()
            expect(leads.fillContact).not.toHaveBeenCalled()
            expect(relinkWheres()).toEqual([])
        })
    })
})

describe("ContractLinkService", () => {
    describe("linkCustomers, the lead it picks", () => {
        it("moves the contract to the lead a customer conversation reaches, so the renewal finds the chat", async () => {
            const { tx, relinkWheres } = linkRun([contractOf({ leadId: "lead-own" })], [{ id: "contract-1" }])
            const { links, leads, conversations } = await build(tx.em)
            leads.matchAllByContact.mockResolvedValue([leadRowOf({ id: "lead-zalo" })])
            conversations.latestOfLead.mockImplementation((_workspace, leadId) =>
                Promise.resolve(
                    leadId === "lead-zalo"
                        ? { id: "conv-1", agentId: "agent-1", channel: "zalo", visitorName: "L\u01b0u" }
                        : null,
                ),
            )

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({ linked: 1, created: 0, unmatched: [] })

            expect(relinkWheres()).toEqual([
                { workspaceId: "ws-1", contractId: "contract-1", readLeadId: "lead-own", leadId: "lead-zalo" },
            ])
            expect(leads.fillContact).toHaveBeenCalledWith(
                { workspaceId: "ws-1", phone: PHONE, email: null, leadId: "lead-zalo" },
                expect.anything(),
            )
            expect(leads.capture).not.toHaveBeenCalled()
        })
    })
})

describe("ContractLinkService", () => {
    describe("linkCustomers, the edges", () => {
        it("gives the contract's own lead the phone when no lead holds it", async () => {
            const { tx } = linkRun([contractOf({ leadId: "lead-own" })])
            const { links, leads } = await build(tx.em)
            leads.matchAllByContact.mockResolvedValue([])

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({ linked: 1, created: 0, unmatched: [] })

            expect(leads.fillContact).toHaveBeenCalledWith(
                { workspaceId: "ws-1", phone: PHONE, email: null, leadId: "lead-own" },
                expect.anything(),
            )
        })

        it("reports the contracts it cannot reach and leaves alone one whose lead already has a contact", async () => {
            const { tx } = linkRun([
                contractOf({ id: "contract-x", customerName: "Ch\u01b0a x\u00e1c \u0111\u1ecbnh kh\u00e1ch" }),
                contractOf({
                    id: "contract-y",
                    customerName: "Kh\u00e1ch kh\u00e1c",
                    leadId: "lead-2",
                    leadEmail: "k@x.vn",
                }),
            ])
            const { links, leads } = await build(tx.em)

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({
                linked: 0,
                created: 0,
                unmatched: [
                    {
                        contractId: "contract-x",
                        customerName: "Ch\u01b0a x\u00e1c \u0111\u1ecbnh kh\u00e1ch",
                        reason: "noCustomer",
                    },
                ],
            })

            expect(leads.matchAllByContact).not.toHaveBeenCalled()
        })

        it("counts nothing when another run moved the contract first", async () => {
            const { tx } = linkRun([contractOf()], [])
            const { links, leads } = await build(tx.em)
            leads.matchAllByContact.mockResolvedValue([leadRowOf()])

            await expect(links.linkCustomers("ws-1")).resolves.toEqual({ linked: 0, created: 0, unmatched: [] })

            expect(leads.fillContact).not.toHaveBeenCalled()
        })
    })
})
