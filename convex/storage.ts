import { mutation } from "./_generated/server";
import { requireUser } from "./auth";

/**
 * Generate an upload URL for file storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});
