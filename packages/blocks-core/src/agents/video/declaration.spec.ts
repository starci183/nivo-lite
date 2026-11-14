import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import type { SpecNode } from "@nivo-lite/agent-sdk/spec"
import { coreBlocks } from "../../shared/blocks/core-blocks"
import { platformModule } from "../../shared/platform"
import { videoModule } from "./declaration"
import { VIDEO_FIXTURES } from "./fixtures/video.fixtures"
import { VIDEO_WORKBENCH_SPEC } from "./workbench/specs/video.workbench"

/** Every node of the workbench, depth first. */
const nodesOf = (node: SpecNode): ReadonlyArray<SpecNode> => [node, ...(node.children ?? []).flatMap(nodesOf)]

const workbenchNodes: ReadonlyArray<SpecNode> = VIDEO_WORKBENCH_SPEC.views.flatMap((view) => nodesOf(view.root))

describe("video module", () => {
    it("draws its workbench with the core blocks and its own reads and actions", () => {
        expect(seedSpecProblems(videoModule, coreBlocks, [videoModule, platformModule])).toEqual([])
    })

    it("holds a fixture for every read and none for a read it does not declare", () => {
        const reads = videoModule.reads.map((read) => read.id).sort()
        expect(Object.keys(VIDEO_FIXTURES.reads).sort()).toEqual(reads)
    })

    it("has no file upload: the files of a render are made by the providers, the workbench only shows them", () => {
        expect(workbenchNodes.find((node) => node.block === "core.file-upload")).toBeUndefined()
    })

    it("previews the chosen render's composed video, its clips (a list field) and its narration with the preview block, over the render read", () => {
        const previews = workbenchNodes.filter((node) => node.block === "core.file-preview")
        expect(previews.map((node) => node.props)).toMatchObject([
            { type: "blocks-core.video.render", field: "output" },
            { type: "blocks-core.video.render", field: "clips" },
            { type: "blocks-core.video.render", field: "voice" },
        ])
        for (const preview of previews)
            expect(preview.bind?.["record"]).toEqual({ read: "blocks-core.video.api.render.get", variables: { id: "$render" } })
    })
})
