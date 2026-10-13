import { Injectable } from "@nestjs/common"
import { CvStorage } from "./cv-storage.port"

@Injectable()
/** Until the file store binds the real adapter, CV files are neither removed, shown nor uploaded. */
export class UnavailableCvStorageService extends CvStorage {
    /** Removes nothing. */
    remove(): Promise<number> {
        return Promise.resolve(0)
    }

    /** Has no link to give. */
    signedUrl(): Promise<string | null> {
        return Promise.resolve(null)
    }

    /** Has no upload to give. */
    signedUpload(): Promise<string | null> {
        return Promise.resolve(null)
    }
}
