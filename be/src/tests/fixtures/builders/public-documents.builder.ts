import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { InsertResult } from "typeorm"
import type { SourceState } from "@modules/domain/knowledge-sources"
import type { PublicDocumentsService } from "@modules/domain/public-documents"
import { publicDocumentsEntities } from "@modules/domain/public-documents"
import { entityRowBuilder } from "./entity-row.builder"

const [PublicDocumentEntity, PublicDocumentSourceEntity, PublicDocumentApprovalEntity] = publicDocumentsEntities
type PublicDocumentEntity = InstanceType<typeof PublicDocumentEntity>
type PublicDocumentSourceEntity = InstanceType<typeof PublicDocumentSourceEntity>
type PublicDocumentApprovalEntity = InstanceType<typeof PublicDocumentApprovalEntity>

/** The workspace of the public-documents cases. */
export const WS = "11111111-1111-4111-8111-111111111111"

/** A draft NIVO wrote from one internal document, with every persisted column. */
export const documentRow = entityRowBuilder<PublicDocumentEntity>({
    id: "d1",
    workspaceId: WS,
    title: "Frequent questions",
    body: "Same day delivery.",
    publishedBody: null,
    publishedRevision: null,
    kind: "drafted",
    status: "draft",
    draftRevision: 0,
    question: null,
    gapId: null,
    instructions: null,
    leftOut: [],
    failureCode: null,
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    publishedSourceId: null,
    createdBy: "u1",
    createdAt: new Date("2026-11-01T01:00:00.000Z"),
    updatedAt: new Date("2026-11-01T02:00:00.000Z"),
})

/** The internal document `s1` a public document was drafted from, with every persisted column. */
export const documentSourceRow = entityRowBuilder<PublicDocumentSourceEntity>({
    documentId: "d1",
    sourceId: "s1",
    workspaceId: WS,
    sourceTitle: "Delivery policy",
    contentHash: "h1",
    createdAt: new Date("2026-11-01T01:00:00.000Z"),
    updatedAt: new Date("2026-11-01T01:00:00.000Z"),
})

/** A ready internal source and the current hash a document review reads. */
export const publicSourceState = builder<SourceState>({
    id: "s1",
    title: "Delivery policy",
    visibility: "internal",
    status: "ready",
    contentHash: "h1",
})

/** A valid draft request; individual refusal cases change just the invalid field. */
export const publicDraftRequestOf = builder<Parameters<PublicDocumentsService["requestDraft"]>[2]>({
    title: "Frequent questions",
    sourceIds: ["s1", "s1"],
    instructions: " Keep it short ",
})

/** Invalid draft data with the exact external refusal expected for it. */
export const PUBLIC_DRAFT_REFUSALS: Array<
    [string, Parameters<PublicDocumentsService["requestDraft"]>[2], Array<SourceState>, string]
> = [
    ["no title", { ...publicDraftRequestOf(), title: "" }, [publicSourceState()], "PUBLIC_DOCUMENTS_TITLE_REQUIRED"],
    [
        "no source",
        { ...publicDraftRequestOf(), sourceIds: [] },
        [publicSourceState()],
        "PUBLIC_DOCUMENTS_SOURCES_REQUIRED",
    ],
    [
        "too many sources",
        { ...publicDraftRequestOf(), sourceIds: ["1", "2", "3", "4", "5", "6"] },
        [publicSourceState()],
        "PUBLIC_DOCUMENTS_TOO_MANY_SOURCES",
    ],
    ["a source that is gone", publicDraftRequestOf(), [], "PUBLIC_DOCUMENTS_SOURCE_NOT_READY"],
    [
        "a public source",
        publicDraftRequestOf(),
        [publicSourceState({ visibility: "public" })],
        "PUBLIC_DOCUMENTS_SOURCE_NOT_READY",
    ],
    [
        "a source still being read",
        publicDraftRequestOf(),
        [publicSourceState({ status: "indexing" })],
        "PUBLIC_DOCUMENTS_SOURCE_NOT_READY",
    ],
    [
        "a source with no hash",
        publicDraftRequestOf(),
        [publicSourceState({ contentHash: null })],
        "PUBLIC_DOCUMENTS_SOURCE_NOT_READY",
    ],
]

