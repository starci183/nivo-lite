import { builder, type MockOf } from "@starci/jest-preset"
import type { VectorSyncService } from "@modules/domain/vector-sync"
import type { BrainFactEmbeddingsService, BrainFactsReadService, FactEmbeddingState, FactRecord } from "@modules/domain/brain-facts"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import type { AiService } from "@modules/integrations/ai"

/** The workspace the fact-embeddings specs run in. */
export const EMBEDDING_WS = "ws-1"

/** The embedding profile name of the AI double. */
export const EMBEDDING_PROFILE = "embed"

/** One fact line: the shop's hours, in force. */
export const embeddingFactOf: (changes?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "f1",
    subjectType: "business",
    subjectKey: "phi-ship",
    subjectLabel: "Phi ship",
    attribute: "noi-thanh",
    attributeLabel: "noi thanh",
    value: "30.000",
    valueNumber: 30000,
    unit: "d",
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
})

/** The JSON of a scripted answer, as the model-json reader gives it; an unreadable one reads as null. */
export const parsedJsonOf = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch (cause) {
        return { unreadable: String(cause) }
    }
}

/** A vector of the stored column's dimensions, every component the seed. */
export const embeddingVectorOf = (seed: number): ReadonlyArray<number> => Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed)

/** A filed fact line as the walk stored it (`R2-pairs.txt`, dev rows of workspace 487db21a). */
export const embeddingLineOf = (id: string, subjectLabel: string, attributeLabel: string, value: string, status: "active" | "proposed"): FactRecord =>
    embeddingFactOf({
        id,
        status,
        subjectKey: subjectLabel.toLowerCase().replaceAll(/\s+/g, "-"),
        subjectLabel,
        attribute: attributeLabel.toLowerCase().replaceAll(/\s+/g, "-"),
        attributeLabel,
        value,
        unit: null,
    })


