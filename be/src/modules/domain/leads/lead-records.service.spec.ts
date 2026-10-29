import { Test } from "@nestjs/testing"
import { Not } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder, QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LeadsErrorCode } from "./errors/leads.error"
import type { LeadRecord } from "./lead-records.contracts"
import { LeadRecordsService } from "./lead-records.service"
import { LeadEntity } from "./persistence/entities"

const ROW: LeadRecord = {
    id: "lead-1",
    workspace_id: "ws-1",
    contact_name: "An",
    company: "ACME",
    channel: "Zalo",
    need: "price",
    stage: "new",
    context_summary: null,
    phone: "84912000701",
    email: null,
}

const found = (row: LeadRecord | undefined): QueryBuilderAnswers => ({ getRawOne: row })
const written = (rows: ReadonlyArray<unknown> = []): QueryBuilderAnswers => ({ execute: { raw: rows } })

/** A service over a manager that hands out one query builder per statement, answering `answers` in order. */
const build = async (answers: ReadonlyArray<QueryBuilderAnswers> = [], em: MockEntityManager = mockEntityManager()) => {
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [LeadRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { records: moduleRef.get(LeadRecordsService), em, fakes }
}

/** The SQL text a `() => "..."` expression function returns, read from its source. */
const expressionText = (source: string): string => /"([^"]*)"/u.exec(source)?.[1] ?? source

/** What an update query builder was told to set; a function value is read as the SQL text it returns. */
const setBy = (fake: FakeQueryBuilder | undefined): Record<string, unknown> => {
    const [values] = fake?.callsOf("set")[0] ?? []
    const set = typeof values === "object" && values !== null ? values : {}
    return Object.fromEntries(
        Object.entries(set).map(([key, value]) => [
            key,
            typeof value === "function" ? expressionText(String(value)) : value,
        ]),
    )
}

describe("LeadRecordsService", () => {
    it("reads one lead of the workspace", async () => {
        const { records, fakes } = await build([found(ROW)])

        await expect(records.find("ws-1", "lead-1")).resolves.toEqual(ROW)
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.id = :leadId", { leadId: "lead-1" }]])
    })

    it("answers null when the lead is absent and refuses require", async () => {
        const { records } = await build([found(undefined), found(undefined)])

        await expect(records.find("ws-1", "missing")).resolves.toBeNull()
        await expect(records.require("ws-1", "missing")).rejects.toMatchObject({
            code: LeadsErrorCode.NotFound,
            params: { id: "missing" },
        })
    })

    it("matches a customer by phone and treats a blank name as no name", async () => {
        const { records, fakes } = await build([found(ROW)])

        await expect(
            records.match({
                workspaceId: "ws-1",
                phone: "84912000701",
                email: null,
                name: "  ",
                channel: "Zalo",
            }),
        ).resolves.toEqual(ROW)

        expect(fakes[0]?.callsOf("andWhere")).toEqual([["(l.phone = :phone)"]])
        expect(fakes[0]?.callsOf("setParameters")).toEqual([
            [{ phone: "84912000701", email: null, name: "", channel: "Zalo" }],
        ])
    })

    it("captures a customer and answers the inserted row", async () => {
        const { records, fakes } = await build([written([ROW])])

        await expect(
            records.capture({
                workspaceId: "ws-1",
                contactName: "An",
                company: "ACME",
                channel: "Zalo",
                need: "price",
                phone: "84912000701",
                email: null,
            }),
        ).resolves.toEqual(ROW)

        expect(fakes[0]?.callsOf("insert")).toEqual([[]])
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    contactName: "An",
                    company: "ACME",
                    channel: "Zalo",
                    need: "price",
                    phone: "84912000701",
                    email: null,
                },
            ],
        ])
        expect(fakes[0]?.callsOf("returning")[0]?.[0]).toContain("context_summary")
    })
})

describe("LeadRecordsService hand over", () => {
    it("hands over the package as the lead's need", async () => {
        const { records, fakes } = await build([written()])
        const need = "Annual sales package"

        await expect(records.handOver("ws-1", "lead-1", need)).resolves.toBeUndefined()

        expect(setBy(fakes[0])).toEqual({ need, contextSummary: "COALESCE(context_summary, CAST(:need AS text))" })
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["need", need]])
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["workspace_id = :workspaceId AND id = :leadId", { workspaceId: "ws-1", leadId: "lead-1" }],
        ])
    })
})

