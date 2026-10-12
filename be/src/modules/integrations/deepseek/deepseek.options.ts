/** The prompt library's tunables, parsed once at boot. */
export interface DeepseekOptions {
    /** How many times a JSON prompt is asked again when the model answered in prose. */
    readonly jsonRetries: number
}
