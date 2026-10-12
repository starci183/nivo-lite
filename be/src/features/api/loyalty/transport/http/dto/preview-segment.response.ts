/** The sample of preview segment, as a named part. */
export class PreviewSegmentSampleResponse {
    /** The id. */
    id!: string

    /** The name. */
    name!: string

    /** The tier key. */
    tierKey!: string | null
}

/** The HTTP answer of preview-segment. */
export class PreviewSegmentResponse {
    /** The total. */
    total!: number

    /** The reachable. */
    reachable!: number

    /** The sample. */
    sample!: ReadonlyArray<PreviewSegmentSampleResponse>
}
