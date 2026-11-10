import { Test } from "@nestjs/testing"
import { fencedOff, newestFence } from "./checkpoint-fence.policy"

/** The members of the subject under test. */
interface Subject {
    readonly fencedOff: typeof fencedOff
    readonly newestFence: typeof newestFence
}

const SUBJECT = Symbol("checkpoint-fence.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fencedOff, newestFence } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("checkpoint-fence.policy", () => {
    it.each([
        ["a thread that holds no fence takes a writer with none", null, null, false],
        ["a thread that holds no fence takes a fenced writer", 1, null, false],
        ["the driver that holds the newest fence writes", 3, 3, false],
        ["a newer driver writes over an older one's rows", 4, 3, false],
        ["a superseded driver is refused", 2, 3, true],
        ["a writer with no fence is refused once a driver wrote", null, 0, true],
    ])("%s", async (_name, writer, newest, refused) => {
        const subject = await build()

        expect(subject.fencedOff(writer, newest)).toBe(refused)
    })

    it("finds the newest fence among a lease row and the stored rows, null where none carries one", async () => {
        const subject = await build()

        expect(subject.newestFence([null, 2, 7, null, 5])).toBe(7)
        expect(subject.newestFence([0])).toBe(0)
        expect(subject.newestFence([null, null])).toBeNull()
        expect(subject.newestFence([])).toBeNull()
    })
})
