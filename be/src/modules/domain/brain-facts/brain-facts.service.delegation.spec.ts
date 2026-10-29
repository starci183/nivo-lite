import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { BrainFactEntity } from "./persistence/entities"

const build = async (reads: BrainFactsReadService, maintenance: BrainFactsMaintenanceService) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactsMaintenanceService, useValue: maintenance },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager({ find: [BrainFactEntity, []] }) },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsService)
}

const listed = [facts.factOf()]

describe("BrainFactsService reads and upkeep", () => {
    it("hands the list, the view and the search to the read service unchanged", async () => {
        const reads = mock<BrainFactsReadService>({
            list: jest.fn(() => Promise.resolve(listed)),
            forView: jest.fn(() => Promise.resolve(listed)),
            search: jest.fn(() => Promise.resolve(listed)),
        })
        const service = await build(reads, mock<BrainFactsMaintenanceService>())

        await expect(service.list(facts.WS, { status: "active" })).resolves.toBe(listed)
        await expect(service.forView(facts.WS, "customer", "chatbot", null, 5)).resolves.toBe(listed)
        await expect(service.search(facts.WS, "internal", "sales", "i1", "hours", 3)).resolves.toBe(listed)

        expect(reads.list).toHaveBeenCalledWith(facts.WS, { status: "active" })
        expect(reads.forView).toHaveBeenCalledWith(facts.WS, "customer", "chatbot", null, 5)
        expect(reads.search).toHaveBeenCalledWith(facts.WS, "internal", "sales", "i1", "hours", 3)
    })

    it("hands the withdrawal of a source and the maintenance to the maintenance service unchanged", async () => {
        const maintenance = mock<BrainFactsMaintenanceService>({
            withdrawSource: jest.fn(() => Promise.resolve(["orphan"])),
            maintain: jest.fn(() => Promise.resolve({ activated: listed, expired: 1 })),
        })
        const service = await build(mock<BrainFactsReadService>(), maintenance)

        await expect(service.withdrawSource(facts.WS, "doc-1", "Removed")).resolves.toEqual(["orphan"])
        await expect(service.maintain(facts.WS)).resolves.toEqual({ activated: listed, expired: 1 })

        expect(maintenance.withdrawSource).toHaveBeenCalledWith(facts.WS, "doc-1", "Removed")
        expect(maintenance.maintain).toHaveBeenCalledWith(facts.WS)
    })
})

describe("BrainFactsService facts without a number", () => {
    it("stores a proposal whose value is text with no number", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, []] })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [facts.rowOf({ valueNumber: null })] } }])
        const reads = new BrainFactsReadService(em)
        const service = new BrainFactsService(em, new FakeClock(facts.AT), reads, mock<BrainFactsMaintenanceService>())

        await service.propose(facts.WS, facts.inputOf({ value: "Open every day" }))

        expect(insert?.callsOf("values")[0]?.[0]).toMatchObject({ value: "Open every day", valueNumber: null })
    })

    it("files the retirement of an active fact whose value has no number", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, []] })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [facts.rowOf()] } }])
        const reads = new BrainFactsReadService(em)
        const service = new BrainFactsService(em, new FakeClock(facts.AT), reads, mock<BrainFactsMaintenanceService>())
        const active = facts.factOf({ status: "active", value: "Open every day", valueNumber: null })

        await expect(service.proposeRetire(facts.WS, active, facts.PROOF, "u2")).resolves.toBe(true)

        expect(insert?.callsOf("values")[0]?.[0]).toMatchObject({ value: "Open every day", valueNumber: null })
    })
})
