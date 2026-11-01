"use client"

import { useState } from "react"
import { AGENT_MODULES } from "@/modules/documents"
import type { AgentModule, BatchMeta, InstanceOption } from "@/modules/documents"
import type { DocumentVisibility } from "@/modules/types"

/** The module value of the "For" select: a type, or one instance of a type. */
const INSTANCE_PREFIX = "inst:"

/** Opens the drawer with a topic (and the visibility NIVO suggests, tags) already set: on "Write" for a suggestion, on the files for a dossier. */
export interface AddPreset {
    readonly topic: string
    readonly visibility?: DocumentVisibility
    /** Comma-separated tags the batch carries, e.g. the one that files a document under a dossier. */
    readonly tags?: string
    /** The mode the drawer opens on; "write" when absent. */
    readonly mode?: "files" | "write"
}

/** The options of the batch as the person chose them. */
interface Options {
    readonly topic: string
    readonly tags: string
    /** Who reads the batch; null until the owner chooses, there is no default. */
    readonly visibility: DocumentVisibility | null
    readonly module: AgentModule | "all"
    readonly instanceId: string | null
}

/** What the batch options give the drawer. */
interface BatchOptions extends Options {
    /** What NIVO suggests for this batch (a hint beside the choice, never preselected); null when it has no opinion. */
    readonly suggested: DocumentVisibility | null
    /** The value the "For" select shows. */
    readonly moduleValue: string
    readonly setTopic: (value: string) => void
    readonly setTags: (value: string) => void
    readonly setVisibility: (value: DocumentVisibility) => void
    readonly pickModule: (value: string | null) => void
    /** The options in the form a send needs. */
    readonly meta: () => BatchMeta
}

/** The topic, tags, visibility and agent chosen once for everything the drawer adds. */
export const useBatchOptions = (preset: AddPreset | null, instances: ReadonlyArray<InstanceOption>): BatchOptions => {
    const [options, setOptions] = useState<Options>({
        topic: preset?.topic ?? "",
        tags: preset?.tags ?? "",
        visibility: null,
        module: "all",
        instanceId: null,
    })
    const pickModule = (value: string | null) => {
        const instance = instances.find((one) => `${INSTANCE_PREFIX}${one.id}` === value)
        const module = AGENT_MODULES.find((key) => key === value) ?? "all"
        setOptions((now) =>
            instance === undefined
                ? { ...now, module, instanceId: null }
                : { ...now, module: instance.moduleKey, instanceId: instance.id },
        )
    }
    return {
        ...options,
        suggested: preset?.visibility ?? null,
        moduleValue: options.instanceId === null ? options.module : `${INSTANCE_PREFIX}${options.instanceId}`,
        setTopic: (topic) => setOptions((now) => ({ ...now, topic: topic.slice(0, 80) })),
        setTags: (tags) => setOptions((now) => ({ ...now, tags })),
        setVisibility: (visibility) => setOptions((now) => ({ ...now, visibility })),
        pickModule,
        meta: () => ({
            topic: options.topic.trim() === "" ? null : options.topic.trim(),
            tags: options.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            // The add stays disabled until the owner chooses, so a batch never leaves without a choice; internal is the narrower reader.
            visibility: options.visibility ?? "internal",
            module: options.module === "all" ? null : options.module,
            installationId: options.instanceId,
        }),
    }
}
