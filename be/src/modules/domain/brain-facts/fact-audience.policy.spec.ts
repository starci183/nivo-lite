import { Test } from "@nestjs/testing"
import {
    AREA_NOTE_PREFIX,
    REACH_NOTE_PREFIX,
    areaNoteOf,
    readersAfterMove,
    readersOfEvidence,
    readersOfNewValue,
    founderChoseReaders,
    reachNoteOf,
    widensReaders,
    widestReaders,
    type Readers,
} from "./fact-audience.policy"

const SUBJECT = Symbol("fact-audience.policy")

/** The policy as a Nest value. */
interface Policy {
    readonly readersOfEvidence: typeof readersOfEvidence
    readonly founderChoseReaders: typeof founderChoseReaders
    readonly reachNoteOf: typeof reachNoteOf
    readonly widensReaders: typeof widensReaders
    readonly widestReaders: typeof widestReaders
    readonly readersAfterMove: typeof readersAfterMove
    readonly areaNoteOf: typeof areaNoteOf
}

const build = async (): Promise<Policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    readersOfEvidence,
                    founderChoseReaders,
                    reachNoteOf,
                    widensReaders,
                    widestReaders,
                    readersAfterMove,
                    areaNoteOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Policy>(SUBJECT)
}

const PUBLIC: Readers = { scope: "public", modules: [] }
const INTERNAL: Readers = { scope: "internal", modules: [] }
const restricted = (...modules: Array<string>): Readers => ({ scope: "restricted", modules })

/** A truth in force with an audience, decided by someone. */
const truth = (audience: Readers, decidedBy: string | null = "NIVO", decisionNote: string | null = null) => ({
    ...audience,
    decidedBy,
    decisionNote,
})

describe("fact-audience.policy: evidence from a wider audience widensReaders the audience (D-BR-1)", () => {
    it.each([
        [INTERNAL, PUBLIC, PUBLIC],
        [PUBLIC, INTERNAL, PUBLIC],
        [restricted("sales"), INTERNAL, INTERNAL],
        [restricted("sales"), restricted("chatbot", "sales"), restricted("chatbot", "sales")],
        [restricted("sales"), PUBLIC, PUBLIC],
    ])("the union of %j and %j is %j", async (one, other, union) => {
        const policy = await build()
        expect(policy.widestReaders(one, other)).toEqual(union)
        expect(policy.widestReaders(other, one)).toEqual(union)
    })

    it.each([
        [INTERNAL, PUBLIC, true],
        [PUBLIC, INTERNAL, false],
        [restricted("sales"), restricted("sales", "chatbot"), true],
        [restricted("sales", "chatbot"), restricted("sales"), false],
        [INTERNAL, INTERNAL, false],
    ])("%j -> %j widensReaders: %s", async (from, to, expected) => {
        const policy = await build()
        expect(policy.widensReaders(from, to)).toBe(expected)
    })

    it("makes an internal truth public when a public document repeats it (9d8cca0e + P01 in the walk)", async () => {
        const policy = await build()
        expect(policy.readersOfEvidence(PUBLIC, truth(INTERNAL), "document")).toEqual(PUBLIC)
    })

    it("never lets an internal repetition or change narrow a public truth", async () => {
        const policy = await build()
        expect(policy.readersOfEvidence(INTERNAL, truth(PUBLIC), "document")).toEqual(PUBLIC)
        expect(policy.readersOfEvidence(INTERNAL, truth(PUBLIC), "staff")).toEqual(PUBLIC)
        expect(policy.readersOfEvidence(null, truth(PUBLIC), "document")).toEqual(PUBLIC)
    })

    it("takes the founder's own statement as stated, and keeps the audience he set with the switch", async () => {
        const policy = await build()
        expect(policy.readersOfEvidence(INTERNAL, truth(PUBLIC), "owner")).toEqual(INTERNAL)
        const switched = truth(INTERNAL, "Ada", policy.reachNoteOf(PUBLIC, INTERNAL))
        expect(policy.founderChoseReaders(switched)).toBe(true)
        expect(policy.readersOfEvidence(PUBLIC, switched, "document")).toEqual(INTERNAL)
    })

    it("tells the brain's own widening from the founder's switch", async () => {
        const policy = await build()
        const widened = truth(PUBLIC, "NIVO", policy.reachNoteOf(INTERNAL, PUBLIC, "a wider source"))
        expect(widened.decisionNote?.startsWith(REACH_NOTE_PREFIX)).toBe(true)
        expect(policy.founderChoseReaders(widened)).toBe(false)
        expect(policy.founderChoseReaders(truth(PUBLIC, "Ada", "Chosen among several different values"))).toBe(false)
    })

    it("gives a new truth the stated audience, else internal", async () => {
        const policy = await build()
        expect(policy.readersOfEvidence(PUBLIC, null, "document")).toEqual(PUBLIC)
        expect(policy.readersOfEvidence(null, null, "document")).toEqual(INTERNAL)
    })
})

