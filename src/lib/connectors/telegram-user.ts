import "server-only";
import type { Connector } from "../data-hub";

/** Personal Telegram (MTProto user session), read only, chats the owner picked: new messages become hub messages. */
export const connector: Connector = {
  sync: async () => {
    throw new Error("Kết nối này đang được hoàn thiện.");
  },
};
