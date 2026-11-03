import type { z } from "zod"
import { assertNamespaced } from "../block/block"
import { SdkDefinitionError } from "../block/definition-error"
import type { DataKindConfig, DataKindDefinition, EffectConfig, EffectDefinition } from "./effect.types"

/** A data kind name: kebab-case ASCII, one word group, no namespace. */
const DATA_KIND = /^[a-z][a-z0-9-]*$/

/** Defines an effect a node may run. Throws `SdkDefinitionError` (`ID_MALFORMED`) at module load. */
export const defineEffect = <P extends z.ZodType>(config: EffectConfig<P>): EffectDefinition<P> => {
    assertNamespaced(config.id)
    return { ...config, entry: "effect" }
}

/** Defines a kind of record the data ports serve. Throws `SdkDefinitionError` (`DATA_KIND_MALFORMED`) at module load. */
export const defineDataKind = <F extends z.ZodObject>(config: DataKindConfig<F>): DataKindDefinition<F> => {
    if (!DATA_KIND.test(config.kind)) throw new SdkDefinitionError("DATA_KIND_MALFORMED", config.kind)
    return { ...config, entry: "data-kind", fieldNames: Object.keys(config.fields.shape) }
}
