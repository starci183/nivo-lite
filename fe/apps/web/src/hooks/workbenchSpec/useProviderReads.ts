"use client"

import { useMemo } from "react"
import { useInstalledBlocks } from "@nivo-lite/agent-sdk/client"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { StoredSpec } from "@nivo-lite/agent-sdk/spec"
import { providerReadsOf } from "@/modules/workbench-host"

/** The reads of the provider reads (`<provider>:<read>`) a spec binds, so the spec host can run them like module reads; none when the spec binds none. */
export const useProviderReads = (spec: StoredSpec, fallback: StoredSpec | null): ReadonlyArray<ReadDefinition> => {
    const renderers = useInstalledBlocks()
    return useMemo(() => {
        const blocks = renderers.map((renderer) => renderer.block)
        return [...providerReadsOf(spec, blocks), ...(fallback === null ? [] : providerReadsOf(fallback, blocks))]
    }, [spec, fallback, renderers])
}
