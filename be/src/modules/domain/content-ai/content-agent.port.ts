/** The answer of storing an object: no error when storage accepted it. */
export interface StoredAsset {
    /** The storage failure, or null on success. */
    readonly error: Error | null
}

/** Writes one object into a bucket, replacing an earlier one. */
export interface MarketingAssets {
    /** Stores the bytes at the path. */
    upload(bucket: string, path: string, body: Buffer, contentType: string): Promise<StoredAsset>
}
