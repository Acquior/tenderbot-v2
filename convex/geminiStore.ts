import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal query to get stored File Search store name
 */
export const getStoreName = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "gemini_file_search_store_name"))
      .first();

    return config?.value || null;
  },
});

/**
 * Internal mutation to store File Search store name
 */
export const setStoreName = internalMutation({
  args: {
    storeName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "gemini_file_search_store_name"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.storeName,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("config", {
        key: "gemini_file_search_store_name",
        value: args.storeName,
        updatedAt: Date.now(),
      });
    }
  },
});








