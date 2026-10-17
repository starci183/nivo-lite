import { FakeClock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { MetaReceiptPolicy } from "./meta-receipt.policy"

it("parses locally and uses the injected clock when a provider omits its timestamp", async () => {
    const at = new Date("2026-10-12T03:00:00.000Z")
    const moduleRef = await Test.createTestingModule({
        providers: [MetaReceiptPolicy, { provide: CLOCK, useValue: new FakeClock(at) }],
    }).compile()
    const subject = moduleRef.get(MetaReceiptPolicy)
    expect(subject.parse({})).toEqual([])
    expect(
        subject.parse({
            object: "page",
            entry: [
                {
                    id: "page-1",
                    messaging: [{ sender: { id: "person-1" }, message: { mid: "message-1", text: "Hello" } }],
                },
            ],
        }),
    ).toEqual([
        expect.objectContaining({ text: "Hello", timestamp: at.getTime(), page_id: "page-1", sender_psid: "person-1" }),
    ])
})
