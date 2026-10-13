/** The file store the beds are written to: one file into a bucket, replacing an earlier one at the same path; `error` is null when it was stored. */
export interface MusicStore {
    /** Writes one file into a bucket. */
    upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<{ readonly error: Error | null }>
}
