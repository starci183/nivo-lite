import {
    builder,
    fakeTransaction,
    mockEntityManager,
    type FakeTransaction,
    type MockEntityManager,
} from "@starci/jest-preset"
import type { InsertResult } from "typeorm"
import type { SourceDocument, SourceState } from "@modules/domain/knowledge-sources"
import {
    publicDocumentsEntities,
    type PublicDocumentsService,
    type PublicDocumentKind,
    type PublicDocumentStatus,
    type LeftOut,
    type PublicDocumentDraftRequest,
    type ApproveRequest,
} from "@modules/domain/public-documents"
import { entityRowBuilder } from "./entity-row.builder"

const PublicDocumentEntity: (typeof publicDocumentsEntities)[0] = publicDocumentsEntities[0]
const PublicDocumentSourceEntity: (typeof publicDocumentsEntities)[1] = publicDocumentsEntities[1]
const PublicDocumentApprovalEntity: (typeof publicDocumentsEntities)[2] = publicDocumentsEntities[2]
type PublicDocumentEntity = InstanceType<typeof PublicDocumentEntity>
type PublicDocumentSourceEntity = InstanceType<typeof PublicDocumentSourceEntity>
type PublicDocumentApprovalEntity = InstanceType<typeof PublicDocumentApprovalEntity>

/** The workspace of the public-documents cases. */
export const WS = "11111111-1111-4111-8111-111111111111"

