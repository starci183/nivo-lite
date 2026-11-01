import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { lineHitsOf } from "./intent-generic.policy"

const SUBJECT = Symbol("intent-generic.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { lineHitsOf } }],
    }).compile()
    return moduleRef.get<{ lineHitsOf: typeof lineHitsOf }>(SUBJECT)
}

/** The words of a domain. The registry, the pipeline and the saga are generic: a domain registers its own contract, checks and facts. */
const BANNED =
    /\b(money|lead|order|booking|loyalty|application|payment|price|invoice)\b|reply_customer|customer_reply|handoff|confirm_/iu

const productionFiles = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const path = join(folder, entry.name)
        if (entry.isDirectory()) return productionFiles(path)
        return /\.ts$/u.test(entry.name) && !/\.spec\.ts$/u.test(entry.name) ? [path] : []
    })

describe("lineHitsOf", () => {
    it("names the lines a pattern matches with their place", async () => {
        const subject = await build()

        expect(subject.lineHitsOf("a.ts", "fine\n  an order here\nfine", BANNED)).toEqual(["a.ts:2: an order here"])
        expect(subject.lineHitsOf("a.ts", "all fine", BANNED)).toEqual([])
    })
})

describe("intent-contracts holds no word of a domain", () => {
    it("has production files to read", () => {
        expect(productionFiles(__dirname).length).toBeGreaterThan(10)
    })

    it("names no domain in any production file, its comments and its messages included", async () => {
        const subject = await build()

        const found = productionFiles(__dirname).flatMap((path) =>
            subject.lineHitsOf(path, readFileSync(path, "utf8"), BANNED),
        )

        expect(found).toEqual([])
    })
})
