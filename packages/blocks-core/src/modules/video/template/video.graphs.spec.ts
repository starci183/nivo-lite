import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { templateNodeListMismatches } from "@nivo-lite/agent-sdk/testing"
import { videoProduceGraph } from "./produce.graph"
import { videoAgent } from "./video.agent"

/**
 * The Video agent and its `video.produce` graph. Importing them is the first check: the builders throw at module load with every
 * problem decidable without the engine (refs, routes, reachability, accounts against the agent's providers).
 */

describe("the Video agent", () => {
    it("works with the speech, the video and the compose accounts and makes videos with its one primary graph", () => {
        expect(videoAgent.key).toBe("video")
        expect(videoAgent.accounts).toEqual([PROVIDER.elevenlabs, PROVIDER.veo, PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video])
        expect(videoAgent.primary).toBe("video.produce")
        expect(videoAgent.graphs).toEqual([videoProduceGraph])
    })
})

describe("video.produce", () => {
    const steps = videoProduceGraph.spec.nodes

    it("starts on another workflow's call alone: no team chat line wakes it", () => {
        expect(videoProduceGraph.spec.triggers).toEqual([{ verb: TRIGGER.workflowCalled }])
    })

    it("scripts, starts a clip per scene, waits for the clips, keeps them, voices the script, composes one video, keeps it, reviews and publishes", () => {
        expect(steps.filter((step) => step.loop === undefined).map((step) => step.key)).toEqual([
            "script",
            "script-declined",
            "script-declined-notice",
            "scenes",
            "scenes-declined",
            "scenes-declined-notice",
            "clips-wait",
            "made",
            "keep",
            "keep-declined",
            "keep-declined-notice",
            "voice",
            "voice-declined",
            "voice-declined-notice",
            "links",
            "compose",
            "compose-declined",
            "compose-declined-notice",
            "composed",
            "render-poll",
            "checked",
            "output",
            "output-declined",
            "output-declined-notice",
            "review",
            "review-declined",
            "review-declined-notice",
            "publish",
            "publish-declined",
            "declined-notice",
            "stuck",
            "compose-stuck",
            "render-stuck",
            "published",
            "declined",
            "failed",
        ])
    })

    it("waits for the clips two minutes apart, at most ten rounds, and reports a wait that ran out", () => {
        expect(steps.find((step) => step.key === "clips-wait")).toMatchObject({
            kind: "loop",
            params: { mode: "until", max: 10, every: { minutes: 2 } },
        })
    })

    it("reads the render at the compose service every six minutes, at most ten times, and reports a render that ran out", () => {
        expect(steps.find((step) => step.key === "render-poll")).toMatchObject({
            kind: "loop",
            params: { mode: "until", max: 10, every: { minutes: 6 } },
        })
    })

    it("ends the run declined, after telling the team, when a person declines the script, a scene, the clips, the narration, the composing, the stored video or the move to review", () => {
        const routes = [
            ["script", "scenes", "script-declined-notice"],
            ["keep", "voice", "keep-declined-notice"],
            ["voice", "links", "voice-declined-notice"],
            ["compose", "composed", "compose-declined-notice"],
            ["output", "review", "output-declined-notice"],
            ["review", "publish", "review-declined-notice"],
        ] as const
        for (const [step, onward, notice] of routes) {
            expect(steps.find((candidate) => candidate.key === step)).toMatchObject({ next: `${step}-declined` })
            expect(steps.find((candidate) => candidate.key === `${step}-declined`)).toMatchObject({
                kind: "if",
                routes: { yes: notice, no: onward },
            })
            expect(steps.find((candidate) => candidate.key === notice)).toMatchObject({ next: "declined" })
        }
        expect(steps.find((step) => step.key === "scenes")).toMatchObject({ next: "scenes-declined" })
        expect(steps.find((step) => step.key === "scenes-declined")).toMatchObject({
            kind: "if",
            routes: { yes: "scenes-declined-notice", no: "clips-wait" },
        })
        expect(steps.find((step) => step.key === "scenes-declined-notice")).toMatchObject({ next: "declined" })
        expect(steps.filter((step) => step.kind === "outcome").map((step) => step.key)).toEqual(["published", "declined", "failed"])
    })

    it("asks a person before the video is published, and runs every other step on its own", () => {
        const modes = Object.fromEntries([...videoProduceGraph.nodes.values()].map((node) => [node.id, node.mode]))
        expect(modes).toMatchObject({
            "video.script": "auto",
            "video.scenes": "auto",
            "video.result": "auto",
            "video.keep": "auto",
            "video.voice": "auto",
            "video.links": "auto",
            "video.compose": "auto",
            "video.render-check": "auto",
            "video.output": "auto",
            "video.review": "auto",
            "video.publish": "ask",
            "video.stuck": "auto",
        })
    })

    it("acts through the speech account to voice, the video account to generate and the compose accounts (ordered alternatives) to join; linking and keeping the files need no account", () => {
        const accounts = Object.fromEntries([...videoProduceGraph.nodes.values()].map((node) => [node.id, node.accounts]))
        expect(accounts).toMatchObject({
            "video.voice": [PROVIDER.elevenlabs],
            "video.scenes": [PROVIDER.veo],
            "video.result": [PROVIDER.veo],
            "video.keep": [],
            "video.links": [],
            "video.compose": [PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video],
            "video.render-check": [PROVIDER.shotstack, PROVIDER.creatomate, PROVIDER.json2video],
            "video.output": [],
        })
    })


    it("runs every worked example of its nodes as it promises", async () => {
        await expect(templateNodeListMismatches([...videoProduceGraph.nodes.values()])).resolves.toEqual({})
    })
})