type DocumentRowShape = {
    readonly workspaceId?: string
    readonly title?: string
    readonly body?: string
    readonly publishedBody?: string | null
    readonly publishedRevision?: number | null
    readonly kind?: PublicDocumentKind
    readonly status?: PublicDocumentStatus
    readonly draftRevision?: number
    readonly question?: string | null
    readonly gapId?: string | null
    readonly instructions?: string | null
    readonly leftOut?: Array<LeftOut>
    readonly failureCode?: string | null
    readonly approvedBy?: string | null
    readonly approvedByName?: string | null
    readonly approvedAt?: Date | null
    readonly publishedSourceId?: string | null
    readonly createdBy?: string | null
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** A draft NIVO wrote from one internal document, with every persisted column. */
export const documentRow: (changes?: DocumentRowShape) => PublicDocumentEntity = entityRowBuilder<PublicDocumentEntity>(
    {
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
    },
)

type DocumentSourceRowShape = {
    readonly documentId?: string
    readonly sourceId?: string
    readonly workspaceId?: string
    readonly sourceTitle?: string
    readonly contentHash?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** The public-area document `s1` a public document was drafted from, with every persisted column. */
export const documentSourceRow: (changes?: DocumentSourceRowShape) => PublicDocumentSourceEntity =
    entityRowBuilder<PublicDocumentSourceEntity>({
        documentId: "d1",
        sourceId: "s1",
        workspaceId: WS,
        sourceTitle: "Delivery policy",
        contentHash: "h1",
        createdAt: new Date("2026-11-01T01:00:00.000Z"),
        updatedAt: new Date("2026-11-01T01:00:00.000Z"),
    })

/** A ready source of the PUBLIC area (the only area a draft is written from) and the current hash a document review reads. */
export const publicSourceState: (overrides?: Partial<SourceState>) => SourceState = builder<SourceState>({
    id: "s1",
    title: "Delivery policy",
    visibility: "public",
    status: "ready",
    contentHash: "h1",
})

/** A ready document of the PUBLIC area of a bicycle workshop's Brain with its text, as a draft reads it (synthetic data). */
export const brainDocumentOf: (overrides?: Partial<SourceDocument>) => SourceDocument = builder<SourceDocument>({
    id: "s1",
    title: "Document s1",
    visibility: "public",
    status: "ready",
    contentHash: "h-s1",
    module: null,
    installationId: null,
    topic: null,
    content: "Flat tyre repair while you wait.",
})

/** A valid draft request; individual refusal cases change just the invalid field. */
export const publicDraftRequestOf: (overrides?: Partial<PublicDocumentDraftRequest>) => PublicDocumentDraftRequest =
    builder<Parameters<PublicDocumentsService["requestDraft"]>[2]>({
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
        "a source of the internal area",
        publicDraftRequestOf(),
        [publicSourceState({ visibility: "internal" })],
        "PUBLIC_DOCUMENTS_SOURCE_INTERNAL",
    ],
    [
        "a source whose area cannot be read",
        publicDraftRequestOf(),
        [publicSourceState({ visibility: "" })],
        "PUBLIC_DOCUMENTS_SOURCE_INTERNAL",
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
export const publicApprovalRow: (overrides?: Partial<PublicDocumentApprovalEntity>) => PublicDocumentApprovalEntity =
    builder<PublicDocumentApprovalEntity>({
        documentId: "d1",
        workspaceId: WS,
        draftRevision: 0,
        title: "Frequent questions",
        body: "Same day delivery.",
        draftSources: [{ sourceId: "s1", title: "Delivery policy", contentHash: "h1" }],
        reviewedSources: [
            { sourceId: "s1", title: "Delivery policy", contentHash: "h1", current: publicSourceState() },
        ],
        approvedBy: "u1",
        approvedByName: "Owner",
        approvedAt: new Date("2026-11-01T10:00:00.000Z"),
    })

/** Data arranged for an atomic approval write; a published pointer also has its required immutable baseline. */
export const publicApprovalTransaction = (document: PublicDocumentEntity): FakeTransaction<MockEntityManager> => {
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
export const draftRequestTransaction = (
    sources: ReadonlyArray<PublicDocumentSourceEntity> = [documentSourceRow()],
): FakeTransaction<MockEntityManager> =>
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

type WrittenDocumentAnswersResultShape = {
    readonly insert: readonly [typeof PublicDocumentEntity, InsertResult]
    readonly findOne: readonly [typeof PublicDocumentEntity, PublicDocumentEntity]
    readonly find: readonly [typeof PublicDocumentSourceEntity, readonly []]
}

/** Data arranged for one hand-written draft and its readable row. */
export const writtenDocumentAnswers = (): WrittenDocumentAnswersResultShape =>
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
export const publicArchiveTransaction = (document: PublicDocumentEntity): FakeTransaction<MockEntityManager> =>
    fakeTransaction(
        mockEntityManager({
            findOne: [PublicDocumentEntity, document],
            update: [PublicDocumentEntity, { affected: 1 }],
        }),
    )

type PublicDocumentListAnswersResultShape = {
    readonly find: readonly [
        readonly [typeof PublicDocumentEntity, readonly [PublicDocumentEntity]],
        readonly [typeof PublicDocumentSourceEntity, readonly [PublicDocumentSourceEntity]],
    ]
}

/** Data arranged for the document list and its working source references. */
export const publicDocumentListAnswers = (document: PublicDocumentEntity): PublicDocumentListAnswersResultShape =>
    ({
        find: [
            [PublicDocumentEntity, [document]],
            [PublicDocumentSourceEntity, [documentSourceRow()]],
        ],
    }) as const

type EditablePublicDocumentAnswersResultUpdateShape = { readonly affected: 1 }

type EditablePublicDocumentAnswersResultShape = {
    readonly findOne: readonly [typeof PublicDocumentEntity, PublicDocumentEntity]
    readonly find: readonly [typeof PublicDocumentSourceEntity, readonly []]
    readonly update: readonly [typeof PublicDocumentEntity, EditablePublicDocumentAnswersResultUpdateShape]
}

/** Data arranged for an editable document and the row returned after its metadata write. */
export const editablePublicDocumentAnswers = (
    document: PublicDocumentEntity,
): EditablePublicDocumentAnswersResultShape =>
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

type PublicPublishedChangeShape = Pick<
    PublicDocumentEntity,
    | "status"
    | "publishedBody"
    | "publishedRevision"
    | "draftRevision"
    | "failureCode"
    | "approvedBy"
    | "approvedByName"
    | "approvedAt"
    | "publishedSourceId"
>

/** Exact persisted fields of the first public approval, independent of the production writer. */
export const publicPublishedChangeOf: (overrides?: Partial<PublicPublishedChangeShape>) => PublicPublishedChangeShape =
    builder<PublicPublishedChangeShape>({
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

type PublicPublicationOfShape2 = { title: string; content: string }

/** The exact public text passed to its source owner. */
export const publicPublicationOf: (overrides?: Partial<PublicPublicationOfShape2>) => PublicPublicationOfShape2 =
    builder<{ title: string; content: string }>({
        title: "Frequent questions",
        content: "Same day delivery.",
    })

/** Source-review snapshot after explicit acknowledgement of h2, retaining h1 draft evidence. */
export const publicChangedReviewOf = (): PublicDocumentApprovalEntity =>
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
export const publicReplayDocumentOf = (): PublicDocumentEntity =>
    documentRow({
        status: "published",
        publishedBody: "Same day delivery.",
        publishedRevision: 0,
        approvedBy: "original-approver",
    })

type PublicMissingReviewAnswersResultShape = {
    readonly findOne: readonly [
        readonly [typeof PublicDocumentEntity, PublicDocumentEntity],
        readonly [typeof PublicDocumentApprovalEntity, null],
    ]
    readonly find: readonly [
        readonly [typeof PublicDocumentEntity, readonly [PublicDocumentEntity]],
        readonly [typeof PublicDocumentSourceEntity, readonly []],
        readonly [typeof PublicDocumentApprovalEntity, readonly []],
    ]
}

/** Entity answers for a published revision whose required immutable audit has disappeared. */
export const publicMissingReviewAnswers = (): PublicMissingReviewAnswersResultShape =>
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

type PublicMutationAnswersResultShape = {
    readonly findOne: readonly [typeof PublicDocumentEntity, PublicDocumentEntity]
    readonly find: readonly [typeof PublicDocumentSourceEntity, readonly [PublicDocumentSourceEntity]]
    readonly update: readonly [typeof PublicDocumentEntity, EditablePublicDocumentAnswersResultUpdateShape]
}

/** Concurrent revision-fence answers; the caller's kit manager retains the actual typed update result. */
export const publicMutationAnswers = (
    document: PublicDocumentEntity = documentRow(),
): PublicMutationAnswersResultShape =>
    ({
        findOne: [PublicDocumentEntity, document],
        find: [PublicDocumentSourceEntity, [documentSourceRow()]],
        update: [PublicDocumentEntity, { affected: 1 }],
    }) as const

type PublicDraftingAnswersResultShape = {
    readonly findOne: readonly [typeof PublicDocumentEntity, PublicDocumentEntity]
    readonly find: readonly [typeof PublicDocumentSourceEntity, ReadonlyArray<PublicDocumentSourceEntity>]
    readonly update: readonly [
        readonly [typeof PublicDocumentEntity, EditablePublicDocumentAnswersResultUpdateShape],
        readonly [typeof PublicDocumentSourceEntity, EditablePublicDocumentAnswersResultUpdateShape],
    ]
    readonly insert: readonly [typeof PublicDocumentSourceEntity, InsertResult]
    readonly delete: readonly [
        readonly [typeof PublicDocumentEntity, EditablePublicDocumentAnswersResultUpdateShape],
        readonly [typeof PublicDocumentSourceEntity, EditablePublicDocumentAnswersResultUpdateShape],
    ]
}

/** Strict entity answers for a revision-fenced generation and its working provenance. */
export const publicDraftingAnswers = (
    document: PublicDocumentEntity,
    sources: ReadonlyArray<PublicDocumentSourceEntity>,
): PublicDraftingAnswersResultShape =>
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
export const publicReviewRequestOf: (overrides?: Partial<ApproveRequest>) => ApproveRequest = builder<
    Parameters<PublicDocumentsService["approve"]>[2]
>({
    id: "d1",
    expectedDraftRevision: 0,
})

/** A previously published document whose approved text differs from its working draft. */
export const publicPublishedDocumentOf = (): PublicDocumentEntity =>
    documentRow({ status: "published", publishedBody: "x" })
