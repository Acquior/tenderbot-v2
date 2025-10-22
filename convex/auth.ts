import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

export interface AuthContext {
  clerkUserId: string;
  email?: string;
  organizationId?: string;
  name?: string;
}

/**
 * Ensure the request is authenticated via Clerk and return identity metadata.
 */
export async function requireUser(ctx: AnyCtx): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const tokenPayload = identity.tokenPayload as Record<string, unknown> | undefined;
  const organizationId =
    (tokenPayload?.org_id as string | undefined) ||
    (tokenPayload?.orgId as string | undefined) ||
    undefined;

  return {
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name,
    organizationId,
  };
}

/**
 * Try to resolve the user identity. Returns null instead of throwing on unauthenticated requests.
 */
export async function getOptionalUser(ctx: AnyCtx): Promise<AuthContext | null> {
  try {
    return await requireUser(ctx);
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return null;
    }
    throw error;
  }
}
