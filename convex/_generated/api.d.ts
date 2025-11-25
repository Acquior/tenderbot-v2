/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyses from "../analyses.js";
import type * as auth from "../auth.js";
import type * as bundles from "../bundles.js";
import type * as chat from "../chat.js";
import type * as chunks from "../chunks.js";
import type * as cleanup from "../cleanup.js";
import type * as documents from "../documents.js";
import type * as geminiFileSearch from "../geminiFileSearch.js";
import type * as geminiStore from "../geminiStore.js";
import type * as ingest from "../ingest.js";
import type * as jobs from "../jobs.js";
import type * as lib_cleanupUtils from "../lib/cleanupUtils.js";
import type * as lib_jobUtils from "../lib/jobUtils.js";
import type * as lib_timeUtils from "../lib/timeUtils.js";
import type * as opportunities from "../opportunities.js";
import type * as requirements from "../requirements.js";
import type * as storage from "../storage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  analyses: typeof analyses;
  auth: typeof auth;
  bundles: typeof bundles;
  chat: typeof chat;
  chunks: typeof chunks;
  cleanup: typeof cleanup;
  documents: typeof documents;
  geminiFileSearch: typeof geminiFileSearch;
  geminiStore: typeof geminiStore;
  ingest: typeof ingest;
  jobs: typeof jobs;
  "lib/cleanupUtils": typeof lib_cleanupUtils;
  "lib/jobUtils": typeof lib_jobUtils;
  "lib/timeUtils": typeof lib_timeUtils;
  opportunities: typeof opportunities;
  requirements: typeof requirements;
  storage: typeof storage;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