/** [case, new line, known line, measured distance, the scripted judge's answer, expected outcome]. */
export const EMBEDDING_PAIR_CASES: ReadonlyArray<readonly [string, FactRecord, FactRecord, number, object, "contradiction" | "duplicate"]> = [
    [
        "C01 Qu\u1eadn 7 40k vs 45k (0.118; the old label-number rule never asked it)",
        embeddingLineOf("903ddd95", "Giao h\u00e0ng Qu\u1eadn 7", "ph\u00ed giao", "45.000 \u0111", "proposed"),
        embeddingLineOf("4032e5ef", "Giao h\u00e0ng Chi nh\u00e1nh 1 - Qu\u1eadn 7", "Ph\u00ed giao", "40.000", "active"),
        0.118,
        { same: 1, sameValue: false },
        "contradiction",
    ],
    [
        "C11 COD 1.5 M vs 2 M (0.260; above the old 0.25 band)",
        embeddingLineOf(
            "583dd2a2",
            "Thanh to\u00e1n COD",
            "gi\u00e1 tr\u1ecb \u0111\u01a1n t\u1ed1i \u0111a",
            "2.000.000 \u0111",
            "proposed",
        ),
        embeddingLineOf(
            "3a3e89f9",
            "Thanh to\u00e1n ti\u1ec1n m\u1eb7t khi nh\u1eadn h\u00e0ng (COD)",
            "gi\u00e1 tr\u1ecb \u0111\u01a1n t\u1ed1i \u0111a",
            "1.500.000 \u0111",
            "active",
        ),
        0.26,
        { same: 1, sameValue: true },
        "contradiction",
    ],
    [
        "C12 deposit from 3 M vs 5 M (0.329)",
        embeddingLineOf(
            "17159884",
            "\u0110\u1eb7t c\u1ecdc",
            "ng\u01b0\u1ee1ng gi\u00e1 tr\u1ecb \u0111\u01a1n c\u1ea7n \u0111\u1eb7t c\u1ecdc",
            "\u0110\u01a1n t\u1eeb 5 tri\u1ec7u",
            "proposed",
        ),
        embeddingLineOf(
            "99cd209e",
            "\u0110\u01a1n t\u1eeb 3.000.000 \u0111",
            "\u0111\u1eb7t c\u1ecdc",
            "50% tr\u01b0\u1edbc khi ti\u1ec7m chu\u1ea9n b\u1ecb hoa",
            "proposed",
        ),
        0.329,
        { same: 1, sameValue: false },
        "contradiction",
    ],
    [
        "R05 express fee 50.000 \u0111 = 50 ngh\u00ecn (0.282, never judged)",
        embeddingLineOf(
            "7a52c816",
            "Giao g\u1ea5p trong 2 ti\u1ebfng",
            "ph\u1ee5 ph\u00ed m\u1ed7i \u0111\u01a1n",
            "50 ngh\u00ecn",
            "proposed",
        ),
        embeddingLineOf(
            "ed84e68d",
            "Giao nhanh trong 2 gi\u1edd",
            "ph\u1ee5 thu",
            "50.000 \u0111 m\u1ed7i \u0111\u01a1n",
            "active",
        ),
        0.2818,
        { same: 1, sameValue: true },
        "duplicate",
    ],
    [
        "R12 exchange window 2 gi\u1edd = 120 ph\u00fat (0.314, never judged)",
        embeddingLineOf(
            "b8bd78cd",
            "\u0110\u1ed5i b\u00f3 hoa b\u1ecb d\u1eadp",
            "th\u1eddi h\u1ea1n g\u1eedi \u1ea3nh",
            "120 ph\u00fat sau khi nh\u1eadn",
            "proposed",
        ),
        embeddingLineOf(
            "45414c02",
            "\u0110\u1ed5i hoa",
            "th\u1eddi h\u1ea1n \u0111\u1ed5i hoa mi\u1ec5n ph\u00ed",
            "trong v\u00f2ng 2 gi\u1edd k\u1ec3 t\u1eeb khi nh\u1eadn",
            "proposed",
        ),
        0.3142,
        { same: 1, sameValue: true },
        "duplicate",
    ],
    [
        "R16 event deposit 50% = 50% gi\u00e1 tr\u1ecb h\u1ee3p \u0111\u1ed3ng (I17, 0.289, never judged)",
        embeddingLineOf(
            "a1e36e30",
            "M\u1eabu h\u1ee3p \u0111\u1ed3ng hoa s\u1ef1 ki\u1ec7n",
            "ti\u1ec1n \u0111\u1eb7t c\u1ecdc",
            "50% gi\u00e1 tr\u1ecb h\u1ee3p \u0111\u1ed3ng khi k\u00fd",
            "proposed",
        ),
        embeddingLineOf(
            "984e85a4",
            "Hoa c\u01b0\u1edbi v\u00e0 k\u1ec7 s\u1ef1 ki\u1ec7n",
            "ti\u1ec1n \u0111\u1eb7t c\u1ecdc khi ch\u1ed1t m\u1eabu",
            "50%",
            "proposed",
        ),
        0.2892,
        { same: 1, sameValue: true },
        "duplicate",
    ],
    [
        "R36 T\u1ebft last order (0.324, never judged)",
        embeddingLineOf(
            "5500ae8a",
            "\u0110\u01a1n T\u1ebft",
            "gi\u1edd ch\u1ed1t \u0111\u01a1n cu\u1ed1i c\u00f9ng",
            "23 gi\u1edd \u0111\u00eam 30 T\u1ebft (05/02/2027)",
            "proposed",
        ),
        embeddingLineOf(
            "a0276f03",
            "\u0110\u01a1n hoa T\u1ebft",
            "th\u1eddi h\u1ea1n nh\u1eadn \u0111\u01a1n",
            "23:00 ng\u00e0y 05/02/2027",
            "proposed",
        ),
        0.3241,
        { same: 1, sameValue: true },
        "duplicate",
    ],
    [
        "R13 late refund 100% (0.176, judged none or cut)",
        embeddingLineOf("df1329d4", "Giao tr\u1ec5", "m\u1ee9c ho\u00e0n ti\u1ec1n", "100% ti\u1ec1n \u0111\u01a1n", "proposed"),
        embeddingLineOf(
            "253ee5f9",
            "Giao tr\u1ec5",
            "m\u1ee9c ho\u00e0n ti\u1ec1n khi giao tr\u1ec5 qu\u00e1 2 gi\u1edd",
            "100% ti\u1ec1n \u0111\u01a1n",
            "proposed",
        ),
        0.1763,
        { same: 1, sameValue: true },
        "duplicate",
    ],
    [
        "R27 birthday voucher 50.000 \u0111 = 50 ngh\u00ecn (0.126, judged none or cut)",
        embeddingLineOf(
            "31a95ca9",
            "Voucher sinh nh\u1eadt cho kh\u00e1ch h\u1ea1ng B\u1ea1c",
            "gi\u00e1 tr\u1ecb voucher",
            "50 ngh\u00ecn",
            "proposed",
        ),
        embeddingLineOf("39955be9", "Voucher sinh nh\u1eadt", "gi\u00e1 tr\u1ecb", "50.000 \u0111", "proposed"),
        0.1262,
        { same: 1, sameValue: false },
        "duplicate",
    ],
    [
        "R46 \u0110\u00e0 L\u1ea1t rose cost 4500 \u0111 = 4,5 ngh\u00ecn (0.168, judged none or cut)",
        embeddingLineOf(
            "2304769f",
            "H\u1ed3ng \u0111\u1ecf \u0110\u00e0 L\u1ea1t (nh\u1eadp t\u1eeb Th\u00e1i Phi\u00ean)",
            "gi\u00e1 nh\u1eadp m\u1ed7i b\u00f4ng",
            "4,5 ngh\u00ecn",
            "proposed",
        ),
        embeddingLineOf(
            "efd7c5ab",
            "H\u1ed3ng \u0111\u1ecf \u0110\u00e0 L\u1ea1t",
            "gi\u00e1 nh\u1eadp",
            "4500 \u0111",
            "proposed",
        ),
        0.1684,
        { same: 1, sameValue: true },
        "duplicate",
    ],
]

