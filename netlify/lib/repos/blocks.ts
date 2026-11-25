// Blocked times: blocks/<id>. Plain set and delete (ADR 0002 key scheme).
import { randomInt } from "node:crypto";
import type { KvStore } from "../store/kv";
import type { BlockedTime } from "../../../shared/models";

const key = (id: string) => `blocks/${id}`;
const ID_RE = /^blk_[a-z0-9]{8}$/;
export const isBlockId = (id: string): boolean => ID_RE.test(id);

export function newBlockId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "blk_";
  for (let i = 0; i < 8; i++) out += chars[randomInt(chars.length)];
  return out;
}

export async function listBlocks(store: KvStore): Promise<BlockedTime[]> {
  const keys = await store.list("blocks/");
  const rows = await Promise.all(keys.map((k) => store.get<BlockedTime>(k)));
  return rows.flatMap((r) => (r ? [r.value] : [])).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}
export async function getBlock(store: KvStore, id: string): Promise<BlockedTime | null> {
  return isBlockId(id) ? ((await store.get<BlockedTime>(key(id)))?.value ?? null) : null;
}
export async function putBlock(store: KvStore, block: BlockedTime): Promise<void> {
  await store.set(key(block.id), block);
}
export async function deleteBlock(store: KvStore, id: string): Promise<void> {
  await store.delete(key(id));
}
