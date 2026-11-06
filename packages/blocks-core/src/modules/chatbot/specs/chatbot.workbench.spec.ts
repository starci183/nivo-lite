import { CHATBOT_WORKBENCH_SPEC } from "./chatbot.workbench"

describe("CHATBOT_WORKBENCH_SPEC", () => {
    it("keeps search, the status filter and the chosen thread in the URL, each under its own key", () => {
        const params = CHATBOT_WORKBENCH_SPEC.params ?? {}
        expect(Object.keys(params)).toEqual(["q", "status", "selected", "pane"])
        expect(Object.values(params).map((param) => param.url)).toEqual(["q", "status", "thread", "pane"])
    })

    it("has no channel tab row: the channel is a chip on each row", () => {
        expect(JSON.stringify(CHATBOT_WORKBENCH_SPEC)).not.toContain("channel-counts")
    })

    it("lets a filter name the values of the list read, with all as the default", () => {
        const params = CHATBOT_WORKBENCH_SPEC.params ?? {}
        expect(params.status).toMatchObject({ type: "enum", of: "chatbot.threads.status", default: "all" })
    })
})