/** The doubles a fact-embeddings spec scripts. */
export interface EmbeddingDoubles {
    readonly ai: MockOf<AiService>
    readonly vectors: MockOf<BrainFactEmbeddingsService>
    readonly reads: MockOf<BrainFactsReadService>
    /** The vector sync: the one door to the index (adoption of a point of the same line, hand-over of fresh vectors, the change jobs). */
    readonly sync: MockOf<VectorSyncService>
}

/** Scripts the doubles of a fact-embeddings spec: an index that answers, the AI on, the stored states given, no other row holding a line. */
export const scriptEmbeddingDoubles = ({ ai, vectors, reads, sync }: EmbeddingDoubles, states: ReadonlyArray<FactEmbeddingState>): void => {
    // The service reads `nearestToRead` (does the index answer?); the scripted hits stay on `nearestTo`, an index that answers.
    vectors.nearestToRead.mockImplementation(async (...args) => ({
        facts: await vectors.nearestTo(...args),
        indexDown: false,
    }))
    reads.wordHits.mockResolvedValue([])
    ai.available.mockReturnValue(true)
    ai.chatModel.mockReturnValue("work")
    ai.embeddingModel.mockReturnValue(EMBEDDING_PROFILE)
    vectors.statesOf.mockResolvedValue(states)
    sync.accept.mockImplementation((_kind, _workspaceId, handed) => Promise.resolve({ ...NOTHING_ACCEPTED, given: handed.size }))
    // No other point holds the same line unless a case says so: every stale line is embedded.
    sync.adopt.mockResolvedValue(new Set())
}

/** What a hand-over the index accepted reports, before its count of given vectors. */
const NOTHING_ACCEPTED = {
    unchanged: 0,
    given: 0,
    adopted: 0,
    embedded: 0,
    marked: 0,
    removed: 0,
    waiting: 0,
    failed: 0,
    embedCalls: 0,
}