describe("fact-audience.policy: a truth follows its document's area, the founder's switch stays", () => {
    /** A truth read from a bicycle workshop's document, decided by `decidedBy` with `note`. */
    const read = (audience: Readers, decidedBy: string | null = "NIVO", note: string | null = null) => ({
        ...truth(audience, decidedBy, note),
        sourceKind: "document" as const,
    })

    it("makes a truth public when one of its documents is in the public area, and internal when none is", async () => {
        const policy = await build()
        expect(policy.readersAfterMove(read(INTERNAL), true)).toEqual(PUBLIC)
        expect(policy.readersAfterMove(read(PUBLIC), false)).toEqual(INTERNAL)
        expect(policy.readersAfterMove(read(PUBLIC), true)).toBeNull()
        expect(policy.readersAfterMove(read(INTERNAL), false)).toBeNull()
    })

    it("keeps a restricted truth's modules unless it becomes public", async () => {
        const policy = await build()
        expect(policy.readersAfterMove(read(restricted("workshop")), false)).toBeNull()
        expect(policy.readersAfterMove(read(restricted("workshop")), true)).toEqual(PUBLIC)
    })

    it("leaves the audience the founder set with his switch, and his own statement, as they are", async () => {
        const policy = await build()
        const switched = read(INTERNAL, "Ada", policy.reachNoteOf(PUBLIC, INTERNAL))
        expect(policy.readersAfterMove(switched, true)).toBeNull()
        expect(policy.readersAfterMove({ ...read(PUBLIC), sourceKind: "owner" }, false)).toBeNull()
        expect(policy.readersAfterMove({ ...read(PUBLIC), sourceKind: "manager" }, false)).toBeNull()
    })

    it("writes a move's note that names the document and is never taken for the founder's switch", async () => {
        const policy = await build()
        const note = policy.areaNoteOf(INTERNAL, PUBLIC, '"Tune-up prices" internal -> public')
        expect(note).toBe(`${AREA_NOTE_PREFIX} "Tune-up prices" internal -> public; readers internal -> public`)
        const moved = read(PUBLIC, "Ada", note)
        expect(policy.founderChoseReaders(moved)).toBe(false)
        // So the next move re-labels it again.
        expect(policy.readersAfterMove(moved, false)).toEqual(INTERNAL)
    })

    it("files a chat-sourced truth internal unless a scope is stated (no model or word decides it)", async () => {
        const policy = await build()
        expect(policy.readersOfEvidence(null, null, "staff")).toEqual(INTERNAL)
        expect(policy.readersOfEvidence(null, null, "ai")).toEqual(INTERNAL)
        expect(policy.readersOfEvidence(null, null, "customer")).toEqual(INTERNAL)
        expect(policy.readersOfEvidence(PUBLIC, null, "owner")).toEqual(PUBLIC)
    })
})

describe("fact-audience.policy: the audience of a NEW value is its own source's (strict area = audience)", () => {
    const publicInForce = { scope: "public" as const, modules: [], decisionNote: null, decidedBy: null }
    const restricted = { scope: "restricted" as const, modules: ["sales"], decisionNote: null, decidedBy: null }

    it("a new value from an internal-area document (or a chat) for a public truth is internal; a public-area document's is public", () => {
        expect(readersOfNewValue(null, publicInForce, "document")).toEqual({ scope: "internal", modules: [] })
        expect(readersOfNewValue(null, publicInForce, "customer")).toEqual({ scope: "internal", modules: [] })
        expect(readersOfNewValue({ scope: "public", modules: [] }, publicInForce, "document")).toEqual({ scope: "public", modules: [] })
    })

    it("never widens (a restricted truth stays restricted), keeps the founder's own statement, and a first value reads as stated", () => {
        expect(readersOfNewValue(null, restricted, "document")).toEqual({ scope: "restricted", modules: ["sales"] })
        expect(readersOfNewValue({ scope: "public", modules: [] }, publicInForce, "owner")).toEqual({ scope: "public", modules: [] })
        expect(readersOfNewValue(null, publicInForce, "owner")).toEqual({ scope: "public", modules: [] })
        expect(readersOfNewValue(null, null, "document")).toEqual({ scope: "internal", modules: [] })
    })
})
