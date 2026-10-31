import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"
import { signedTokenOf } from "./bridge-token.js"

const TOOL = "nivo_call"
const TIMEOUT_MS = 55_000

const text = (value) => ({ content: [{ type: "text", text: value }] })

/** Posts one NIVO tool call for the session this tool was built for and answers what the api said. */
const callOf = (url, secret, agentId, sessionKey) => async (_id, params) => {
    const name = typeof params?.tool === "string" ? params.tool : ""
    if (name === "" || /[^a-zA-Z0-9._-]/u.test(name)) return text(JSON.stringify({ error: "invalid_tool" }))
    const args = params?.args !== null && typeof params?.args === "object" ? params.args : {}
    const token = signedTokenOf(secret, agentId, sessionKey, Math.floor(Date.now() / 1000))
    try {
        const response = await fetch(`${url}/${encodeURIComponent(name)}`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(args),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        const answer = await response.text()
        return text(response.ok ? answer : JSON.stringify({ error: "refused", status: response.status }))
    } catch {
        return text(JSON.stringify({ error: "unreachable" }))
    }
}

export default definePluginEntry({
    id: "nivo-bridge",
    name: "NIVO bridge",
    description: "Gives a NIVO agent one tool, nivo_call, that runs a NIVO tool through the api for the turn that is running.",
    register(api) {
        const url = process.env.OPENCLAW_BRIDGE_URL ?? ""
        const secret = process.env.OPENCLAW_BRIDGE_SECRET ?? ""
        if (url === "" || secret === "") return
        // The agent and the session come from OpenClaw's own tool context; the model supplies the tool name and its arguments only.
        api.registerTool(
            (context) => {
                const { agentId, sessionKey } = context
                if (typeof agentId !== "string" || typeof sessionKey !== "string") return null
                return {
                    name: TOOL,
                    label: TOOL,
                    description:
                        "Run one NIVO tool. `tool` is a tool name from the tool list in your instructions, `args` its arguments as an object.",
                    parameters: {
                        type: "object",
                        additionalProperties: false,
                        required: ["tool"],
                        properties: {
                            tool: { type: "string", description: "The NIVO tool name, for example tool.search." },
                            args: { type: "object", description: "The arguments of that tool." },
                        },
                    },
                    execute: callOf(url, secret, agentId, sessionKey),
                }
            },
            { name: TOOL },
        )
    },
})
