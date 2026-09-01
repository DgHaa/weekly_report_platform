import { setupWSConnection } from 'y-websocket/bin/utils';

// Relay Yjs document updates per room (room name = weekly report id, derived from req.url).
export function handleCollabConnection(conn, req) {
  setupWSConnection(conn, req, { gc: true });
}
