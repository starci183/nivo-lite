import type { AvatarUpload } from "@modules/domain/avatars"
import type { RequestMyAvatarUploadRequest } from "../../application/request-my-avatar-upload.contracts"
import type { RevokeSessionRequest } from "../../application/revoke-session.contracts"
import type { SetMyAvatarRequest } from "../../application/set-my-avatar.contracts"
import type { UpdateProfileRequest } from "../../application/update-profile.contracts"
import type { MyAvatarUploadType } from "./dto/my-avatar-upload.type"
import type { RequestMyAvatarUploadInput } from "./dto/request-my-avatar-upload.input"
import type { RevokeSessionInput } from "./dto/revoke-session.input"
import type { SetMyAvatarInput } from "./dto/set-my-avatar.input"
import type { UpdateProfileInput } from "./dto/update-profile.input"

/** Maps the GraphQL input to the sign-out request of one device. */
export const toRevokeSessionRequest = (input: RevokeSessionInput): RevokeSessionRequest => ({
    sessionId: input.sessionId,
})

/** Maps the GraphQL input to the rename request. */
export const toUpdateProfileRequest = (input: UpdateProfileInput): UpdateProfileRequest => ({
    name: input.name,
})

/** Maps the GraphQL input to the picture upload request. */
export const toRequestMyAvatarUploadRequest = (input: RequestMyAvatarUploadInput): RequestMyAvatarUploadRequest => ({
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
})

/** Maps the upload address to the GraphQL type. */
export const toMyAvatarUploadType = (upload: AvatarUpload): MyAvatarUploadType => ({ ...upload })

/** Maps the GraphQL input to the request that sets or removes the picture. */
export const toSetMyAvatarRequest = (input: SetMyAvatarInput): SetMyAvatarRequest => ({ path: input.path })
