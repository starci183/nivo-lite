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
