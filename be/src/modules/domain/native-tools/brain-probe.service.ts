import { Injectable } from "@nestjs/common"
import { ToolsError, ToolsErrorCode, invalidArguments, type NativeCaller, type NativeToolFamily, type ToolJson } from "@modules/domain/tools"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { isRecord } from "@modules/platform/primitives"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { BrainNativeService } from "./brain-native.service"
import { PassageNativeService } from "./passage-native.service"

/**
 * The Brain READS an owner may probe: exactly the tools every AI step holds for the truth graph that answer through the caller's lens
 * and write nothing (`DEFAULT_AI_READ_TOOLS` without the whole-document read, the conversation and the contact). A closed list of
 * tool ids, never a pattern: a tool that writes, sends or reads another store cannot be reached through the probe.
 */
export const BRAIN_PROBE_TOOLS: ReadonlyArray<string> = [
    TOOL.brainSearch,
    TOOL.brainFactList,
    TOOL.brainFactGet,
    TOOL.brainFactRelated,
    TOOL.brainPassageSearch,
    TOOL.brainPassageRead,
]

/** What one probe asks. */
export interface BrainProbe {
    /** The agent the tool is run as: its module and instance give the lens, as in a run of that agent. */
    readonly agentId: string
    /** The tool id, one of `BRAIN_PROBE_TOOLS`. */
    readonly tool: string
    /** The arguments as the model would write them: the text of one JSON object. */
    readonly arguments: string
    /** A customer conversation the call would serve: the lens then narrows to the public, as in a customer turn. Absent: none. */
    readonly conversationId?: string | null | undefined
}

/** What one probe answers. */
export interface BrainProbeAnswer {
    /** The tool that ran. */
    readonly tool: string
    /** True when the tool answered; false when it refused an expected case (`refusal` says which). */
    readonly ok: boolean
    /** The tool's own answer, as the JSON text the model would read; null when it refused. */
    readonly answer: string | null
    /** The typed reason of an expected refusal (`not_found`, `internal_only`), or null. */
    readonly refusal: string | null
    /** How long the tool took, milliseconds. */
    readonly ms: number
}

/** The arguments of a probe: the text read as ONE JSON object, or null when it is anything else. */
export const probeArgumentsOf = (text: string): ToolJson | null => {
    try {
        const read: unknown = JSON.parse(text)
        return isRecord(read) && !Array.isArray(read) ? read : null
    } catch {
        return null
    }
}

/** The name a family knows a tool by: the id without the namespace of its manifest, or null when the id is not of that namespace. */
const familyToolOf = (family: NativeToolFamily, tool: string): string | null => {
    const prefix = `${family.manifest.namespace}.`
    if (!tool.startsWith(prefix)) return null
    const name = tool.slice(prefix.length)
    return family.manifest.tools.some((declared) => declared.name === name) ? name : null
}

@Injectable()
/**
 * THE PROBE of the agents' Brain reads (Round W: the search bar was measured through "try asking", whose truth half is a word
 * search and whose passages are mixed with the base knowledge; no door ran what an agent's tools run without a model turn). It runs
 * ONE read tool of the truth graph through the SAME family code an AI step's call reaches (`BrainNativeService` /
 * `PassageNativeService.invoke`: the agent's lens, the question's one embedding, words and meaning, the lines served), as the agent
 * the owner names, and answers the tool's own JSON. No model is called and nothing is written but the usage of the embedding. The
 * OWNER of the workspace alone may use it (a test and inspection door: it shows what the internal lens reads); it is no customer
 * surface and no tool. What it does NOT run is the gateway around the family (grants, the node mode, the audit line): those decide
 * whether a step may call a tool, not what a search finds.
 */
export class BrainProbeService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly brain: BrainNativeService,
        private readonly passages: PassageNativeService,
    ) {}

    /** Runs one Brain read as an agent, for the owner. A tool outside the list or arguments that are no JSON object are refused as invalid. */
    async run(userId: string, workspaceId: string, probe: BrainProbe): Promise<BrainProbeAnswer> {
        await this.members.require(userId, workspaceId, ["owner"])
        const args = probeArgumentsOf(probe.arguments)
        const target = BRAIN_PROBE_TOOLS.includes(probe.tool) ? this.targetOf(probe.tool) : null
        if (args === null || target === null) throw invalidArguments(probe.tool)
        const caller: NativeCaller = { agentId: probe.agentId, conversationId: probe.conversationId ?? null }
        const started = this.clock.now().getTime()
        const took = (): number => this.clock.now().getTime() - started
        try {
            const answer = await target.family.invoke(workspaceId, target.name, args, caller)
            return { tool: probe.tool, ok: true, answer: JSON.stringify(answer), refusal: null, ms: took() }
        } catch (cause) {
            // An expected refusal of the family is an answer, as it is for the model; anything else is a failure and is thrown.
            if (!(cause instanceof ToolsError) || cause.code !== ToolsErrorCode.NativeRefused) throw cause
            const reason = cause.params["reason"]
            return { tool: probe.tool, ok: false, answer: null, refusal: typeof reason === "string" ? reason : null, ms: took() }
        }
    }

    /** The family that declares the tool and the name it knows it by. */
    private targetOf(tool: string): { readonly family: NativeToolFamily; readonly name: string } | null {
        for (const family of [this.passages, this.brain]) {
            const name = familyToolOf(family, tool)
            if (name !== null) return { family, name }
        }
        return null
    }
}
