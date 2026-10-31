import { LocalStorage, StorageId } from "@/modules/storage"

/** What the browser remembers of a batch while its bytes travel: the file names and when the batch began. */
interface UploadMarker {
    readonly names: ReadonlyArray<string>
    readonly at: number
}

const isMarker = (value: unknown): value is UploadMarker =>
    typeof value === "object" &&
    value !== null &&
    "names" in value &&
    Array.isArray(value.names) &&
    value.names.every((name: unknown) => typeof name === "string") &&
    "at" in value &&
    typeof value.at === "number"

/** Notes the files whose bytes are about to travel: a page that reloads before the batch ends finds them here. */
export const rememberUploads = (names: ReadonlyArray<string>, at: number): void => {
    LocalStorage.set(StorageId.UploadInFlight, { names, at })
}

/** The batch ended (or was dismissed): nothing is on its way. */
export const forgetUploads = (): void => {
    LocalStorage.remove(StorageId.UploadInFlight)
}

/** The names of the files an earlier page was uploading when it went away: those uploads stopped, and the bytes are gone with the page. */
export const interruptedUploads = (): ReadonlyArray<string> => {
    const held = LocalStorage.get<unknown>(StorageId.UploadInFlight)
    return isMarker(held) ? held.names : []
}
