import type { GatewaySocket } from "./gateway.client"

/** Reads the text of one WebSocket message event; a binary frame is decoded as UTF-8. */
const textOf = (data: unknown): string => {
    if (typeof data === "string") return data
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8")
    return String(data)
}

/** Opens the platform WebSocket to the gateway and narrows it to the surface a turn uses. */
export const createGatewaySocket = (url: string): GatewaySocket => {
    const socket = new WebSocket(url)
    return {
        send: (data) => socket.send(data),
        close: () => socket.close(),
        onMessage: (listener) => socket.addEventListener("message", (event) => listener(textOf(event.data))),
        onError: (listener) => socket.addEventListener("error", (event) => listener(event.type)),
        onClose: (listener) => socket.addEventListener("close", (event) => listener(event.code)),
    }
}
