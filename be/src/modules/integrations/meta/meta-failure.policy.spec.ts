import { Test } from "@nestjs/testing"

import type { GraphErrorFacts } from "./meta-failure.policy"

import { classifyGraphError } from "./meta-failure.policy"

const POLICY = Symbol("./meta-failure.policy")

type PolicySubject = { classifyGraphError: typeof classifyGraphError }

const facts = (partial: GraphErrorFacts): GraphErrorFacts => partial

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { classifyGraphError } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)

    return { subject }
}

describe("classifyGraphError", () => {
    it.each<[GraphErrorFacts, string]>([
        [facts({ code: 190 }), "token"],
        [facts({ status: 401 }), "token"],
        [facts({ code: 4 }), "rate_limited"],
        [facts({ code: 17 }), "rate_limited"],
        [facts({ code: 32 }), "rate_limited"],
        [facts({ code: 613 }), "rate_limited"],
        [facts({ code: 80006 }), "rate_limited"],
        [facts({ code: 80002 }), "rate_limited"],
        [facts({ status: 429 }), "rate_limited"],
        [facts({ code: 10, subcode: 2018278 }), "window_expired"],
        [facts({ code: 551 }), "recipient_unavailable"],
        [facts({ code: 100, subcode: 2018001 }), "recipient_unavailable"],
        [facts({ code: 1, subcode: 2018108 }), "recipient_unavailable"],
        [facts({ code: 10, subcode: 1 }), "permission"],
        [facts({ code: 200 }), "permission"],
        [facts({ code: 299 }), "permission"],
        [facts({ code: 1, message: "Already replied in private" }), "already_replied"],
        [facts({ code: 1, message: "private reply already sent" }), "already_replied"],
        [facts({ code: 100, subcode: 33 }), "not_found"],
        [facts({ code: 100, status: 404 }), "not_found"],
        [facts({ code: 100, subcode: 1, status: 400 }), "error"],
        [facts({ code: 199 }), "error"],
        [facts({ code: 300 }), "error"],
        [facts({}), "error"],
        [facts({ code: null, subcode: null }), "error"],
    ])("maps %j to %s", async (graph, failure) => {
        const { subject } = await buildSubject()

        expect(subject.classifyGraphError(graph)).toBe(failure)
    })
})

describe("classifyGraphError", () => {
    it.each([
        [{ code: 190 }, "token"],
        [{ status: 401 }, "token"],
        [{ code: 4 }, "rate_limited"],
        [{ code: 80006 }, "rate_limited"],
        [{ status: 429 }, "rate_limited"],
        [{ code: 10, subcode: 2018278 }, "window_expired"],
        [{ code: 551 }, "recipient_unavailable"],
        [{ code: 100, subcode: 2018001 }, "recipient_unavailable"],
        [{ subcode: 2018108 }, "recipient_unavailable"],
        [{ code: 10 }, "permission"],
        [{ code: 230 }, "permission"],
        [{ message: "This comment was already replied to privately" }, "already_replied"],
        [{ code: 100, subcode: 33 }, "not_found"],
        [{ code: 100, status: 404 }, "not_found"],
        [{ code: 100 }, "error"],
        [{}, "error"],
    ] as const)("classifies %j as %s", async (facts, expected) => {
        const { subject } = await buildSubject()

        expect(subject.classifyGraphError(facts)).toBe(expected)
    })
})
