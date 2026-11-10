import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { factOf } from "@tests/fixtures/builders/brain-facts.builder"
import type { InstanceDocument } from "@modules/domain/knowledge-sources"
import {
    copiedDocumentOf as copiedDocumentOfImplementation,
    copiedFactOf as copiedFactOfImplementation,
    copyTagOf as copyTagOfImplementation,
} from "./agent-knowledge-copy.policy"

const SUBJECT = Symbol("agent-knowledge-copy.policy")

type Subject = {
    copiedDocumentOf: typeof copiedDocumentOfImplementation
    copiedFactOf: typeof copiedFactOfImplementation
    copyTagOf: typeof copyTagOfImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    copiedDocumentOf: copiedDocumentOfImplementation,
                    copiedFactOf: copiedFactOfImplementation,
                    copyTagOf: copyTagOfImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const documentOf = builder<InstanceDocument>({
    id: "11111111-2222-3333-4444-555555555555",
    kind: "text",
    title: "Price list of Lan",
    content: "Rose 20k",
    topic: "Prices",
    tags: ["menu"],
    visibility: "internal",
})

describe("copyTagOf", () => {
    it("names the copied document without hyphens so the tag fits the forty-character limit", async () => {
        const subject = await buildSubject()

        const tag = subject.copyTagOf("11111111-2222-3333-4444-555555555555")

        expect(tag).toBe("copy:11111111222233334444555555555555")
        expect(tag.length).toBeLessThanOrEqual(40)
    })
})

describe("copiedFactOf", () => {
    it("keeps the fact for the new agent alone, approved, with the evidence it had and where the copy came from", async () => {
        const subject = await buildSubject()
        const fact = factOf({
            id: "f1",
            installationId: "inst-lan",
            status: "active",
            sourceKind: "owner",
            scope: "restricted",
            modules: ["sales"],
            unit: "k",
            evidence: [{ kind: "manual", ref: "r1", label: "Owner" }],
        })

        const input = subject.copiedFactOf(fact, "Sales Lan", "inst-minh", "m-owner")

        expect(input).toMatchObject({
            subjectLabel: fact.subjectLabel,
            attributeLabel: fact.attributeLabel,
            value: fact.value,
            unit: "k",
            scope: "restricted",
            modules: ["sales"],
            sourceKind: "owner",
            proposedBy: "m-owner",
            installationId: "inst-minh",
            autoApply: true,
        })
        expect(input.evidence).toEqual([
            { kind: "manual", ref: "r1", label: "Owner" },
            { kind: "note", ref: "copy:f1", label: "Copied from Sales Lan" },
        ])
    })
})

describe("copiedDocumentOf", () => {
    it("keeps a note for the new agent alone and tags it first with where it came from", async () => {
        const subject = await buildSubject()

        const input = subject.copiedDocumentOf(documentOf(), "sales", "inst-minh")

        expect(input).toEqual({
            kind: "text",
            title: "Price list of Lan",
            content: "Rose 20k",
            topic: "Prices",
            tags: ["copy:11111111222233334444555555555555", "menu"],
            module: "sales",
            installationId: "inst-minh",
            visibility: "internal",
        })
    })

    it("copies a file as the text read from it", async () => {
        const subject = await buildSubject()

        expect(subject.copiedDocumentOf(documentOf({ kind: "file" }), "sales", "inst-minh")).toMatchObject({
            kind: "text",
            content: "Rose 20k",
        })
    })

    it("keeps a link a link, to be read again", async () => {
        const subject = await buildSubject()

        const input = subject.copiedDocumentOf(
            documentOf({ kind: "url", content: "https://shop.example/menu" }),
            "sales",
            "inst-minh",
        )

        expect(input).toMatchObject({ kind: "url", url: "https://shop.example/menu" })
        expect(input).not.toHaveProperty("content")
    })
})
