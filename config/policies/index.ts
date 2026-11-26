// Every policy version ever published. Old bookings keep the version they accepted (story 006 #6).
import type { PolicyVersion } from "../../shared/config-schema";
import { v0_1_draft } from "./v0.1-draft";

export const policies: Record<string, PolicyVersion> = {
  "v0.1-draft": v0_1_draft,
};
