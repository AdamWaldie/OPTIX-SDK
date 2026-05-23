// Convenience namespaces over the typed operation map.
//
// The OperationName enum exposes every documented endpoint, but it is
// often more ergonomic to write `client.documents.list()` than
// `client.request("getDocuments")`. These thin wrappers do exactly that —
// they are pure forwarders to `client.request(...)` / `client.paginate(...)`
// and never add their own behaviour.

import type { OptixClient, RequestOptions } from "./client";

function makeNamespace(client: OptixClient, methods: Record<string, string>) {
  const out: Record<string, (opts?: RequestOptions) => Promise<unknown>> = {};
  for (const [methodName, operationName] of Object.entries(methods)) {
    out[methodName] = (opts?: RequestOptions) => client.request(operationName as any, opts);
  }
  return out;
}

export interface ResourceNamespaces {
  stats: {
    get: (opts?: RequestOptions) => Promise<unknown>;
    trends: (opts?: RequestOptions) => Promise<unknown>;
    threatCards: (opts?: RequestOptions) => Promise<unknown>;
  };
  sources: {
    list: (opts?: RequestOptions) => Promise<unknown>;
    create: (opts?: RequestOptions) => Promise<unknown>;
    update: (opts?: RequestOptions) => Promise<unknown>;
    remove: (opts?: RequestOptions) => Promise<unknown>;
    stats: (opts?: RequestOptions) => Promise<unknown>;
    listAll: (opts?: RequestOptions) => AsyncGenerator<unknown, void, void>;
  };
  documents: {
    list: (opts?: RequestOptions) => Promise<unknown>;
    get: (opts?: RequestOptions) => Promise<unknown>;
    quarantined: (opts?: RequestOptions) => Promise<unknown>;
    rejected: (opts?: RequestOptions) => Promise<unknown>;
    listAll: (opts?: RequestOptions & { limit?: number; pageSize?: number }) => AsyncGenerator<unknown, void, void>;
  };
  entities: {
    get: (opts?: RequestOptions) => Promise<unknown>;
  };
  search: {
    documents: (opts?: RequestOptions) => Promise<unknown>;
  };
  iocExport: {
    blocklist: (opts?: RequestOptions) => Promise<unknown>;
    feeds: (opts?: RequestOptions) => Promise<unknown>;
    feedBlocklist: (opts?: RequestOptions) => Promise<unknown>;
  };
  reports: {
    list: (opts?: RequestOptions) => Promise<unknown>;
    get: (opts?: RequestOptions) => Promise<unknown>;
  };
  apiKeys: {
    list: (opts?: RequestOptions) => Promise<unknown>;
  };
  taxii: {
    discovery: (opts?: RequestOptions) => Promise<unknown>;
    collections: (opts?: RequestOptions) => Promise<unknown>;
  };
  auditLog: {
    list: (opts?: RequestOptions) => Promise<unknown>;
  };
  organizations: {
    list: (opts?: RequestOptions) => Promise<unknown>;
  };
}

/**
 * Build the convenience namespaces for a given client. Operation names
 * here mirror the keys generated into `OPERATIONS`. If an operation is
 * renamed in the spec, the namespace entry will fail to type-check —
 * which is the desired behaviour: fix the rename in one place.
 */
export function buildResources(client: OptixClient): ResourceNamespaces {
  return {
    stats: makeNamespace(client, {
      get: "getStats",
      trends: "getTrends",
      threatCards: "getThreatCards",
    }) as any,
    sources: {
      ...(makeNamespace(client, {
        list: "getSources",
        create: "postSources",
        update: "patchSourcesById",
        remove: "deleteSourcesById",
        stats: "getSourcesStats",
      }) as any),
      listAll: (opts?: RequestOptions) => client.paginate("getSources", opts ?? {}),
    },
    documents: {
      ...(makeNamespace(client, {
        list: "getDocuments",
        get: "getDocumentsById",
        quarantined: "getDocumentsQuarantined",
        rejected: "getDocumentsRejected",
      }) as any),
      listAll: (opts?: RequestOptions & { limit?: number; pageSize?: number }) =>
        client.paginate("getDocuments", opts ?? {}),
    },
    entities: makeNamespace(client, {
      get: "getEntitiesById",
    }) as any,
    search: makeNamespace(client, {
      documents: "getSearch",
    }) as any,
    iocExport: makeNamespace(client, {
      blocklist: "getIocExportBlocklist",
      feeds: "getIocExportFeeds",
      feedBlocklist: "getIocExportFeedsBySlugBlocklist",
    }) as any,
    reports: makeNamespace(client, {
      list: "getReports",
      get: "getReportsById",
    }) as any,
    apiKeys: makeNamespace(client, {
      list: "getApiKeys",
    }) as any,
    taxii: makeNamespace(client, {
      discovery: "getTaxii2",
      collections: "getTaxii2Collections",
    }) as any,
    auditLog: makeNamespace(client, {
      list: "getAuditLog",
    }) as any,
    organizations: makeNamespace(client, {
      list: "getOrganizations",
    }) as any,
  };
}
