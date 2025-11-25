import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { internalQuery } from "./_generated/server";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

export interface AuthContext {
  clerkUserId: string;
  email?: string;
  name?: string;
}

/**
 * Ensure the request is authenticated via Clerk and return identity metadata.
 * Note: Organization support removed - this is an internal tool.
 */
export async function requireUser(ctx: AnyCtx): Promise<AuthContext> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  return {
    clerkUserId: identity.subject,
    email: identity.email,
    name: identity.name,
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

/**
 * Internal query to get current user (for use in actions)
 */
export const getCurrentUser = internalQuery({
  handler: async (ctx) => {
    return await requireUser(ctx);
  },
});
