import { Query } from "@nestjs/cqrs"
import type { ContentLibraryFile } from "@modules/domain/content-media"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListContentMediaLibraryRequest } from "./list-content-media-library.contracts"

/** Asks for the files in the caller's workspace media library. */
export class ListContentMediaLibraryQuery extends Query<ReadonlyArray<ContentLibraryFile>> {
    constructor(readonly params: ExecuteParams<ListContentMediaLibraryRequest>) {
        super()
    }
}
