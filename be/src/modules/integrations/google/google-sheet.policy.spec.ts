import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ledgerCategoryText as ledgerCategoryTextSubject, ledgerHeader as ledgerHeaderSubject, ledgerTab as ledgerTabSubject, ledgerVoidText as ledgerVoidTextSubject } from "./google-sheet.policy"

const SUBJECT = Symbol("google-sheet.policy")

describe("google-sheet.policy built the way Nest does", () => {
    let ledgerCategoryText: typeof ledgerCategoryTextSubject
    let ledgerHeader: typeof ledgerHeaderSubject
    let ledgerTab: typeof ledgerTabSubject
    let ledgerVoidText: typeof ledgerVoidTextSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ ledgerCategoryText: typeof ledgerCategoryTextSubject; ledgerHeader: typeof ledgerHeaderSubject; ledgerTab: typeof ledgerTabSubject; ledgerVoidText: typeof ledgerVoidTextSubject }>({ ledgerCategoryText: ledgerCategoryTextSubject, ledgerHeader: ledgerHeaderSubject, ledgerTab: ledgerTabSubject, ledgerVoidText: ledgerVoidTextSubject }) }],
        }).compile()
        ;({ ledgerCategoryText, ledgerHeader, ledgerTab, ledgerVoidText } = moduleRef.get<{ ledgerCategoryText: typeof ledgerCategoryTextSubject; ledgerHeader: typeof ledgerHeaderSubject; ledgerTab: typeof ledgerTabSubject; ledgerVoidText: typeof ledgerVoidTextSubject }>(SUBJECT))
    })

describe("ledger copy", () => {
    it("names the ledger tab and its eight header columns in Vietnamese", () => {
        expect(ledgerTab()).toBe("S\u1ed5 thu chi")
        expect(ledgerHeader()).toHaveLength(8)
        expect(ledgerHeader()[0]).toBe("Ng\u00e0y")
    })

    it("words a category and the reversal marker, and answers the key itself for an unknown category", () => {
        expect(ledgerCategoryText("sale")).toBe("B\u00e1n h\u00e0ng")
        expect(ledgerCategoryText("no-such-category")).toBe("sheet.ledgerCategory.no-such-category")
        expect(ledgerVoidText()).toBe("Ho\u00e0n t\u00e1c")
    })
})
})
