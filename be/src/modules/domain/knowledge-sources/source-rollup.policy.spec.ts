import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { SourceSummary } from "./knowledge-sources.contracts"
import { withPartsRolledUp } from "./source-rollup.policy"

const summaryOf = builder<SourceSummary>({
    id: "s1",
    workspaceId: "w1",
    module: null,
    installationId: null,
    kind: "file",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "Plan (1/2)",
    status: "ready",
    error: null,
    chunkCount: 10,
    sizeBytes: 1000,
    progress: 100,
    stage: null,
    stageDone: null,
    stageTotal: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    partCount: 1,
})

const SUBJECT = Symbol("source-rollup.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { withPartsRolledUp } }],
    }).compile()
    return moduleRef.get<{ withPartsRolledUp: typeof withPartsRolledUp }>(SUBJECT)
}

describe("withPartsRolledUp", () => {
    it("lists a document cut into parts as one row: the whole title, the totals summed and the number of parts", async () => {
        const subject = await build()

        const rows = subject.withPartsRolledUp([
            { summary: summaryOf(), origin: null },
            {
                summary: summaryOf({
                    id: "s2",
                    title: "Plan (2/2)",
                    chunkCount: 4,
                    sizeBytes: 500,
                    updatedAt: "2026-10-02T00:00:00.000Z",
                }),
                origin: "part:s1",
            },
        ])

        expect(rows).toEqual([
            summaryOf({
                title: "Plan",
                chunkCount: 14,
                sizeBytes: 1500,
                updatedAt: "2026-10-02T00:00:00.000Z",
                partCount: 2,
            }),
        ])
    })

    it("shows the state of the part that most needs attention: a failed or unfinished part is not hidden by a ready first part", async () => {
        const subject = await build()
        const first = { summary: summaryOf(), origin: null }

        const failed = subject.withPartsRolledUp([
            first,
            { summary: summaryOf({ id: "s2", status: "failed", error: "KNOWLEDGE_NOTE_EMPTY" }), origin: "part:s1" },
        ])
        const busy = subject.withPartsRolledUp([
            first,
            { summary: summaryOf({ id: "s2", status: "indexing", stage: "embed", progress: 40 }), origin: "part:s1" },
        ])

        expect(failed[0]).toMatchObject({ status: "failed", error: "KNOWLEDGE_NOTE_EMPTY", partCount: 2 })
        expect(busy[0]).toMatchObject({ status: "indexing", stage: "embed", progress: 40, partCount: 2 })
    })

    it("keeps a part whose first part is not in the listing as a row of its own, and leaves plain sources alone", async () => {
        const subject = await build()
        const alone = { summary: summaryOf({ id: "s9", title: "Menu" }), origin: null }
        const orphan = { summary: summaryOf({ id: "s3", title: "Old (2/2)" }), origin: "part:gone" }

        expect(subject.withPartsRolledUp([alone, orphan])).toEqual([alone.summary, orphan.summary])
    })
})
