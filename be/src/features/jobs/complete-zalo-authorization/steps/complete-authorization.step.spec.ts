import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    ChannelsError,
    ChannelsErrorCode,
    ZALO_AUTHORIZATION_FAILED_REASON,
    ZaloCredentialsService,
} from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import { ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { CompleteAuthorizationStep } from "./complete-authorization.step"

const claimed = (
    payload: object = {
        workspaceId: "workspace-1",
        state: "connection-1.nonce-1.extra",
        code: "authorization-code",
        oaId: "oa-1",
    },
): ClaimedJob => ({
    jobId: "authorization-job-1",
    kind: "zalo_authorization",
    fencingToken: 11,
    currentStep: null,
    payload,
})

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const credentials = mock<ZaloCredentialsService>()
    credentials.completeAuthorization.mockResolvedValue("connection-1")
    const connections = mock<ConnectionsService>()
    connections.markFailing.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CompleteAuthorizationStep,
            { provide: ZaloCredentialsService, useValue: credentials },
            { provide: ConnectionsService, useValue: connections },
        ],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(CompleteAuthorizationStep), claims, credentials, connections }
}

describe("CompleteAuthorizationStep", () => {
    it("awaits the complete advance under the held fencing token before exchanging the authorization", async () => {
        const { step, claims, credentials, connections } = await build()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimed())

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "authorization-job-1", expectedFencingToken: 11, step: "complete" }],
        ])
        expect(credentials.completeAuthorization).not.toHaveBeenCalled()
        expect(connections.markFailing).not.toHaveBeenCalled()

        release()

        await expect(running).resolves.toBeUndefined()
        expect(credentials.completeAuthorization.mock.calls).toEqual([
            ["workspace-1", { state: "connection-1.nonce-1.extra", code: "authorization-code", oaId: "oa-1" }],
        ])
        expect(connections.markFailing).not.toHaveBeenCalled()
    })

    it("does nothing after the advance for a payload that is not a Zalo authorization", async () => {
        const { step, claims, credentials, connections } = await build()

        await expect(step.run(claimed({ withinMs: 3_600_000 }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "authorization-job-1", expectedFencingToken: 11, step: "complete" }],
        ])
        expect(credentials.completeAuthorization).not.toHaveBeenCalled()
        expect(connections.markFailing).not.toHaveBeenCalled()
    })

    it.each([
        { oaId: null, input: { state: "connection-1.nonce-1", code: "authorization-code" } },
        { oaId: "", input: { state: "connection-1.nonce-1", code: "authorization-code", oaId: "" } },
    ])("passes the OA id only when it is not null: $oaId", async ({ oaId, input }) => {
        const { step, credentials, connections } = await build()

        await expect(
            step.run(
                claimed({
                    workspaceId: "workspace-1",
                    state: "connection-1.nonce-1",
                    code: "authorization-code",
                    oaId,
                }),
            ),
        ).resolves.toBeUndefined()

        expect(credentials.completeAuthorization.mock.calls).toEqual([["workspace-1", input]])
        expect(connections.markFailing).not.toHaveBeenCalled()
    })

    it("propagates a fenced-out advance before exchanging or marking the connection", async () => {
        const { step, claims, credentials, connections } = await build()
        const failure = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "authorization-job-1", expectedFencingToken: 11, step: "complete" }],
        ])
        expect(credentials.completeAuthorization).not.toHaveBeenCalled()
        expect(connections.markFailing).not.toHaveBeenCalled()
    })

    it("handles a ChannelsError by marking the connection id before the first dot as failing", async () => {
        const { step, credentials, connections } = await build()
        credentials.completeAuthorization.mockRejectedValue(
            new ChannelsError({ code: ChannelsErrorCode.ZaloStateRejected }),
        )

        await expect(step.run(claimed())).resolves.toBeUndefined()

        expect(credentials.completeAuthorization.mock.calls).toEqual([
            ["workspace-1", { state: "connection-1.nonce-1.extra", code: "authorization-code", oaId: "oa-1" }],
        ])
        expect(connections.markFailing.mock.calls).toEqual([["connection-1", ZALO_AUTHORIZATION_FAILED_REASON]])
    })

    it.each(["/v4/oa/access_token", ""])(
        "handles a Zalo refusal carrying the path %p without throwing",
        async (path) => {
            const { step, credentials, connections } = await build()
            credentials.completeAuthorization.mockRejectedValue(
                new ZaloError({ code: ZaloErrorCode.Rejected, params: { path } }),
            )

            await expect(step.run(claimed())).resolves.toBeUndefined()

            expect(credentials.completeAuthorization.mock.calls).toEqual([
                ["workspace-1", { state: "connection-1.nonce-1.extra", code: "authorization-code", oaId: "oa-1" }],
            ])
            expect(connections.markFailing.mock.calls).toEqual([["connection-1", ZALO_AUTHORIZATION_FAILED_REASON]])
        },
    )

    it("uses an empty connection id when a state accessor changes after validation and splits to no parts", async () => {
        const { step, credentials, connections } = await build()
        const state = mock<Pick<string, "split">>()
        state.split.mockReturnValue([])
        let stateReads = 0
        const payload = {
            workspaceId: "workspace-1",
            get state() {
                stateReads += 1
                return stateReads === 1 ? "connection-1.nonce-1" : state
            },
            code: "authorization-code",
            oaId: null,
        }
        credentials.completeAuthorization.mockRejectedValue(
            new ChannelsError({ code: ChannelsErrorCode.ZaloStateRejected }),
        )

        await expect(step.run(claimed(payload))).resolves.toBeUndefined()

        expect(stateReads).toBe(2)
        expect(credentials.completeAuthorization.mock.calls).toEqual([
            ["workspace-1", { state, code: "authorization-code" }],
        ])
        expect(state.split.mock.calls).toEqual([["."]])
        expect(connections.markFailing.mock.calls).toEqual([["", ZALO_AUTHORIZATION_FAILED_REASON]])
    })

    it.each([
        new Error("credentials unavailable"),
        new ZaloError({ code: ZaloErrorCode.Unavailable }),
        new ZaloError({ code: ZaloErrorCode.Rejected }),
        { params: { path: "/v4/oa/access_token" } },
    ])("rethrows a failure that is neither a ChannelsError nor a Zalo refusal: %p", async (failure) => {
        const { step, credentials, connections } = await build()
        credentials.completeAuthorization.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(credentials.completeAuthorization.mock.calls).toEqual([
            ["workspace-1", { state: "connection-1.nonce-1.extra", code: "authorization-code", oaId: "oa-1" }],
        ])
        expect(connections.markFailing).not.toHaveBeenCalled()
    })

    it("propagates a failure to persist the failing connection", async () => {
        const { step, credentials, connections } = await build()
        credentials.completeAuthorization.mockRejectedValue(
            new ChannelsError({ code: ChannelsErrorCode.ZaloStateExpired }),
        )
        const failure = new Error("connection write unavailable")
        connections.markFailing.mockRejectedValue(failure)

        await expect(step.run(claimed())).rejects.toBe(failure)

        expect(connections.markFailing.mock.calls).toEqual([["connection-1", ZALO_AUTHORIZATION_FAILED_REASON]])
    })
})
