export interface InnoKvMetadata {
  version: string;
  id: string;
}

import denoConfig from "../deno.json" with { type: "json" };
export const APP_VERSION = denoConfig.version;
