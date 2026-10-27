import { Test } from "@nestjs/testing"
import { sepayQrUrlOf } from "./qr-image.policy"

const SUBJECT = Symbol("qr-image.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sepayQrUrlOf } }],
    }).compile()
    return moduleRef.get<typeof import("./qr-image.policy")>(SUBJECT)
}

const QR = "https://qr.sepay.vn/img?acc=0123456789&bank=MB&amount=1500000&des=INV2026100001&template=compact"

describe("sepayQrUrlOf", () => {
    it("finds the QR link inside the renewal tail", async () => {
        const subject = await build()

        expect(subject.sepayQrUrlOf(`Hoa don INV-202610-0001\nSo tien: 1.500.000d\nQR: ${QR}\nCam on!`)).toBe(QR)
    })

    it("leaves out the punctuation that closes the sentence", async () => {
        const subject = await build()

        expect(subject.sepayQrUrlOf(`Scan (${QR}).`)).toBe(QR)
    })

    it("answers the first link when there are two", async () => {
        const subject = await build()

        expect(subject.sepayQrUrlOf(`${QR} and https://qr.sepay.vn/img?acc=9`)).toBe(QR)
    })

    it.each([
        ["no link", "Hello"],
        ["another host", "https://img.vietqr.io/image/MB-1-compact.png"],
        ["the SePay image path without a query", "https://qr.sepay.vn/img"],
        ["a plain http link", "http://qr.sepay.vn/img?acc=1"],
        ["a SePay link with nothing after the question mark", "See https://qr.sepay.vn/img?."],
    ])("answers null for %s", async (_label, text) => {
        const subject = await build()

        expect(subject.sepayQrUrlOf(text)).toBeNull()
    })
})
