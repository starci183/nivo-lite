import { builder } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { LessonCandidate } from "./lesson-candidates.contracts"
import {
    CONTRADICTION_MIN,
    LESSON_GROUPS_PROMPT_VERSION,
    LESSON_ITEMS_MAX,
    freeCountOf,
    lessonGroupsOf,
    lessonGroupsPrompt,
    lessonGroupsSystemOf,
    lessonItemsOf,
} from "./lesson-groups.policy"

const SUBJECT = Symbol("lesson-groups.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    freeCountOf,
                    lessonGroupsOf,
                    lessonGroupsPrompt,
                    lessonGroupsSystemOf,
                    lessonItemsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./lesson-groups.policy")>(SUBJECT)
}

/** A bicycle workshop's answered stops (synthetic: another trade than any shop of the fixtures). */
const itemOf = builder<LessonCandidate>({
    id: "b1",
    stopId: "s1",
    runId: "r1",
    agentId: "a1",
    workflowId: "w1",
    stepKey: "quote_repair",
    question: "",
    answer: "",
    answeredBy: "m1",
    answeredAt: "2026-11-01T09:00:00.000Z",
    thenDid: "completed",
    general: null,
    groupId: "g-b1",
    status: "candidate",
    changeId: null,
    factKey: null,
    factId: null,
})

/** Four stops: 1 and 3 ask the same thing in different words; 2 and 4 ask something else; their answers differ. */
const ITEMS: ReadonlyArray<LessonCandidate> = [
    itemOf({
        id: "b1",
        question: "Customer wants a flat tyre fixed on a carbon rim, what do we charge?",
        answer: "Puncture on carbon: 15 euro, tubeless plug included",
        answeredAt: "2026-11-01T09:00:00.000Z",
    }),
    itemOf({
        id: "b2",
        question: "Can a rider leave the bike over the weekend?",
        answer: "Yes, storage is free until Monday noon",
        answeredAt: "2026-11-02T09:00:00.000Z",
    }),
    itemOf({
        id: "b3",
        question: "Pricing for mending an inner tube on a race wheel?",
        answer: "same as always, Puncture on carbon: 15 euro",
        answeredAt: "2026-11-03T09:00:00.000Z",
    }),
    itemOf({
        id: "b4",
        question: "Rider asks to keep the bicycle here Saturday to Sunday",
        answer: "No, we charge 5 euro a night for storage",
        answeredAt: "2026-11-04T09:00:00.000Z",
    }),
]

/** A scripted fake model: answers the JSON it is given, whatever the prompt says. */
const modelAnswering =
    (answer: unknown) =>
    (_system: string, _user: string): unknown =>
        answer

/** The tyre group as the scripted model reads it: items 1 and 3 agree. */
const TYRE_LESSON = {
    items: [1, 3],
    answers: "agree",
    subject: "Puncture repair",
    attribute: "Price on carbon rims",
    topic: "the price of a puncture repair on a carbon rim",
    lesson: { value: "15 euro", unit: null, valid_to: null, rests_on: [1, 3] },
}

/** The storage group as the scripted model reads it: items 2 and 4 contradict. */
const STORAGE_CONTRADICTION = {
    items: [2, 4],
    answers: "contradict",
    subject: "Weekend storage",
    attribute: "Fee",
    topic: "keeping a bicycle over the weekend",
    lesson: null,
}

const read = async (answer: unknown, items: ReadonlyArray<LessonCandidate> = ITEMS, minimum = 2) => {
    const subject = await build()
    const model = modelAnswering(answer)
    return subject.lessonGroupsOf(
        model(subject.lessonGroupsSystemOf("until the end of the month"), subject.lessonGroupsPrompt(items)),
        items,
        minimum,
    )
}

