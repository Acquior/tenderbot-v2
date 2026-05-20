import { z } from "zod";

export const AuditEntityTypeSchema = z.enum([
  "company_profile",
  "company_document",
  "requirement",
  "workspace",
  "form_run",
]);

export const AuditEventSchema = z.object({
  id: z.string(),
  entityType: AuditEntityTypeSchema,
  entityId: z.string(),
  action: z.string(),
  actorId: z.string(),
  payload: z.unknown().optional(),
  createdAt: z.number().int(),
  organizationId: z.string().optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
