import * as publicEndpoint from "../../modules/integrations/mcp/public-endpoint.policy"

/**
 * The public-address check of the MCP client refuses a loopback server by design; for a proof it answers the loopback address of
 * the one local server as its pin, and every other address as the check does. The caller restores the spy when the server closes.
 */
export const allowingLoopback = (host: string): jest.SpyInstance => {
    const check = publicEndpoint.publicAddressOf
    return jest
        .spyOn(publicEndpoint, "publicAddressOf")
        .mockImplementation((url) =>
            URL.canParse(url) && new URL(url).hostname === host
                ? Promise.resolve({ address: host, family: 4 })
                : check(url),
        )
}
