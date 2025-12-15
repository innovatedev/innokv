export interface InnoKvMetadata {
  version: string;
  id: string;
}

export const APP_VERSION = (import.meta as any).env?.APP_VERSION || "0.0.1";
