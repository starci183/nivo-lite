import { defineInstallation } from "@nivo-lite/agent-sdk/installation"
import { defineAgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import { z } from "zod"
import { installedPluginsOf } from "./installed-plugins.policy"

const CARD = defineAgentMessageKind({
    id: "fixpkg.card",
    payload: z.object({ no: z.string() }),
    actions: { approve: false, edit: "none", reject: false },
})

describe("installedPluginsOf message kinds", () => {
    const installed = installedPluginsOf(defineInstallation([{ messageKinds: [CARD] }], "h"))

    it("answers a kind a plugin registers", () => {
        expect(installed.messageKindOf("fixpkg.card")).toBe(CARD)
    })

    it("does not answer the SDK core kinds: they are the engine's own, never a plugin's card", () => {
        expect(installed.messageKindOf("message.text")).toBeNull()
    })

    it("answers null for a kind nobody declares", () => {
        expect(installed.messageKindOf("fixpkg.other")).toBeNull()
        expect(installedPluginsOf(defineInstallation([], "h")).messageKindOf("fixpkg.card")).toBeNull()
    })
})