describe("lesson groups policy: what one call reads", () => {
    describe("the items", () => {
        it("reads the newest items of the place, oldest first, without learned ones; the rest wait for the next call", async () => {
            const subject = await build()
            const recent = Array.from({ length: LESSON_ITEMS_MAX + 3 }, (_, index) =>
                itemOf({ id: `n${index}`, answeredAt: new Date(Date.UTC(2026, 10, 1 + index)).toISOString() }),
            )
            const learned = itemOf({ id: "old-learned", status: "learned", answeredAt: "2026-11-30T09:00:00.000Z" })

            const items = subject.lessonItemsOf([learned, ...recent.toReversed()])

            expect(items).toHaveLength(LESSON_ITEMS_MAX)
            expect(items[0]?.id).toBe("n3")
            expect(items.at(-1)?.id).toBe(`n${LESSON_ITEMS_MAX + 2}`)
            expect(items.map((one) => one.id)).not.toContain("old-learned")
            expect(subject.freeCountOf([...items, itemOf({ status: "declined" })])).toBe(LESSON_ITEMS_MAX)
        })

        it("numbers each item with its question, the founder's answer and its state", async () => {
            const subject = await build()
            const prompt = subject.lessonGroupsPrompt([
                ITEMS[0] ?? itemOf(),
                itemOf({ id: "d", status: "declined", answer: "no" }),
            ])

            expect(prompt).toContain("[1] QUESTION: Customer wants a flat tyre fixed")
            expect(prompt).toContain("OWNER'S ANSWER: Puncture on carbon: 15 euro")
            expect(prompt).toContain("[2] QUESTION:")
            expect(prompt).toContain("STATE: the owner turned a truth from it down before")
            expect(subject.lessonGroupsSystemOf("until Friday")).toContain("'until Friday'")
            // The pinned version of the call: bumped with any change of its prompt or its answer.
            expect(LESSON_GROUPS_PROMPT_VERSION).toBe("lesson-groups@1")
        })
    })
})

describe("lesson groups policy: groups come from the model's answer", () => {
    describe("the model's groups", () => {
        it("an agreeing group proposes one truth naming the answers it rests on; a contradicting group makes a question card", async () => {
            const groups = await read({ groups: [TYRE_LESSON, STORAGE_CONTRADICTION] })

            expect(groups?.dropped).toEqual([])
            expect(groups?.readings).toEqual([
                {
                    kind: "lesson",
                    items: [ITEMS[0], ITEMS[2]],
                    restsOn: [ITEMS[0], ITEMS[2]],
                    factKey: { subjectLabel: "Puncture repair", attributeLabel: "Price on carbon rims" },
                    topic: "the price of a puncture repair on a carbon rim",
                    value: "15 euro",
                    unit: null,
                    validTo: null,
                },
                {
                    kind: "contradiction",
                    items: [ITEMS[1], ITEMS[3]],
                    factKey: { subjectLabel: "Weekend storage", attributeLabel: "Fee" },
                    topic: "keeping a bicycle over the weekend",
                },
            ])
        })

        it("no code compares words: identical questions the model keeps apart make no truth, unlike ones it groups do", async () => {
            const twins = [
                itemOf({ id: "t1", question: "Chain snapped, fix it?", answer: "Fix it, 20 euro" }),
                itemOf({ id: "t2", question: "Chain snapped, fix it?", answer: "Fix it, 20 euro" }),
            ]
            const apart = await read(
                {
                    groups: [
                        {
                            ...TYRE_LESSON,
                            items: [1],
                            lesson: { ...TYRE_LESSON.lesson, value: "20 euro", rests_on: [1] },
                        },
                        {
                            ...TYRE_LESSON,
                            items: [2],
                            lesson: { ...TYRE_LESSON.lesson, value: "20 euro", rests_on: [2] },
                        },
                    ],
                },
                twins,
            )

            expect(apart?.readings).toEqual([])
            expect(apart?.dropped.map((one) => one.why)).toEqual(["too_few_answers", "too_few_answers"])
            // Items 1 and 3 share almost no words, yet the model's group stands.
            await expect(read({ groups: [TYRE_LESSON] })).resolves.toMatchObject({ readings: [{ kind: "lesson" }] })
        })

        it("a group with an answer the founder turned down before declines its new answers; one on an open card waits", async () => {
            const declined = [ITEMS[0] ?? itemOf(), itemOf({ id: "x", status: "declined" }), ITEMS[2] ?? itemOf()]
            const onCard = [
                ITEMS[0] ?? itemOf(),
                itemOf({ id: "y", status: "proposed", changeId: "ch1" }),
                ITEMS[2] ?? itemOf(),
            ]
            const group = { ...TYRE_LESSON, items: [1, 2, 3] }

            await expect(read({ groups: [group] }, declined)).resolves.toEqual({
                readings: [{ kind: "declined", items: [ITEMS[0], ITEMS[2]] }],
                dropped: [],
            })
            await expect(read({ groups: [group] }, onCard)).resolves.toEqual({
                readings: [{ kind: "waiting", items: onCard }],
                dropped: [],
            })
        })
    })
})

