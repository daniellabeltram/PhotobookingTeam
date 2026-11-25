// Picks the store driver from the validated environment. The production/namespace guards live in env.ts.
import type { Env } from "../env";
import { FileKvStore } from "./file";
import type { KvStore } from "./kv";
import { MemoryKvStore } from "./memory";
import { NetlifyBlobsKv } from "./netlify-blobs";

export function createStore(env: Pick<Env, "storeDriver" | "dataDir" | "dataNamespace">): KvStore {
  switch (env.storeDriver) {
    case "memory":
      return new MemoryKvStore();
    case "file":
      return new FileKvStore(env.dataDir);
    case "netlify-blobs":
      return new NetlifyBlobsKv(env.dataNamespace as string);
  }
}
