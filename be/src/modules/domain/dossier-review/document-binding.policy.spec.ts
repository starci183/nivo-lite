import { Test } from "@nestjs/testing"
import { bindingOf } from "./document-binding.policy"
import type { BindingCandidate } from "./document-binding.policy"

const SUBJECT = Symbol("document-binding.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bindingOf } }],
    }).compile()
    return moduleRef.get<{ bindingOf: typeof bindingOf }>(SUBJECT)
}

const candidateOf = (changes: Partial<BindingCandidate>): BindingCandidate => ({
    id: "d1",
    ref: "1",
    category: "LEGAL FILES",
    name: "Business registration certificate",
    existing: null,
    drafts: null,
    expects: [],
    ...changes,
})

const REGISTRATION = candidateOf({
    id: "d1",
    ref: "1",
    name: "Business registration certificate",
    expects: [{ titleAny: ["business registration"], textAny: ["registration certificate"] }],
})
const BANK = candidateOf({
    id: "d5",
    ref: "5",
    name: "Bank accounts register",
    existing: "Account list of Sample Co. Ltd",
})
const CHARTER = candidateOf({ id: "d2", ref: "2", name: "Company charter" })

describe("bindingOf", () => {
    it("binds a document whose title carries the words of a dossier name", async () => {
        const { bindingOf: bind } = await buildSubject()
        const bound = bind(
            { title: "Business registration certificate - Sample Co. Ltd.pdf", topic: null, opening: "" },
            [REGISTRATION, BANK, CHARTER],
        )

        expect(bound?.id).toBe("d1")
    })

    it("binds a document by its number and category when the title says little", async () => {
        const { bindingOf: bind } = await buildSubject()
        const bound = bind({ title: "05. scan 0192", topic: "legal files", opening: "bank accounts register" }, [
            REGISTRATION,
            BANK,
            CHARTER,
        ])

        expect(bound?.id).toBe("d5")
    })

    it("binds a document the checklist lists by its title", async () => {
        const { bindingOf: bind } = await buildSubject()
        const bound = bind({ title: "Account list of Sample Co. Ltd.xlsx", topic: null, opening: "" }, [
            REGISTRATION,
            BANK,
            CHARTER,
        ])

        expect(bound?.id).toBe("d5")
    })

    it("binds by the opening of the text when the title is a code", async () => {
        const { bindingOf: bind } = await buildSubject()
        const bound = bind(
            {
                title: "scan_0192.pdf",
                topic: null,
                opening: "Company charter of Sample Co. Ltd, adopted by the council",
            },
            [REGISTRATION, BANK, CHARTER],
        )

        expect(bound?.id).toBe("d2")
    })

    it("binds nothing when no dossier leads, so the document is read on its own", async () => {
        const { bindingOf: bind } = await buildSubject()
        expect(
            bind({ title: "Lunch menu", topic: null, opening: "salad and soup" }, [REGISTRATION, BANK, CHARTER]),
        ).toBeNull()
        expect(bind({ title: "Anything", topic: null, opening: "" }, [])).toBeNull()
    })

    it("binds nothing when two dossiers fit equally well", async () => {
        const { bindingOf: bind } = await buildSubject()
        const twin = candidateOf({
            id: "d3",
            ref: "3",
            name: "Business registration certificate",
            expects: REGISTRATION.expects,
        })

        expect(
            bind({ title: "Business registration certificate.pdf", topic: null, opening: "" }, [REGISTRATION, twin]),
        ).toBeNull()
    })
})

describe("bindingOf > checklist and title boundaries", () => {
    it("binds a zero-padded numeric reference with its category even when the scan has no useful words", async () => {
        const { bindingOf: bind } = await buildSubject()

        expect(bind({ title: "  005. scan 0192.pdf", topic: "legal files", opening: "" }, [BANK, CHARTER])).toBe(BANK)
    })

    it("keeps zero as a numeric reference after removing redundant leading zeros", async () => {
        const { bindingOf: bind } = await buildSubject()
        const zero = candidateOf({ id: "d0", ref: "0", name: "Archive index" })

        expect(bind({ title: "000. scan", topic: "legal files", opening: "" }, [zero])).toBe(zero)
    })

    it("matches a listed title after removing a numbered subitem prefix and a real file extension", async () => {
        const { bindingOf: bind } = await buildSubject()
        const archive = candidateOf({ id: "d9", ref: "9", name: "Archive index", existing: "Board resolution" })

        expect(bind({ title: "004a. Board resolution.docx", topic: null, opening: "" }, [archive])).toBe(archive)
    })

    it("does not remove a file type word that is part of the title rather than an extension", async () => {
        const { bindingOf: bind } = await buildSubject()
        const archive = candidateOf({ id: "d9", ref: "9", name: "Archive index", existing: "Operating budget" })

        expect(bind({ title: "Operating budget docx", topic: null, opening: "" }, [archive])).toBeNull()
    })

    it("does not infer a dossier from common words, a year or an empty title", async () => {
        const { bindingOf: bind } = await buildSubject()
        const common = candidateOf({ name: "Ho so 2026", ref: "" })

        expect(bind({ title: "2026", topic: null, opening: "" }, [common])).toBeNull()
        expect(bind({ title: "", topic: null, opening: "" }, [common])).toBeNull()
    })

    it("keeps large checklist references exact while removing only redundant leading zeros", async () => {
        const { bindingOf: bind } = await buildSubject()
        const large = candidateOf({ id: "large", ref: "9007199254740993", name: "Archive index" })

        expect(bind({ title: "0009007199254740993. scan", topic: "legal files", opening: "" }, [large])).toBe(large)
        expect(bind({ title: "0009007199254740993x. scan", topic: "legal files", opening: "" }, [large])).toBeNull()
    })
})