/** An independent expected immutable approval, with the source state bound by the review. */
export const publicApprovalRow = builder<PublicDocumentApprovalEntity>({
    documentId: "d1",
    workspaceId: WS,
    draftRevision: 0,
    title: "Frequent questions",
    body: "Same day delivery.",
    draftSources: [{ sourceId: "s1", title: "Delivery policy", contentHash: "h1" }],
    reviewedSources: [{ sourceId: "s1", title: "Delivery policy", contentHash: "h1", current: publicSourceState() }],
    approvedBy: "u1",
    approvedByName: "Owner",
    approvedAt: new Date("2026-11-01T10:00:00.000Z"),
})

/** Data arranged for an atomic approval write; a published pointer also has its required immutable baseline. */
export const publicApprovalTransaction = (document: PublicDocumentEntity) => {
    if (document.publishedRevision === null)
        return fakeTransaction(
            mockEntityManager({
                insert: [PublicDocumentApprovalEntity, { identifiers: [] }],
                findOne: [PublicDocumentEntity, document],
                find: [PublicDocumentSourceEntity, [documentSourceRow()]],
                update: [
                    [PublicDocumentEntity, { affected: 1 }],
                    [PublicDocumentSourceEntity, { affected: 1 }],
                ],
            }),
        )
    const review = publicApprovalRow({
        documentId: document.id,
        workspaceId: document.workspaceId,
        draftRevision: document.publishedRevision,
    })
    return fakeTransaction(
        mockEntityManager({
            insert: [PublicDocumentApprovalEntity, { identifiers: [] }],
            findOne: [
                [PublicDocumentEntity, document],
                [PublicDocumentApprovalEntity, review],
            ],
            find: [
                [PublicDocumentSourceEntity, [documentSourceRow()]],
                [PublicDocumentApprovalEntity, [review]],
            ],
            update: [
                [PublicDocumentEntity, { affected: 1 }],
                [PublicDocumentSourceEntity, { affected: 1 }],
            ],
        }),
    )
}

/** Data arranged for creating one queued draft and its source references. */
export const draftRequestTransaction = (sources: ReadonlyArray<PublicDocumentSourceEntity> = [documentSourceRow()]) =>
    fakeTransaction(
        mockEntityManager({
            insert: [
                [PublicDocumentEntity, { identifiers: [{ id: "d1" }] }],
                [PublicDocumentSourceEntity, { identifiers: [] }],
            ],
            findOne: [PublicDocumentEntity, documentRow({ status: "drafting" })],
            find: [PublicDocumentSourceEntity, sources],
        }),
    )

/** A mutable TypeORM write answer, independent of the surrounding readonly entity-dispatch tuple. */
const insertResultOf = builder<InsertResult>({ identifiers: [], generatedMaps: [], raw: [] })

/** Data arranged for one hand-written draft and its readable row. */
export const writtenDocumentAnswers = () =>
    ({
        insert: [PublicDocumentEntity, insertResultOf({ identifiers: [{ id: "d1" }] })],
        findOne: [PublicDocumentEntity, documentRow({ kind: "written" })],
        find: [PublicDocumentSourceEntity, []],
    }) as const

/** Invalid hand-written text and its exact external refusal code. */
export const PUBLIC_WRITE_REFUSALS: Array<[string, Parameters<PublicDocumentsService["write"]>[2], string]> = [
    ["no title", { title: " ", body: "x" }, "PUBLIC_DOCUMENTS_TITLE_REQUIRED"],
    ["a text that is too long", { title: "T", body: "x".repeat(40_001) }, "PUBLIC_DOCUMENTS_BODY_TOO_LONG"],
]

/** Data arranged for an existing document being withdrawn, without an unrelated subject provider. */
export const publicArchiveTransaction = (document: PublicDocumentEntity) =>
    fakeTransaction(
        mockEntityManager({
            findOne: [PublicDocumentEntity, document],
            update: [PublicDocumentEntity, { affected: 1 }],
        }),
    )

/** Data arranged for the document list and its working source references. */
export const publicDocumentListAnswers = (document: PublicDocumentEntity) =>
    ({
        find: [
            [PublicDocumentEntity, [document]],
            [PublicDocumentSourceEntity, [documentSourceRow()]],
        ],
    }) as const

