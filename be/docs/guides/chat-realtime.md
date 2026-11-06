# Chat realtime: typing and activity

Both are ephemeral server-sent-event pushes of the team chat. Neither stores anything: the rooms, the members, the read cursors and the muted flag live in the team chat (`chat_rooms`, `chat_room_members`), and a client reads and changes them through the team-chat doors (`markChatRoomRead`, `setChatRoomMuted`).

## Typing

`GET /realtime/chat-typing?roomId=<uuid>` streams the typing frames of one room. The frontend streams it with its bearer token and sends transitions through the `setChatTyping(input: { roomId, typing })` mutation; it never publishes to the stream.

The mutation asks the team chat for the room as the caller sees it (`TeamChatService.room`). The caller must sit in the room as a person: otherwise it is refused as `CHAT_TYPING_ROOM_NOT_FOUND`. It then pushes one `{ id, actorId, actorName, state: start|stop, at }` frame to the stream of every other person who sits in the room, so a person outside the room, or in another workspace, never receives a frame. The topic names the recipient, the workspace and the room id (`chat-typing:<recipient>:<workspace>:room:<roomId>`), and a stream built from another principal can never subscribe it.

A start frame lapses five seconds after its time even if no stop arrives; a stop clears it at once. Refresh every three seconds while composing and send stop on send, blur, or cancellation. The stream keeps a bounded replay for `Last-Event-ID` only. An agent that works on an answer is announced by the server (`ChatTypingService.setAgent`), never by a client.

## Activity

`GET /realtime/office-activity` is one stream per member and workspace that carries every room: `{ id, kind: message|receipt|unread, roomId, at }`. A frame has no message body; the client refetches the room named by `roomId` (and its room list and unread badges). The writers call `ChatActivityService` after they stored the change, and a push that fails is logged and never fails the stored change.
