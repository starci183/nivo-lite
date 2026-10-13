import { builder } from "@starci/jest-preset"
import type { AddKnowledgeRequest } from "./dto/add-knowledge.request"
import { toAddKnowledgeRequest, toAddKnowledgeResponse } from "./add-knowledge.mapper"

const TITLE = "Opening hours"

const requestOf = builder<AddKnowledgeRequest>({
    title: TITLE,
    content: "Open from 09:00 to 18:00",
    topic: "Hours",
    visibility: "public",
    tags: ["hours", "opening"],
})

describe("add knowledge mapper", () => {
    it("copies every HTTP field and the authorization header into the command", () => {
        expect(toAddKnowledgeRequest("Bearer nvk_1", requestOf())).toEqual({
            authorization: "Bearer nvk_1",
            title: TITLE,
            content: "Open from 09:00 to 18:00",
            topic: "Hours",
            visibility: "public",
            tags: ["hours", "opening"],
        })
    })

    it("preserves absent optional fields for the service to decide", () => {
        expect(toAddKnowledgeRequest(undefined, { title: "Hours", content: "Open daily" })).toEqual({
            authorization: undefined,
            title: "Hours",
            content: "Open daily",
            topic: undefined,
            visibility: undefined,
            tags: undefined,
        })
    })

    it("wraps the accepted source id and status in data", () => {
        expect(toAddKnowledgeResponse({ id: "source-1", status: "queued" })).toEqual({
            data: { id: "source-1", status: "queued" },
        })
    })
})
