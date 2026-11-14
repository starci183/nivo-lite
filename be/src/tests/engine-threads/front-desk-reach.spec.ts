import { ANSWER, CORE, FRONT, UNDERSTAND, customerWrites, processOf, threadDbOf, type ThreadDb } from "./thread-world"
import { reachProvidersOf } from "./thread-world-reach"

// E-SMALL item 1, THE EXPOSING CASE (P-NEXT item 3, seen on dev): a shop with NO booking agent installed had a "book an appointment" line
// routed `book`, and the hand-off `to-booking` failed `AGENTS_TAG_TARGET_MISSING` (a stop card). RULE (engine words): a step's route is
// closed when every road it leads to ends at a workflow call this workspace cannot start; the engine names those routes to the node
// (`run.unreachable`). The core's shipped front desk (no desk mock) on the REAL host, the REAL routes reader and the REAL MATCH reader.

const report = () => ({
    decision: "report",
    reason: "Buoc khong the hoan thanh.",
    question: "Khach hoi gi?",
    suggestions: [],
    customerLine: null,
})

/** The understand step's model request of one line, on a process whose reach knows `modules` (agent id -> module). */
const understandAsked = async (db: ThreadDb, modules: Readonly<Record<string, string>> | null): Promise<string> => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: dat lich" } })
    db.model.script(ANSWER, { confused: { reason: "Khong ro", question: "Khach hoi gi?" } })
    db.model.script(CORE, report())
    const process = await processOf(db, modules === null ? {} : { extra: reachProvidersOf(db, modules) })
    await customerWrites(process, "Cho minh dat lich chieu mai")
    const [asked] = db.model.askedOf(UNDERSTAND)
    return JSON.stringify(asked?.request ?? null)
}

/** The goal names a route as `"<route>"` (the front desk's routes text). */
const offers = (asked: string, route: string): boolean => asked.includes(`\\"${route}\\"`)

describe("run.unreachable, the front desk (exposing case)", () => {
    it("only the chatbot installed: book, buy and paid lead to calls nobody can start; the model is offered complaint and question only", async () => {
        const modules = { [FRONT]: "chatbot" }
        const asked = await understandAsked(threadDbOf({ modules }), modules)
        expect(asked).toContain("These are the only routes this shop has")
        for (const closed of ["book", "buy", "paid"]) expect(offers(asked, closed)).toBe(false)
        for (const open of ["complaint", "question"]) expect(offers(asked, open)).toBe(true)
    })

    it("with the sales agent installed (consult and payment live), only book is closed", async () => {
        const modules = { [FRONT]: "chatbot", "sales-agent": "sales" }
        const asked = await understandAsked(threadDbOf({ modules }), modules)
        expect(asked).toContain("These are the only routes this shop has")
        expect(offers(asked, "book")).toBe(false)
        for (const open of ["buy", "paid", "complaint", "question"]) expect(offers(asked, open)).toBe(true)
    })

    it("an app that binds no reach names no route: the five routes are offered as before", async () => {
        const modules = { [FRONT]: "chatbot" }
        const asked = await understandAsked(threadDbOf({ modules }), null)
        expect(asked).not.toContain("These are the only routes this shop has")
        for (const open of ["book", "buy", "paid", "complaint", "question"]) expect(offers(asked, open)).toBe(true)
    })
})
