import { DatabaseRepository } from "../lib/Database.ts";

export interface CliState {
  repo?: DatabaseRepository;
  currentDbId?: string;
  currentDbName?: string;
  currentPath: unknown[];
  kv?: Deno.Kv;
}

export const state: CliState = {
  currentPath: [],
};
