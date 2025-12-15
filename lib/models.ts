import { z } from "zod";

export type User = z.infer<typeof UserModel>;
export type Database = z.infer<typeof DatabaseModel> & { id: string };
export type Session = z.infer<typeof SessionModel> & { id: string };

export const UserModel = z.object({
  email: z.string(),
  passwordHash: z.string(),
  lastLoginAt: z.date(),
  permissions: z.array(z.string()),
  settings: z.object({
    databases: z.record(z.object({
      treeWidth: z.number().optional(),
      treeViewOpen: z.boolean().optional(),
    })).optional(),
    theme: z.string().optional(),
    prettyPrintDates: z.boolean().optional(),
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const DatabaseModel = z.object({
  slug: z.string(),
  path: z.string(),
  name: z.string(),
  type: z.enum(["memory", "file", "remote"]),
  mode: z.enum(["r", "rw"]),
  createdAt: z.date(),
  updatedAt: z.date(),
  sort: z.number().optional(),
  lastAccessedAt: z.date().optional(),
  accessToken: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  settings: z.object({
    prettyPrintDates: z.boolean().optional(),
  }).optional(),
  lastError: z.string().optional(),
  lastErrorAt: z.date().optional(),
});

export const SessionModel = z.object({
  // id removed: handled by kvdex key
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date(),
  userId: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  flash: z.record(z.any()).optional(),
  data: z.record(z.any()),
});
