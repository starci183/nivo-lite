import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainFactRelationsService, BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiChatAnswer, AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { DocumentRelationsService } from "./document-relations.service"
import { ModelJsonService } from "./model-json.service"
import { RELATIONS_PROMPT, relationsPrompt } from "./relation-extraction.policy"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi-ship-noi-thanh",
    attributeLabel: "phi ship noi thanh",
    value: "30.000 d",
    valueNumber: null,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "proposed",
    sourceKind: "document",
    trust: 75,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Quy dinh giao hang.docx",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const FACTS = [
    factOf({ id: "ship" }),
    factOf({ id: "express", attributeLabel: "giao hoa toc", value: "noi thanh" }),
    factOf({ id: "pay", subjectLabel: "Thanh toan", attributeLabel: "cach", value: "chuyen khoan MB" }),
]

/** The scripted answer of the relation pass: no model is called in a spec. */
const SCRIPTED = {
    relations: [
        { from: 2, to: 1, kind: "part_of", label: "giao bang" },
        { from: 1, to: 2, kind: "related" },
        { from: 3, to: 3, kind: "related" },
        { from: 1, to: 9, kind: "related" },
        { from: 3, to: 1, kind: "owns" },
    ],
}

const build = async () => {
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const reads = mock<BrainFactsReadService>()
    const relations = mock<BrainFactRelationsService>()
    const usage = mock<UsageMeterService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentRelationsService,
            ModelJsonService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactRelationsService, useValue: relations },
            { provide: UsageMeterService, useValue: usage },
        ],
    }).compile()
    reads.ofSources.mockResolvedValue(FACTS)
    usage.blockedBy.mockResolvedValue(false)
    relations.linkMany.mockResolvedValue(1)
    return { service: moduleRef.get(DocumentRelationsService), ai, logger, reads, relations, usage }
}

const answer = (text: string): AiChatAnswer => ({
    text,
    model: "m1",
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.001 },
    parsed: null,
    retrieved: 0,
})

describe("DocumentRelationsService: the relation pass over the facts of one document (scripted model)", () => {
    it("asks once over the facts of the document, meters the call and links what the answer holds", async () => {
        const { service, ai, reads, relations, usage } = await build()
        ai.attempt.mockResolvedValue({ ok: true, answer: answer(JSON.stringify(SCRIPTED)) })

        await expect(service.link(docSourceOf())).resolves.toBe(1)

        expect(reads.ofSources).toHaveBeenCalledWith(DOC_WS, [DOC_SOURCE], ["proposed", "active"], 80)
        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(ai.attempt.mock.calls[0]?.[0].messages).toEqual([
            { role: "system", content: RELATIONS_PROMPT },
            { role: "user", content: relationsPrompt(FACTS) },
        ])
        expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: DOC_WS, kind: "brain" }))
        expect(relations.linkMany).toHaveBeenCalledWith(DOC_WS, [
            { fromFactId: "express", toFactId: "ship", kind: "part_of", label: "giao bang", createdBy: "NIVO" },
        ])
    })

    it("calls no model for a document with fewer than two facts, or without credits", async () => {
        const one = await build()
        one.reads.ofSources.mockResolvedValue([factOf()])
        await expect(one.service.link(docSourceOf())).resolves.toBe(0)
        expect(one.ai.attempt).not.toHaveBeenCalled()

        const broke = await build()
        broke.usage.blockedBy.mockResolvedValue(true)
        await expect(broke.service.link(docSourceOf())).resolves.toBe(0)
        expect(broke.ai.attempt).not.toHaveBeenCalled()
    })

    it("books a try cut at its cap with what it spent, once, and links nothing from it", async () => {
        const { service, ai, relations, usage } = await build()
        const spent = { promptTokens: 900, completionTokens: 3000, totalTokens: 3900, costUsd: null }
        ai.attempt.mockResolvedValue({
            ok: false,
            failure: "length",
            spent: {
                model: "claude-haiku-5-5",
                usage: spent,
                served: { upstream: null, finishReason: "max_tokens", durationMs: 1 },
                cap: 3000,
            },
        })

        await expect(service.link(docSourceOf())).resolves.toBe(0)

        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: DOC_WS,
                kind: "brain",
                model: "claude-haiku-5-5",
                usage: spent,
                completionChars: 0,
            }),
        )
        expect(relations.linkMany).not.toHaveBeenCalled()
    })

    it("logs a failure and answers 0: the facts stand without edges", async () => {
        const { service, ai, logger } = await build()
        const cause = new Error("down")
        ai.attempt.mockRejectedValue(cause)

        await expect(service.link(docSourceOf())).resolves.toBe(0)
        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.RelationsFailed, cause, { sourceId: DOC_SOURCE })
    })
})
