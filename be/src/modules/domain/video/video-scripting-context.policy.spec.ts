import { Test } from "@nestjs/testing"
import { videoScriptSetupText } from "./video-scripting-context.policy"

const SUBJECT = Symbol("video-scripting-context.policy")
type Subject = { videoScriptSetupText: typeof videoScriptSetupText }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { videoScriptSetupText } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("videoScriptSetupText", () => {
    it.each([null, [], { summary: 3, gates: { tone: { evidence: false } }, facts: "not facts" }])(
        "omits malformed or absent public configuration: %p",
        async (snapshot) => {
            const subject = await build()

            expect(subject.videoScriptSetupText(snapshot)).toBe("")
        },
    )

    it("renders approved gates in their fixed order and omits blank or malformed facts", async () => {
        const subject = await build()

        expect(
            subject.videoScriptSetupText({
                summary: "  Sell fresh bread  ",
                gates: {
                    approval: { evidence: " Owner approves " },
                    brand_assets: { evidence: " Blue logo " },
                    formats: { evidence: " Portrait " },
                    video_goals: { evidence: " Bring visitors " },
                    claims_limits: { evidence: " No guarantees " },
                    tone: { evidence: " Warm " },
                    private_notes: { evidence: " Not public " },
                },
                facts: [{ text: " Open daily " }, { text: " " }, null, { text: 7 }, { text: " Bread is handmade " }],
            }),
        ).toBe(
            "Sell fresh bread\ntone: Warm\nclaims_limits: No guarantees\nvideo_goals: Bring visitors\n" +
                "formats: Portrait\nbrand_assets: Blue logo\napproval: Owner approves\n" +
                "- Open daily\n- Bread is handmade",
        )
    })

    it("bounds each summary, gate and fact before joining the prompt", async () => {
        const subject = await build()

        expect(
            subject.videoScriptSetupText({
                summary: ` ${"s".repeat(1501)} `,
                gates: { tone: { evidence: ` ${"g".repeat(501)} ` } },
                facts: [{ text: ` ${"f".repeat(201)} ` }],
            }),
        ).toBe(`${"s".repeat(1500)}\ntone: ${"g".repeat(500)}\n- ${"f".repeat(200)}`)
    })

    it("takes only the first twelve facts even when later entries contain valid text", async () => {
        const subject = await build()

        expect(
            subject.videoScriptSetupText({
                facts: Array.from({ length: 13 }, (_, index) => ({ text: `Fact ${index + 1}` })),
            }),
        ).toBe(
            "- Fact 1\n- Fact 2\n- Fact 3\n- Fact 4\n- Fact 5\n- Fact 6\n" +
                "- Fact 7\n- Fact 8\n- Fact 9\n- Fact 10\n- Fact 11\n- Fact 12",
        )
    })
})

describe("videoScriptSetupText limits", () => {
    it("caps the total setup text at 3000 characters", async () => {
        const subject = await build()

        const actual = subject.videoScriptSetupText({
            summary: "s".repeat(1500),
            gates: {
                tone: { evidence: "t".repeat(500) },
                claims_limits: { evidence: "c".repeat(500) },
                video_goals: { evidence: "v".repeat(500) },
            },
            facts: [{ text: "Outside the budget" }],
        })

        expect(actual).toBe(
            `${"s".repeat(1500)}` +
                `\ntone: ${"t".repeat(500)}` +
                `\nclaims_limits: ${"c".repeat(500)}` +
                `\nvideo_goals: ${"v".repeat(463)}`,
        )
        expect(actual).toHaveLength(3000)
    })
})
