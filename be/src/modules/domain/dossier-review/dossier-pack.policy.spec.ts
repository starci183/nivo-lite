import { Test } from "@nestjs/testing"
import { PACK, packEntryOf } from "./dossier-pack.policy"
import { DOSSIER_PACK_WORDS } from "./messages/dossier-pack.messages"

const SUBJECT = Symbol("dossier-pack.policy")
type Subject = { packEntryOf: typeof packEntryOf }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { packEntryOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("the rule pack vn-llc-64@1", () => {
    it("holds the 64 dossiers and the supervisory board", () => {
        const pack = PACK
        expect(pack.size).toBe(65)
        expect([...pack.keys()].slice(0, 3)).toEqual(["1", "2", "3"])
        expect(pack.has("BKS")).toBe(true)
    })

    it("describes the charter with its basis, signed expectation, events, related dossiers and drafted remedy", () => {
        const pack = PACK
        expect(pack.get("2")).toEqual({
            ref: "2",
            nameHint: ["dieu-le"],
            requirement: "required",
            basis: DOSSIER_PACK_WORDS.basis["2"],
            expects: [
                {
                    key: "charter",
                    label: DOSSIER_PACK_WORDS.labels.charter,
                    titleAny: ["dieu le"],
                    textAny: ["dieu le"],
                    about: null,
                    signed: true,
                    severity: "high",
                },
            ],
            mustReflect: ["capital_transfer", "member_change"],
            tracksExpiry: false,
            related: ["1", "8", "10", "11", "12", "19", "20", "45"],
            remedy: { ...DOSSIER_PACK_WORDS.remedies["2"], action: "draft" },
        })
    })

    it("gives an entry without words its defaults: no basis, no expectation, no remedy", () => {
        const pack = PACK
        expect(pack.get("27")).toEqual({
            ref: "27",
            nameHint: ["kpi"],
            requirement: "optional",
            basis: [],
            expects: [],
            mustReflect: [],
            tracksExpiry: false,
            related: [],
            remedy: null,
        })
        expect(pack.get("6")?.expects[0]).toEqual(
            expect.objectContaining({ about: "legal_representative", textAny: ["cccd", "can cuoc", "cmnd"] }),
        )
        expect(pack.get("53")?.tracksExpiry).toBe(true)
        expect(pack.get("58")?.requirement).toBe("template")
    })

    it("gives a dossier its entry only when its name carries the hint", async () => {
        const { packEntryOf: entryOf } = await buildSubject()
        expect(entryOf({ ref: "2", name: "Dieu le cong ty TNHH" })?.ref).toBe("2")
        expect(entryOf({ ref: "2", name: "Bien ban gop von" })).toBeNull()
        expect(entryOf({ ref: "99", name: "Dieu le" })).toBeNull()
    })
})
