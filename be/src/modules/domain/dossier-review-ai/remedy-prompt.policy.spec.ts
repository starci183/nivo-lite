import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { RemedyRequest } from "@modules/domain/dossier-review"
import {
    MAX_REMEDY_PROMPT_CHARS,
    REMEDY_PROMPT_VERSION,
    REMEDY_SYSTEM_PROMPT,
    remedyPrompt as realRemedyPrompt,
} from "./remedy-prompt.policy"

const requestOf = builder<RemedyRequest>({
    workspaceId: "ws-1",
    today: "2026-10-31",
    finding: {
        kind: "outdated",
        severity: "high",
        title: "Dieu le chua cap nhat sau chuyen nhuong von",
        detail: "Dieu le lap khi thanh lap, sau do co chuyen nhuong.",
        evidence: [
            { label: "Dieu le", quote: "Von dieu le la 300.000.000 dong" },
            { label: "Su kien chuyen nhuong", quote: null },
        ],
    },
    dossier: { ref: "2", name: "Dieu le cong ty", category: "Ho so phap ly" },
    remedy: { documentType: "Nghi quyet HDTV thong qua Dieu le sua doi", guidance: "Neu dieu khoan sua doi." },
    identity: ["Ten cong ty: Cong ty TNHH Mau", "Nguoi dai dien: Nguyen Van A"],
    instructions: "Hop ngay 10/11.",
})

const SUBJECT = Symbol("remedy-prompt.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { remedyPrompt: realRemedyPrompt } }],
    }).compile()
    return moduleRef.get<{ remedyPrompt: typeof realRemedyPrompt }>(SUBJECT)
}

describe("remedyPrompt", () => {
    it("renders the issue, its evidence, the dossier, the document to draft, the notes and the identity facts", async () => {
        const subject = await build()
        expect(subject.remedyPrompt(requestOf())).toBe(
            [
                "TODAY  2026-10-31",
                "ISSUE  [outdated / high] Dieu le chua cap nhat sau chuyen nhuong von",
                "  Dieu le lap khi thanh lap, sau do co chuyen nhuong.",
                "EVIDENCE",
                '  Dieu le: "Von dieu le la 300.000.000 dong"',
                "  Su kien chuyen nhuong",
                "DOSSIER  2 · Dieu le cong ty · Ho so phap ly",
                "DOCUMENT TO DRAFT  Nghi quyet HDTV thong qua Dieu le sua doi",
                "GUIDANCE  Neu dieu khoan sua doi.",
                "OWNER NOTES",
                "  Hop ngay 10/11.",
                "IDENTITY FACTS",
                "  Ten cong ty: Cong ty TNHH Mau",
                "  Nguoi dai dien: Nguyen Van A",
            ].join("\n"),
        )
    })

    it("leaves out the evidence, guidance, notes and identity sections when there are none", async () => {
        const subject = await build()
        const prompt = subject.remedyPrompt(
            requestOf({
                finding: {
                    kind: "missing",
                    severity: "medium",
                    title: "Thieu CCCD",
                    detail: "Khong co CCCD.",
                    evidence: [],
                },
                remedy: { documentType: null, guidance: null },
                identity: [],
                instructions: null,
            }),
        )
        expect(prompt).toBe(
            [
                "TODAY  2026-10-31",
                "ISSUE  [missing / medium] Thieu CCCD",
                "  Khong co CCCD.",
                "DOSSIER  2 · Dieu le cong ty · Ho so phap ly",
                "DOCUMENT TO DRAFT  not specified",
            ].join("\n"),
        )
    })

    it("keeps only the identity facts that fit within the limit", async () => {
        const subject = await build()
        const line = "x".repeat(1_000)
        const prompt = subject.remedyPrompt(requestOf({ identity: Array(30).fill(line) }))
        const kept = prompt.split("\n").filter((row) => row === `  ${line}`)
        expect(prompt.length).toBeLessThanOrEqual(MAX_REMEDY_PROMPT_CHARS)
        expect(kept).toHaveLength(15)
    })

    it("cuts the message at the limit when the issue alone is longer", async () => {
        const subject = await build()
        const prompt = subject.remedyPrompt(
            requestOf({
                finding: { kind: "missing", severity: "low", title: "t".repeat(20_000), detail: "d", evidence: [] },
            }),
        )
        expect(prompt).toHaveLength(MAX_REMEDY_PROMPT_CHARS)
    })
})

describe("REMEDY_SYSTEM_PROMPT", () => {
    it("requires placeholders for unknown values, forbids invention and asks for JSON", () => {
        expect(REMEDY_SYSTEM_PROMPT).toContain("never invent")
        expect(REMEDY_SYSTEM_PROMPT).toContain("placeholder")
        expect(REMEDY_SYSTEM_PROMPT).toContain("Answer JSON only")
    })

    it("carries the prompt version dossier-remedy@1", () => {
        expect(REMEDY_PROMPT_VERSION).toBe("dossier-remedy@1")
    })
})
