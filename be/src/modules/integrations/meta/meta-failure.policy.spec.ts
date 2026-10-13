import type { GraphErrorFacts } from "./meta-failure.policy"
import { classifyGraphError } from "./meta-failure.policy"

const facts = (partial: GraphErrorFacts): GraphErrorFacts => partial

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
    ])("maps %j to %s", (graph, failure) => {
        expect(classifyGraphError(graph)).toBe(failure)
    })
})
