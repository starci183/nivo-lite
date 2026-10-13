/** The private store of candidate CV files. It is also the injection token. */
export abstract class CvStorage {
    /** Removes files by path and answers how many were removed. */
    abstract remove(paths: ReadonlyArray<string>): Promise<number>
    /** A short-lived link to look at a file, or null when there is none. */
    abstract signedUrl(path: string): Promise<string | null>
    /** A one-time upload token for a path, or null when uploads are not available. */
    abstract signedUpload(path: string): Promise<string | null>
}