/** Data arranged for an editable document and the row returned after its metadata write. */
export const editablePublicDocumentAnswers = (document: PublicDocumentEntity) =>
    ({
        findOne: [PublicDocumentEntity, document],
        find: [PublicDocumentSourceEntity, []],
        update: [PublicDocumentEntity, { affected: 1 }],
    }) as const

/** Document states that cannot begin a fresh internal-source draft. */
export const PUBLIC_REDRAFT_REFUSALS: Array<[string, PublicDocumentEntity, Array<PublicDocumentSourceEntity>]> = [
    ["a document being drafted", documentRow({ status: "drafting" }), [documentSourceRow()]],
    ["an archived document", documentRow({ status: "archived" }), [documentSourceRow()]],
    ["a document with no internal source", documentRow({ kind: "written" }), []],
]

/** Exact persisted fields of the first public approval, independent of the production writer. */
export const publicPublishedChangeOf = builder<
    Pick<
        PublicDocumentEntity,
        | "status"
        | "publishedBody"
        | "publishedRevision"
        | "draftRevision"
        | "publishedSourceId"
        | "approvedBy"
        | "approvedByName"
        | "approvedAt"
        | "failureCode"
    >
>({
    status: "published",
    publishedBody: "Same day delivery.",
    publishedRevision: 0,
    draftRevision: 0,
    publishedSourceId: "d1",
    approvedBy: "u1",
    approvedByName: "Owner",
    approvedAt: new Date("2026-11-01T10:00:00.000Z"),
    failureCode: null,
})

/** The exact public text passed to its source owner. */
export const publicPublicationOf = builder<{ title: string; content: string }>({
    title: "Frequent questions",
    content: "Same day delivery.",
})

/** Source-review snapshot after explicit acknowledgement of h2, retaining h1 draft evidence. */
export const publicChangedReviewOf = () =>
    publicApprovalRow({
        draftRevision: 1,
        reviewedSources: [
            {
                sourceId: "s1",
                title: "Delivery policy",
                contentHash: "h2",
                current: publicSourceState({ contentHash: "h2" }),
            },
        ],
    })

/** A published document with an exact immutable revision and its original actor. */
export const publicReplayDocumentOf = () =>
    documentRow({
        status: "published",
        publishedBody: "Same day delivery.",
        publishedRevision: 0,
        approvedBy: "original-approver",
    })

/** Entity answers for a published revision whose required immutable audit has disappeared. */
export const publicMissingReviewAnswers = () =>
    ({
        findOne: [
            [PublicDocumentEntity, publicReplayDocumentOf()],
            [PublicDocumentApprovalEntity, null],
        ],
        find: [
            [PublicDocumentEntity, [publicReplayDocumentOf()]],
            [PublicDocumentSourceEntity, []],
            [PublicDocumentApprovalEntity, []],
        ],
    }) as const

/** Concurrent revision-fence answers; the caller's kit manager retains the actual typed update result. */
export const publicMutationAnswers = (document = documentRow()) =>
    ({
        findOne: [PublicDocumentEntity, document],
        find: [PublicDocumentSourceEntity, [documentSourceRow()]],
        update: [PublicDocumentEntity, { affected: 1 }],
    }) as const

/** Strict entity answers for a revision-fenced generation and its working provenance. */
export const publicDraftingAnswers = (
    document: PublicDocumentEntity,
    sources: ReadonlyArray<PublicDocumentSourceEntity>,
) =>
    ({
        findOne: [PublicDocumentEntity, document],
        find: [PublicDocumentSourceEntity, sources],
        update: [
            [PublicDocumentEntity, { affected: 1 }],
            [PublicDocumentSourceEntity, { affected: 1 }],
        ],
        insert: [PublicDocumentSourceEntity, insertResultOf()],
        delete: [
            [PublicDocumentEntity, { affected: 1 }],
            [PublicDocumentSourceEntity, { affected: 1 }],
        ],
    }) as const

/** The exact revision the approver saw; refusal cases change only its relevant field. */
export const publicReviewRequestOf = builder<Parameters<PublicDocumentsService["approve"]>[2]>({
    id: "d1",
    expectedDraftRevision: 0,
})

/** A previously published document whose approved text differs from its working draft. */
export const publicPublishedDocumentOf = () => documentRow({ status: "published", publishedBody: "x" })
