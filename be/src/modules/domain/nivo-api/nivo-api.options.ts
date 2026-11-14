import type { NivoApiOpGroup } from "./nivo-api-ops.contracts"

/** The NIVO data ops configuration: the op groups the app lists. */
export interface NivoApiOptions {
    /** One group per feature that declares NIVO data ops. */
    readonly groups: ReadonlyArray<NivoApiOpGroup>
}
