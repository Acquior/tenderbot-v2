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
import type * as auditEvents from "../auditEvents.js";
import type * as auth from "../auth.js";
import type * as bundles from "../bundles.js";
import type * as chat from "../chat.js";
import type * as chunks from "../chunks.js";
import type * as cleanup from "../cleanup.js";
import type * as companyDocuments from "../companyDocuments.js";
import type * as companyFieldVerifications from "../companyFieldVerifications.js";
import type * as companyProfiles from "../companyProfiles.js";
import type * as documents from "../documents.js";
import type * as formRuns from "../formRuns.js";
import type * as formTemplates from "../formTemplates.js";
import type * as geminiFileSearch from "../geminiFileSearch.js";
import type * as geminiStore from "../geminiStore.js";
import type * as ingest from "../ingest.js";
import type * as jobs from "../jobs.js";
import type * as lib_cleanupUtils from "../lib/cleanupUtils.js";
import type * as lib_jobUtils from "../lib/jobUtils.js";
import type * as lib_timeUtils from "../lib/timeUtils.js";
import type * as opportunities from "../opportunities.js";
import type * as requirementMatches from "../requirementMatches.js";
import type * as requirements from "../requirements.js";
import type * as storage from "../storage.js";
import type * as tenderWorkspaces from "../tenderWorkspaces.js";
import type * as validators from "../validators.js";
import type * as workspaceExports from "../workspaceExports.js";
import type * as workspaceItems from "../workspaceItems.js";

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
  auditEvents: typeof auditEvents;
  auth: typeof auth;
  bundles: typeof bundles;
  chat: typeof chat;
  chunks: typeof chunks;
  cleanup: typeof cleanup;
  companyDocuments: typeof companyDocuments;
  companyFieldVerifications: typeof companyFieldVerifications;
  companyProfiles: typeof companyProfiles;
  documents: typeof documents;
  formRuns: typeof formRuns;
  formTemplates: typeof formTemplates;
  geminiFileSearch: typeof geminiFileSearch;
  geminiStore: typeof geminiStore;
  ingest: typeof ingest;
  jobs: typeof jobs;
  "lib/cleanupUtils": typeof lib_cleanupUtils;
  "lib/jobUtils": typeof lib_jobUtils;
  "lib/timeUtils": typeof lib_timeUtils;
  opportunities: typeof opportunities;
  requirementMatches: typeof requirementMatches;
  requirements: typeof requirements;
  storage: typeof storage;
  tenderWorkspaces: typeof tenderWorkspaces;
  validators: typeof validators;
  workspaceExports: typeof workspaceExports;
  workspaceItems: typeof workspaceItems;
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
