"use client"

import { useState } from "react"
import { AGENT_MODULES, type InstanceOption } from "@/modules/documents"
import type { AddPreset, BatchOptionFields, BatchOptions } from "@/hooks/knowledgeAddTypes"

/** The module value of the "For" select: a type, or one instance of a type. */
const INSTANCE_PREFIX = "inst:"

/** The topic, tags and agent chosen once for everything the drawer adds. */
export const useBatchOptions = (preset: AddPreset | null, instances: ReadonlyArray<InstanceOption>): BatchOptions => {
    const [options, setOptions] = useState<BatchOptionFields>({
        topic: preset?.topic ?? "",
        tags: preset?.tags ?? "",
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
        moduleValue: options.instanceId === null ? options.module : `${INSTANCE_PREFIX}${options.instanceId}`,
        setTopic: (topic) => setOptions((now) => ({ ...now, topic: topic.slice(0, 80) })),
        setTags: (tags) => setOptions((now) => ({ ...now, tags })),
        pickModule,
        meta: () => ({
            topic: options.topic.trim() === "" ? null : options.topic.trim(),
            tags: options.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            module: options.module === "all" ? null : options.module,
            installationId: options.instanceId,
        }),
    }
}
