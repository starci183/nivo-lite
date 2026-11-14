import type { BrainExtractionEntity } from "@modules/domain/brain-extractions/persistence/entities"
import { entityRowBuilder } from "./entity-row.builder"

/** The workspace of the brain-extractions specs. */
export const EXTRACTIONS_WS = "11111111-1111-4111-8111-111111111111"

/** A stored reading of one document mid-way (window 2 of 5, 7 truths proposed), ready for overrides. */
export const extractionRowOf: (changes?: Partial<BrainExtractionEntity>) => BrainExtractionEntity = entityRowBuilder<BrainExtractionEntity>({
    sourceId: "s1",
    workspaceId: EXTRACTIONS_WS,
    status: "running",
    factsProposed: 7,
    error: null,
    model: null,
    promptVersion: 3,
    contentHash: "hash-1",
    windowsTotal: 5,
    windowsDone: 2,
    attempts: 1,
    orphanFactIds: ["f1", "f2"],
    passageHashes: ["h1"],
    factsChanged: false,
    stage: "extract",
    passagesTotal: 40,
    passagesTriaged: 40,
    passagesKept: 6,
    factsApplied: 0,
    factsAsked: 0,
    factsWaiting: 0,
    windowsSkipped: 0,
    linesRefused: 0,
    linesUnread: 0,
    answerNotes: [],
    documentNature: null,
    natureOverride: null,
    updatedAt: new Date("2026-10-13T02:00:00.000Z"),
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
})