describe("lesson groups policy: integrity of numbers and counts", () => {
    describe("what code checks", () => {
        it("drops a group naming an unknown item, and every group sharing an item", async () => {
            const groups = await read({
                groups: [
                    { ...TYRE_LESSON, items: [1, 7] },
                    { ...TYRE_LESSON, items: [0, 3] },
                    { ...STORAGE_CONTRADICTION, items: [2, 4] },
                    { ...STORAGE_CONTRADICTION, items: [4, 3] },
                ],
            })

            expect(groups?.readings).toEqual([])
            expect(groups?.dropped).toEqual([
                { numbers: [1, 7], why: "unknown_item" },
                { numbers: [0, 3], why: "unknown_item" },
                { numbers: [2, 4], why: "item_in_two_groups" },
                { numbers: [4, 3], why: "item_in_two_groups" },
            ])
        })

        it("drops a truth resting on too few answers or outside its group, and a contradiction of one free answer", async () => {
            const groups = await read({
                groups: [
                    { ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, rests_on: [1] } },
                    { ...STORAGE_CONTRADICTION, items: [2] },
                ],
            })
            const outside = await read({
                groups: [{ ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, rests_on: [1, 2] } }],
            })

            expect(groups?.dropped.map((one) => one.why)).toEqual(["too_few_answers", "too_few_answers"])
            expect(outside?.dropped).toEqual([{ numbers: [1, 3], why: "rests_outside_group" }])
            expect(CONTRADICTION_MIN).toBe(2)
        })

        it("keeps the threshold a count: three answers required drops a truth on two", async () => {
            await expect(read({ groups: [TYRE_LESSON] }, ITEMS, 3)).resolves.toMatchObject({
                readings: [],
                dropped: [{ why: "too_few_answers" }],
            })
        })
    })
})

describe("lesson groups policy: integrity of values and shapes", () => {
    describe("what code checks", () => {
        it("a truth's value must stand verbatim in one of the answers it rests on (case and spaces folded)", async () => {
            const invented = await read({
                groups: [{ ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, value: "12 euro" } }],
            })
            const folded = await read({
                groups: [{ ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, value: "puncture  on CARBON: 15 euro" } }],
            })
            // Item 2's words are not among the answers the truth rests on.
            const elsewhere = await read({
                groups: [
                    { ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, value: "storage is free until Monday noon" } },
                ],
            })

            expect(invented?.dropped).toEqual([{ numbers: [1, 3], why: "value_not_said" }])
            expect(folded?.readings).toMatchObject([{ kind: "lesson", value: "puncture  on CARBON: 15 euro" }])
            expect(elsewhere?.dropped).toEqual([{ numbers: [1, 3], why: "value_not_said" }])
        })

        it("keeps the shape guards: engine ids and customer data are refused, a stated end is a day", async () => {
            const ids = await read({ groups: [{ ...TYRE_LESSON, subject: "nivo.tool.repair.quote" }] })
            const customer = await read({
                groups: [{ ...TYRE_LESSON, attribute: "Price for +44 7700 900123" }],
            })
            const dated = await read({
                groups: [{ ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, valid_to: "2026-12-31" } }],
            })
            const undated = await read({
                groups: [{ ...TYRE_LESSON, lesson: { ...TYRE_LESSON.lesson, valid_to: "end of year" } }],
            })

            expect(ids?.dropped.map((one) => one.why)).toEqual(["not_shop_words"])
            expect(customer?.dropped.map((one) => one.why)).toEqual(["customer_data"])
            expect(dated?.readings).toMatchObject([{ validTo: "2026-12-31" }])
            expect(undated?.readings).toMatchObject([{ validTo: null }])
        })

        it("an answer that is not the expected JSON is a failed try; a malformed group is dropped", async () => {
            await expect(read(null)).resolves.toBeNull()
            await expect(read({ verdict: "draft" })).resolves.toBeNull()
            await expect(read({ groups: [] })).resolves.toEqual({ readings: [], dropped: [] })
            await expect(
                read({
                    groups: [
                        "tyres",
                        { ...TYRE_LESSON, items: [1, "3"] },
                        { ...TYRE_LESSON, answers: "maybe" },
                        { ...TYRE_LESSON, lesson: null },
                    ],
                }),
            ).resolves.toEqual({
                readings: [],
                dropped: [
                    { numbers: [], why: "malformed" },
                    { numbers: [], why: "malformed" },
                    { numbers: [1, 3], why: "item_in_two_groups" },
                    { numbers: [1, 3], why: "item_in_two_groups" },
                ],
            })
            await expect(read({ groups: [{ ...TYRE_LESSON, answers: "maybe" }] })).resolves.toMatchObject({
                dropped: [{ why: "malformed" }],
            })
            await expect(read({ groups: [{ ...TYRE_LESSON, lesson: null }] })).resolves.toMatchObject({
                dropped: [{ why: "no_lesson" }],
            })
        })
    })
})
