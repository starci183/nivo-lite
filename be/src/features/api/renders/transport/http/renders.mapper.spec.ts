import { toRequestRenderRequest, toRequestRenderResponse } from "./renders.mapper"

describe("renders mapper", () => {
    it("copies the project id into the render request", () => {
        expect(toRequestRenderRequest({ projectId: "project-1" })).toEqual({ projectId: "project-1" })
    })

    it("copies the render and project ids into a separate response", () => {
        const result = { renderId: "render-1", projectId: "project-1" }
        const response = toRequestRenderResponse(result)

        expect(response).toEqual({ renderId: "render-1", projectId: "project-1" })
        expect(response).not.toBe(result)
    })
})