describe("LeadRecordsService matching", () => {
    it("answers no names when no leads were asked for", async () => {
        const { records, em } = await build()

        await expect(records.namesOf("ws-1", [])).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("requires an existing lead from the requested workspace", async () => {
        const { records, fakes } = await build([found(ROW)])

        await expect(records.require("ws-1", "lead-1")).resolves.toEqual(ROW)

        expect(fakes[0]?.callsOf("where")).toEqual([["l.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([["l.id = :leadId", { leadId: "lead-1" }]])
    })

    it("matches a trimmed customer name", async () => {
        const { records, fakes } = await build([found(ROW)])

        await expect(
            records.match({
                workspaceId: "ws-1",
                phone: null,
                email: null,
                name: "  An  ",
                channel: "Zalo",
            }),
        ).resolves.toEqual(ROW)

        expect(fakes[0]?.callsOf("andWhere")).toEqual([["((l.contact_name = :name AND l.channel = :channel))"]])
        expect(fakes[0]?.callsOf("setParameters")).toEqual([
            [{ phone: null, email: null, name: "An", channel: "Zalo" }],
        ])
    })

    it("matches by email and prefers the phone match when both are given", async () => {
        const { records, fakes } = await build([found(ROW)])

        await records.match({
            workspaceId: "ws-1",
            phone: "84912000701",
            email: "an@acme.vn",
            name: null,
            channel: null,
        })

        expect(fakes[0]?.callsOf("andWhere")).toEqual([["(l.phone = :phone OR l.email = :email)"]])
        expect(String(fakes[0]?.callsOf("orderBy")[0]?.[0])).toContain("WHEN l.phone = CAST(:phone AS text) THEN 0")
        expect(fakes[0]?.callsOf("addOrderBy")).toEqual([["l.created_at", "ASC"]])
    })

    it("answers null for an unmatched input without a customer name and asks nothing", async () => {
        const { records, em } = await build()

        await expect(
            records.match({ workspaceId: "ws-1", phone: null, email: null, name: null, channel: null }),
        ).resolves.toBeNull()

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a capture that did not insert a row", async () => {
        const { records, fakes } = await build([written()])

        await expect(
            records.capture({
                workspaceId: "ws-1",
                contactName: "An",
                company: "ACME",
                channel: "Zalo",
                need: "price",
                phone: null,
                email: "an@example.test",
            }),
        ).rejects.toMatchObject({ code: LeadsErrorCode.NotFound, params: { id: "new" } })

        expect(fakes[0]?.callsOf("values")[0]?.[0]).toMatchObject({ phone: null, email: "an@example.test" })
    })
})

describe("LeadRecordsService writes", () => {
    it("writes the supplied missing contact and classification values", async () => {
        const { records, fakes } = await build([written(), written()])

        await expect(
            records.fillContact({ workspaceId: "ws-1", leadId: "lead-1", phone: null, email: "an@example.test" }),
        ).resolves.toBeUndefined()
        await expect(
            records.classify({
                workspaceId: "ws-1",
                leadId: "lead-1",
                stage: "qualified",
                contextSummary: "Needs menu",
            }),
        ).resolves.toBeUndefined()

        expect(setBy(fakes[0])).toEqual({
            phone: "COALESCE(phone, CAST(:phone AS text))",
            email: "COALESCE(email, CAST(:email AS text))",
        })
        expect(fakes[0]?.callsOf("setParameters")).toEqual([[{ phone: null, email: "an@example.test" }]])
        expect(String(setBy(fakes[1]).stage)).toContain("CASE WHEN stage IN ('won', 'lost')")
        expect(fakes[1]?.callsOf("setParameters")).toEqual([[{ stage: "qualified", summary: "Needs menu" }]])
    })

    it("replaces context through the default manager", async () => {
        const em = mockEntityManager({ update: [LeadEntity, {}] })
        const { records } = await build([], em)

        await expect(records.replaceContext("ws-1", "lead-1", "Refreshed context")).resolves.toBeUndefined()

        expect(em.update).toHaveBeenCalledWith(
            LeadEntity,
            { workspaceId: "ws-1", id: "lead-1" },
            { contextSummary: "Refreshed context" },
        )
    })

    it("replaces context through a supplied transaction manager", async () => {
        const { records, em } = await build()
        const manager = mockEntityManager({ update: [LeadEntity, {}] })

        await expect(records.replaceContext("ws-1", "lead-1", "Transaction context", manager)).resolves.toBeUndefined()

        expect(manager.update).toHaveBeenCalledWith(
            LeadEntity,
            { workspaceId: "ws-1", id: "lead-1" },
            { contextSummary: "Transaction context" },
        )
        expect(em.update).not.toHaveBeenCalled()
    })

    it("marks a won lead through the manager of the caller's transaction", async () => {
        const em = mockEntityManager()
        const callers = mockEntityManager({ update: [LeadEntity, {}] })
        const { records } = await build([], em)

        await expect(records.markWon("ws-1", "lead-1", callers)).resolves.toBeUndefined()

        expect(callers.update).toHaveBeenCalledTimes(1)
        expect(em.update).not.toHaveBeenCalled()
    })

    it("marks a won lead unless it was lost, and reads the requested lead names", async () => {
        const em = mockEntityManager({ update: [LeadEntity, {}] })
        const { records, fakes } = await build([{ getRawMany: [{ id: "lead-1", contact_name: "An" }] }], em)

        await expect(records.markWon("ws-1", "lead-1")).resolves.toBeUndefined()
        await expect(records.namesOf("ws-1", ["lead-1"])).resolves.toEqual([{ id: "lead-1", contact_name: "An" }])

        expect(em.update).toHaveBeenCalledWith(
            LeadEntity,
            { workspaceId: "ws-1", id: "lead-1", stage: Not("lost") },
            { stage: "won" },
        )
        expect(fakes[0]?.callsOf("where")).toEqual([
            ["l.workspaceId = :workspaceId AND l.id = ANY(:leadIds)", { workspaceId: "ws-1", leadIds: ["lead-1"] }],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[200]])
    })
})

describe("LeadRecordsService public API transaction", () => {
    it("uses the supplied manager when finding and matching a customer", async () => {
        const manager = mockEntityManager()
        queueQueryBuilders(manager, [found(ROW), found(ROW)])
        const { records, em } = await build()
        const match = { workspaceId: "ws-1", phone: "84912000701", email: null, name: "An", channel: "Zalo" }

        await expect(records.find("ws-1", "lead-1", manager)).resolves.toEqual(ROW)
        await expect(records.match(match, manager)).resolves.toEqual(ROW)

        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(2)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it.each([null, "Updated need"])(
        "passes a supplied need or preservation marker through the transaction: %s",
        async (need) => {
            const { records, em } = await build()
            const manager = mockEntityManager()
            const [patch] = queueQueryBuilders(manager, [written()])

            await expect(
                records.patchPublicFacts(
                    { workspaceId: "ws-1", leadId: "lead-1", company: "New company", need },
                    manager,
                ),
            ).resolves.toBeUndefined()

            expect(patch?.callsOf("setParameters")).toEqual([[{ company: "New company", need }]])
            expect(setBy(patch)).toEqual({
                company: "COALESCE(NULLIF(CAST(:company AS text), ''), company)",
                need: "COALESCE(NULLIF(CAST(:need AS text), ''), need)",
            })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        },
    )

    it.each([
        [[ROW], ROW],
        [[], null],
    ] as const)("returns the changed stage row or no change from the transaction: %j", async (rows, expected) => {
        const { records, em } = await build()
        const manager = mockEntityManager()
        const [stage] = queueQueryBuilders(manager, [written(rows)])

        await expect(records.applyPublicStage("ws-1", "lead-1", "won", manager)).resolves.toEqual(expected)

        expect(stage?.callsOf("setParameter")).toEqual([["stage", "won"]])
        expect(stage?.callsOf("returning")[0]?.[0]).toContain("context_summary")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("LeadRecordsService for the contract link", () => {
    it("answers every lead holding the phone or the email", async () => {
        const { records, fakes } = await build([{ getRawMany: [ROW] }])

        await expect(records.matchAllByContact("ws-1", { phone: "84912000701", email: "an@acme.vn" })).resolves.toEqual(
            [ROW],
        )

        expect(fakes[0]?.callsOf("andWhere")).toEqual([["(l.phone = :phone OR l.email = :email)"]])
        expect(fakes[0]?.callsOf("setParameters")).toEqual([[{ phone: "84912000701", email: "an@acme.vn" }]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[20]])
    })

    it("answers no lead for a customer without a contact and asks nothing", async () => {
        const { records, em } = await build()

        await expect(records.matchAllByContact("ws-1", { phone: null, email: null })).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("captures, classifies and fills a customer in the caller's transaction", async () => {
        const { records, em } = await build()
        const caller = mockEntityManager()
        queueQueryBuilders(caller, [written([ROW]), written(), written()])
        const lead = { workspaceId: "ws-1", contactName: "An", company: "ACME", channel: "Zalo", need: "price" }

        await records.capture({ ...lead, phone: "84912000701", email: null }, caller)
        await records.classify(
            { workspaceId: "ws-1", leadId: "lead-1", stage: "qualified", contextSummary: null },
            caller,
        )
        await records.fillContact({ workspaceId: "ws-1", leadId: "lead-1", phone: null, email: "an@acme.vn" }, caller)

        expect(caller.createQueryBuilder).toHaveBeenCalledTimes(3)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
