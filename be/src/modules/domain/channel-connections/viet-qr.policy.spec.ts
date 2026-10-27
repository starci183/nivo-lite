import { Test } from "@nestjs/testing"
import { vietQrUrl } from "./viet-qr.policy"

const SUBJECT = Symbol("viet-qr.policy")

type Subject = { vietQrUrl: typeof vietQrUrl }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { vietQrUrl } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const account = { accountNumber: "0123456789", bankCode: "VCB", holder: "NGUYEN VAN A" }

describe("viet-qr policy > vietQrUrl", () => {
    it("draws SePay's VietQR image of the account, the amount and the transfer content", async () => {
        const subject = await buildSubject()

        expect(subject.vietQrUrl(account, 1500000, "HD2026001")).toBe(
            "https://qr.sepay.vn/img?acc=0123456789&bank=VCB&amount=1500000&des=HD2026001&template=compact",
        )
    })

    it("leaves the amount out when it is null, so the payer types it", async () => {
        const subject = await buildSubject()

        const url = subject.vietQrUrl({ accountNumber: "0123456789", bankCode: "MB" }, null, "HD1")

        expect(url).toBe("https://qr.sepay.vn/img?acc=0123456789&bank=MB&des=HD1&template=compact")
        expect(new URL(url).searchParams.has("amount")).toBe(false)
    })

    it("keeps a zero amount and never prints the holder", async () => {
        const subject = await buildSubject()

        const url = new URL(subject.vietQrUrl(account, 0, "HD1"))

        expect(url.searchParams.get("amount")).toBe("0")
        expect(url.search).not.toContain("NGUYEN")
    })

    it("encodes the content so spaces, ampersands, accents and equals signs survive the round trip", async () => {
        const subject = await buildSubject()
        const content = "Gia h\u1EA1n H\u0110 #12 & ph\u00ED=50%"

        const url = subject.vietQrUrl(account, 100, content)

        expect(url).not.toContain(" ")
        expect(url).toContain("des=Gia+h%E1%BA%A1n+H%C4%90+%2312+%26+ph%C3%AD%3D50%25&template=compact")
        expect(new URL(url).searchParams.get("des")).toBe(content)
        expect([...new URL(url).searchParams.keys()]).toEqual(["acc", "bank", "amount", "des", "template"])
    })

    it("draws the platform billing QR byte for byte (the same shape sepay.policy qrImageUrl answers)", async () => {
        const subject = await buildSubject()

        expect(subject.vietQrUrl({ accountNumber: "0123", bankCode: "MB" }, 990000, "NIVO8F3K2")).toBe(
            "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
        )
    })
})
