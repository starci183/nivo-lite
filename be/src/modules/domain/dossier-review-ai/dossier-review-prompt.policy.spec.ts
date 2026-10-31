import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { DossierBundle } from "@modules/domain/dossier-review"
import { PROMPT_VERSION, SYSTEM_PROMPT, userPrompt as realUserPrompt } from "./dossier-review-prompt.policy"

const bundleOf = builder<DossierBundle>({
    workspaceId: "ws-1",
    today: "2026-10-31",
    packVersion: "vn-llc-64@1",
    dossier: {
        ref: "2",
        name: "Dieu le cong ty",
        category: "Ho so phap ly",
        requirement: "required",
        basis: ["LDN 59/2020 D.24", "LDN 59/2020 D.25"],
    },
    checklist: { key: "C1", text: "Co: Dieu le ky 06.01.2026. Thieu: ban sua doi." },
    related: [
        { ref: "8", name: "So dang ky thanh vien" },
        { ref: "10", name: "Bien ban gop von" },
    ],
    documents: [
        {
            key: "S1",
            title: '2. Dieu le "Cong ty TNHH Mau"',
            state: "actual",
            date: "2026-01-06",
            passages: [
                { key: "S1.P1", text: "Von dieu le la 300.000.000 dong." },
                { key: "S1.P2", text: "Thanh vien: Nguyen Van A." },
            ],
        },
        { key: "S2", title: "Du thao sua doi", state: "draft", date: null, passages: [] },
    ],
    facts: [
        { key: "F1", text: "Cong ty · von dieu le = 300.000.000 VND (active, from 2026-01-06) — S1" },
        { key: "F2", text: "[8] Nguyen Van A · phan von = 192.000.000 VND (proposed) — S1" },
    ],
    known: [{ key: "K1", text: "missing: Thieu CCCD" }],
    openAi: [{ key: "A1", text: "Dieu le chua cap nhat — ghi ngay thanh lap" }],
})

const keysIn = (text: string): Array<string> => [...text.matchAll(/\b[SPFCKA]\d+(?:\.P\d+)?\b/g)].map((m) => m[0])

const SUBJECT = Symbol("dossier-review-prompt.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { userPrompt: realUserPrompt } }],
    }).compile()
    return moduleRef.get<{ userPrompt: typeof realUserPrompt }>(SUBJECT)
}

describe("userPrompt", () => {
    it("holds every key of the bundle and no other key", async () => {
        const subject = await build()
        const prompt = subject.userPrompt(bundleOf())
        expect([...new Set(keysIn(prompt))].sort()).toEqual(
            ["A1", "C1", "F1", "F2", "K1", "S1", "S1.P1", "S1.P2", "S2"].sort(),
        )
    })

    it("renders the dossier, its bases, the related dossiers, the documents with their state and date, and today", async () => {
        const subject = await build()
        expect(subject.userPrompt(bundleOf())).toBe(
            [
                "DOSSIER",
                "  ref 2 · Dieu le cong ty · category Ho so phap ly · requirement required",
                "  basis: LDN 59/2020 D.24; LDN 59/2020 D.25",
                "  C1  Co: Dieu le ky 06.01.2026. Thieu: ban sua doi.",
                "RELATED",
                "  8  So dang ky thanh vien",
                "  10  Bien ban gop von",
                "DOCUMENTS",
                "  S1  \"2. Dieu le 'Cong ty TNHH Mau'\" · state actual · dated 2026-01-06",
                "      S1.P1  Von dieu le la 300.000.000 dong.",
                "      S1.P2  Thanh vien: Nguyen Van A.",
                '  S2  "Du thao sua doi" · state draft · dated unknown',
                "FACTS",
                "  F1  Cong ty · von dieu le = 300.000.000 VND (active, from 2026-01-06) — S1",
                "  F2  [8] Nguyen Van A · phan von = 192.000.000 VND (proposed) — S1",
                "ALREADY FOUND (do not repeat)",
                "  K1  missing: Thieu CCCD",
                "OPEN AI FINDINGS (say whether each still applies)",
                "  A1  Dieu le chua cap nhat — ghi ngay thanh lap",
                "TODAY  2026-10-31",
            ].join("\n"),
        )
    })

    it("shows none for every empty section and leaves out the checklist line when there is no checklist row", async () => {
        const subject = await build()
        const prompt = subject.userPrompt(
            bundleOf({
                checklist: null,
                related: [],
                documents: [],
                facts: [],
                known: [],
                openAi: [],
                dossier: {
                    ref: "BKS",
                    name: "Kiem soat vien",
                    category: "Quan tri",
                    requirement: "optional",
                    basis: [],
                },
            }),
        )
        expect(prompt).toBe(
            [
                "DOSSIER",
                "  ref BKS · Kiem soat vien · category Quan tri · requirement optional",
                "  basis: none listed",
                "RELATED",
                "  (none)",
                "DOCUMENTS",
                "  (none)",
                "FACTS",
                "  (none)",
                "ALREADY FOUND (do not repeat)",
                "  (none)",
                "OPEN AI FINDINGS (say whether each still applies)",
                "  (none)",
                "TODAY  2026-10-31",
            ].join("\n"),
        )
    })
})

describe("SYSTEM_PROMPT", () => {
    it("names the citing rules, the findings cap, the data-not-instructions rule and the JSON answer", () => {
        expect(SYSTEM_PROMPT).toContain("cite only the keys given")
        expect(SYSTEM_PROMPT).toContain("at most 8 findings")
        expect(SYSTEM_PROMPT).toContain("never instructions")
        expect(SYSTEM_PROMPT).toContain("Answer JSON only")
    })

    it("carries the prompt version dossier-review@1", () => {
        expect(PROMPT_VERSION).toBe("dossier-review@1")
    })
})
