import { Test } from "@nestjs/testing"
import { frameFilter } from "./brand-frame.policy"

const SUBJECT = Symbol("brand-frame.policy")

const build = async (): Promise<{ frameFilter: typeof frameFilter }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { frameFilter } }],
    }).compile()
    return moduleRef.get<{ frameFilter: typeof frameFilter }>(SUBJECT)
}

describe("frameFilter", () => {
    it("draws a primary border with a thin secondary line inside it, sized on the short side", async () => {
        const subject = await build()

        expect(subject.frameFilter("lo", "#c2996b", "#5a4632", 1080)).toBe(
            "[lo]drawbox=x=0:y=0:w=iw:h=ih:color=0xc2996b:t=24,drawbox=x=24:y=24:w=iw-48:h=ih-48:color=0x5a4632:t=4[fr]",
        )
    })

    it("keeps the border visible on a tiny frame", async () => {
        const subject = await build()

        expect(subject.frameFilter("x1", "#000000", "#ffffff", 100)).toBe(
            "[x1]drawbox=x=0:y=0:w=iw:h=ih:color=0x000000:t=4,drawbox=x=4:y=4:w=iw-8:h=ih-8:color=0xffffff:t=2[fr]",
        )
    })
})
