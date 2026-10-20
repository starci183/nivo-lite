import { Test } from "@nestjs/testing"
import { matchFolio, transferCodeOf } from "./folio-match.policy"
import type { FolioSnapshot } from "./accounting-gateway.port"

const SUBJECT = Symbol("folio-match.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { matchFolio, transferCodeOf } }],
    }).compile()
    return moduleRef.get<typeof import("./folio-match.policy")>(SUBJECT)
}

const FOLIO: FolioSnapshot = {
    folioId: "f-1",
    stayId: "s-1",
    balanceVnd: 12_800_000,
    paidVnd: 0,
    transferRef: "HAKUEN F7K2Q9",
    guestName: "Lan",
    roomNumber: "302",
}

describe("folio-match.policy", () => {
    it("finds the folio transfer code in a bank transfer content", async () => {
        const subject = await build()

        expect(subject.transferCodeOf("MBVCB.123 nguyen van a ck hakuen f7k2q9 phong 302")).toBe("HAKUEN F7K2Q9")
        expect(subject.transferCodeOf("IBFT HAKUENF7K2Q9")).toBe("HAKUEN F7K2Q9")
        expect(subject.transferCodeOf("chuyen tien phong")).toBeNull()
        expect(subject.transferCodeOf("HAKUEN F7K2")).toBeNull()
    })

    it("compares the credit with the balance due", async () => {
        const subject = await build()

        expect(subject.matchFolio(FOLIO, 12_800_000)).toBe("exact")
        expect(subject.matchFolio(FOLIO, 5_000_000)).toBe("partial")
        expect(subject.matchFolio(FOLIO, 13_000_000)).toBe("over")
        expect(subject.matchFolio({ ...FOLIO, balanceVnd: 0 }, 1)).toBe("settled")
    })
})
