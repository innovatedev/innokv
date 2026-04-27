import { MigrationMap } from "../../migrations/mod.ts";
import type { MigrationMap as MigrationMapType } from "../../migrations/mod.ts";

export default MigrationMap.assert({
  "0.3.0": import("./common/reset-sessions.ts"),
  "0.4.5": import("./common/reset-sessions.ts"),
}) as MigrationMapType;
