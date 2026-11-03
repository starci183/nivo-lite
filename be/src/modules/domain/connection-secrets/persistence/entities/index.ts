import { ConnectionSecretEntity } from "./connection-secret.entity"

export { ConnectionSecretEntity }

/** The entities the connection secrets capability owns, for the app's connection. */
export const connectionSecretsEntities: readonly [typeof ConnectionSecretEntity] = [ConnectionSecretEntity] as const
