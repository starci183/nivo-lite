import { builder, mock } from "@starci/jest-preset"
import { AuthApiError } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import { Test } from "@nestjs/testing"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseAdminClient, SupabasePublicClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT, SUPABASE_PUBLIC_CLIENT } from "./supabase.decorators"
import { SupabaseLogEvent } from "./supabase.log-events"
import { SupabaseAuthService } from "./supabase-auth.service"

const userOf = builder<User>({
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-01T00:00:00.000Z",
    email: "an@example.test",
})

/** The user with an `email` member that is present but undefined, as a provider answers for a phone-only account. */
const withoutEmail = (user: User): User => {
    Reflect.set(user, "email", undefined)
    return user
}

const found = (user: User) => ({ data: { user }, error: null })
const failed = (status: number) => ({
    data: { user: null },
    error: new AuthApiError("refused", status, "unexpected_failure"),
})

const build = async () => {
    const auth = mock<SupabaseAdminClient["auth"]>()
    const admin = mock<SupabaseAdminClient>({ auth })
    const publicClient = mock<SupabasePublicClient>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SupabaseAuthService,
            { provide: SUPABASE_ADMIN_CLIENT, useValue: admin },
            { provide: SUPABASE_PUBLIC_CLIENT, useValue: publicClient },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SupabaseAuthService), auth, publicClient, logger }
}

describe("SupabaseAuthService > accountOf", () => {
    it("reads the profile name, avatar and last sign-in", async () => {
        const { service, auth } = await build()
        auth.getUserById.mockResolvedValue(
            found(
                userOf({
                    last_sign_in_at: "2026-10-01T00:00:00.000Z",
                    user_metadata: { full_name: "An Nguyen", avatar_url: "https://img.test/a.png" },
                }),
            ),
        )

        expect(await service.accountOf("user-1")).toSucceedWith({
            id: "user-1",
            email: "an@example.test",
            lastSignInAt: "2026-10-01T00:00:00.000Z",
            avatarUrl: "https://img.test/a.png",
            uploadedAvatarUrl: null,
            displayName: "An Nguyen",
        })
        expect(auth.getUserById).toHaveBeenCalledWith("user-1")
    })
})

describe("SupabaseAuthService > accountOf choices and fallbacks", () => {
    it("prefers the uploaded HTTPS picture over the provider's and ignores any other upload value", async () => {
        const { service, auth } = await build()
        const provider = "https://img.test/google.png"
        auth.getUserById
            .mockResolvedValueOnce(
                found(userOf({ user_metadata: { avatar_url: provider, nivo_avatar_url: "https://s.test/me.png" } })),
            )
            .mockResolvedValueOnce(
                found(userOf({ user_metadata: { avatar_url: provider, nivo_avatar_url: "http://s.test/me.png" } })),
            )

        expect(await service.accountOf("u1")).toSucceedWith(
            expect.objectContaining({ avatarUrl: "https://s.test/me.png", uploadedAvatarUrl: "https://s.test/me.png" }),
        )
        expect(await service.accountOf("u2")).toSucceedWith(
            expect.objectContaining({ avatarUrl: provider, uploadedAvatarUrl: null }),
        )
    })

    it("falls back to the name claim, then the email local part, then Owner", async () => {
        const { service, auth } = await build()
        auth.getUserById
            .mockResolvedValueOnce(found(userOf({ user_metadata: { name: "Binh" } })))
            .mockResolvedValueOnce(found(userOf({ email: "chi@x.test" })))
            .mockResolvedValueOnce(found(withoutEmail(userOf())))

        expect(await service.accountOf("u1")).toSucceedWith({
            id: "user-1",
            email: "an@example.test",
            lastSignInAt: null,
            avatarUrl: null,
            uploadedAvatarUrl: null,
            displayName: "Binh",
        })
        expect(await service.accountOf("u2")).toSucceedWith({
            id: "user-1",
            email: "chi@x.test",
            lastSignInAt: null,
            avatarUrl: null,
            uploadedAvatarUrl: null,
            displayName: "chi",
        })
        expect(await service.accountOf("u3")).toSucceedWith({
            id: "user-1",
            email: "",
            lastSignInAt: null,
            avatarUrl: null,
            uploadedAvatarUrl: null,
            displayName: "Owner",
        })
    })

    it("refuses with not found when Auth cannot find the user", async () => {
        const { service, auth } = await build()
        auth.getUserById.mockResolvedValue(failed(404))

        expect(await service.accountOf("user-1")).toBeRefused(SupabaseErrorCode.AccountNotFound)
    })
})

describe("SupabaseAuthService > setUploadedAvatar", () => {
    it("keeps the upload under its own metadata key and clears it with null", async () => {
        const { service, auth } = await build()
        auth.updateUserById.mockResolvedValue(found(userOf()))

        expect(await service.setUploadedAvatar("user-1", "https://s.test/me.png")).toSucceedWith(true)
        expect(await service.setUploadedAvatar("user-1", null)).toSucceedWith(true)
        expect(auth.updateUserById).toHaveBeenNthCalledWith(1, "user-1", {
            user_metadata: { nivo_avatar_url: "https://s.test/me.png" },
        })
        expect(auth.updateUserById).toHaveBeenNthCalledWith(2, "user-1", { user_metadata: { nivo_avatar_url: null } })
    })

    it("refuses with not found when Auth cannot update the user", async () => {
        const { service, auth } = await build()
        auth.updateUserById.mockResolvedValue(failed(404))

        expect(await service.setUploadedAvatar("user-1", null)).toBeRefused(SupabaseErrorCode.AccountNotFound)
    })
})

describe("SupabaseAuthService > deliverInvite", () => {
    const redirect = "https://app.test/auth/confirm"
    it("invites a new person by account invitation", async () => {
        const { service, auth } = await build()
        auth.inviteUserByEmail.mockResolvedValue(found(userOf()))

        await expect(service.deliverInvite("new@x.test", redirect)).resolves.toBe("invited")
        expect(auth.inviteUserByEmail).toHaveBeenCalledWith("new@x.test", { redirectTo: redirect })
    })

    it("emails a sign-in link to a person who already has an account", async () => {
        const { service, auth, publicClient } = await build()
        auth.inviteUserByEmail.mockResolvedValue(failed(422))
        publicClient.sendSignInLink.mockResolvedValue(true)

        await expect(service.deliverInvite("old@x.test", redirect)).resolves.toBe("existing")
        expect(publicClient.sendSignInLink).toHaveBeenCalledWith("old@x.test", redirect)
    })

    it("delivers nothing when the sign-in link cannot be sent", async () => {
        const { service, auth, publicClient } = await build()
        auth.inviteUserByEmail.mockResolvedValue(failed(422))
        publicClient.sendSignInLink.mockResolvedValue(false)

        await expect(service.deliverInvite("old@x.test", redirect)).resolves.toBe("none")
    })

    it("logs and delivers nothing when Auth is unreachable", async () => {
        const { service, auth, logger } = await build()
        const failure = new Error("network")
        auth.inviteUserByEmail.mockRejectedValue(failure)

        await expect(service.deliverInvite("x@x.test", redirect)).resolves.toBe("none")
        expect(logger.error).toHaveBeenCalledWith(SupabaseLogEvent.InviteDeliveryFailed, failure)
    })
})
