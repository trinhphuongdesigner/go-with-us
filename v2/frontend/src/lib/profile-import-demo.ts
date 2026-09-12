import type { components } from "../../../contracts/generated/openapi";

type ProfileApplyRead = components["schemas"]["ProfileApplyRead"];
type ProfileApplyRequest = components["schemas"]["ProfileApplyRequest"];
type ProfileImportDetail = components["schemas"]["ProfileImportDetailRead"];
type ProfileImportList = components["schemas"]["ProfileImportList"];
type ProfileImportParse = components["schemas"]["ProfileImportParseRead"];
type ProfileImportRead = components["schemas"]["ProfileImportRead"];

const sourceId = "10000000-0000-4000-8000-000000000001";
const sourceVersionId = "10000000-0000-4000-8000-000000000002";
const blockId = "10000000-0000-4000-8000-000000000003";
const parsedImportId = "10000000-0000-4000-8000-000000000010";
const pendingImportId = "10000000-0000-4000-8000-000000000020";

const initialImports: ProfileImportDetail[] = [
  {
    id: parsedImportId,
    status: "PARSED",
    fileName: "Ho-so-Nguyen-Khanh-Linh.pdf",
    mimeType: "application/pdf",
    sizeBytes: 834_620,
    sha256: "21dd5ce3c2481a99070fdcead69a4d19f2a2f8e39e65a2789b1f22399c3ad3c0",
    version: 1,
    proposalVersion: 1,
    profileVersion: 1,
    aiStatus: "ok",
    clarificationQuestions: [],
    warnings: ["DEMO_DATA"],
    traceId: "10000000-0000-4000-8000-000000000014",
    promptVersion: "profile-import-v1",
    schemaVersion: "job-title-v1",
    model: "deterministic-demo",
    createdAt: "2026-09-11T08:15:00.000Z",
    updatedAt: "2026-09-11T08:16:12.000Z",
    proposal: {
      id: "10000000-0000-4000-8000-000000000011",
      version: 1,
      items: [
        {
          proposalItemId: "10000000-0000-4000-8000-000000000012",
          field: "jobTitle",
          value: "Product Designer",
          supportStatus: "SUPPORTED",
          evidenceRefs: [
            {
              sourceId,
              sourceVersionId,
              blockId,
              charStart: 18,
              charEnd: 49,
              quote: "Product Designer tại Acme Việt Nam",
              quoteSha256: "03ec881216328ce21a6cda2dc5f37440bab388ec4dcec762e25ed3d50f473531",
              pageNumber: 1,
              sheetName: null,
              context: "Kinh nghiệm gần nhất: Product Designer tại Acme Việt Nam.",
            },
          ],
        },
        {
          proposalItemId: "10000000-0000-4000-8000-000000000013",
          field: "summary",
          value: "Thiết kế sản phẩm số tập trung vào trải nghiệm nhân viên.",
          supportStatus: "AMBIGUOUS",
          evidenceRefs: [],
        },
      ],
    },
  },
  {
    id: pendingImportId,
    status: "PENDING",
    fileName: "linkedin-export.txt",
    mimeType: "text/plain",
    sizeBytes: 12_480,
    sha256: "32254df1f62aecf74886b4c47980f3dc7f296531593091390129784b20f224f0",
    version: 1,
    proposalVersion: 0,
    profileVersion: 1,
    aiStatus: null,
    clarificationQuestions: [],
    warnings: [],
    traceId: null,
    promptVersion: null,
    schemaVersion: null,
    model: null,
    createdAt: "2026-09-12T01:20:00.000Z",
    updatedAt: "2026-09-12T01:20:00.000Z",
    proposal: null,
  },
];

interface DemoImportStore {
  imports: Map<string, ProfileImportDetail>;
  uploadSignatures: Map<string, string>;
  applyReceipts: Map<string, { digest: string; receipt: ProfileApplyRead }>;
}

const storesByOwner = new Map<string, DemoImportStore>();

function storeFor(ownerId: string): DemoImportStore {
  let store = storesByOwner.get(ownerId);
  if (!store) {
    store = {
      imports: new Map(initialImports.map((item) => [item.id, structuredClone(item)])),
      uploadSignatures: new Map(),
      applyReceipts: new Map(),
    };
    storesByOwner.set(ownerId, store);
  }
  return store;
}

function asRead(item: ProfileImportDetail): ProfileImportRead {
  return {
    id: item.id,
    status: item.status,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    sha256: item.sha256,
    version: item.version,
    proposalVersion: item.proposalVersion,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function listDemoProfileImports(ownerId: string, page = 1, pageSize = 20): ProfileImportList {
  const all = [...storeFor(ownerId).imports.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const offset = (page - 1) * pageSize;
  return { items: all.slice(offset, offset + pageSize).map(asRead), total: all.length, page, pageSize };
}

export function createDemoProfileImport(ownerId: string, file: File): ProfileImportRead {
  const store = storeFor(ownerId);
  const signature = `${file.name}:${file.size}:${file.type}`;
  const duplicateId = store.uploadSignatures.get(signature);
  if (duplicateId) return asRead(store.imports.get(duplicateId)!);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const detail: ProfileImportDetail = {
    id,
    status: "PENDING",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    sha256: "demo-file-digest-hidden-from-interface",
    version: 1,
    proposalVersion: 0,
    profileVersion: 1,
    aiStatus: null,
    clarificationQuestions: [],
    warnings: [],
    traceId: null,
    promptVersion: null,
    schemaVersion: null,
    model: null,
    createdAt: now,
    updatedAt: now,
    proposal: null,
  };
  store.imports.set(id, detail);
  store.uploadSignatures.set(signature, id);
  return asRead(detail);
}

export function getDemoProfileImport(ownerId: string, importId: string): ProfileImportDetail {
  const item = storeFor(ownerId).imports.get(importId);
  if (!item) throw new Error("Không tìm thấy bản nhập hồ sơ");
  return structuredClone(item);
}

export function parseDemoProfileImport(ownerId: string, importId: string): ProfileImportParse {
  const item = storeFor(ownerId).imports.get(importId);
  if (!item) throw new Error("Không tìm thấy bản nhập hồ sơ");

  const proposalItemId = crypto.randomUUID();
  item.status = "PARSED";
  item.version += 1;
  item.proposalVersion = 1;
  item.updatedAt = new Date().toISOString();
  item.aiStatus = "ok";
  item.clarificationQuestions = [];
  item.warnings = ["DEMO_DATA"];
  item.traceId = crypto.randomUUID();
  item.promptVersion = "profile-import-v1";
  item.schemaVersion = "job-title-v1";
  item.model = "deterministic-demo";
  item.proposal = {
    id: crypto.randomUUID(),
    version: 1,
    items: [{
      proposalItemId,
      field: "jobTitle",
      value: "Chuyên viên phát triển sản phẩm",
      supportStatus: "SUPPORTED",
      evidenceRefs: [{
        sourceId: crypto.randomUUID(),
        sourceVersionId: crypto.randomUUID(),
        blockId: crypto.randomUUID(),
        charStart: 0,
        charEnd: 38,
        quote: "Chuyên viên phát triển sản phẩm",
        quoteSha256: "demo-evidence-digest-hidden-from-interface",
        pageNumber: 1,
        sheetName: null,
        context: "Chuyên viên phát triển sản phẩm",
      }],
    }],
  };

  return {
    id: item.id,
    status: item.status,
    proposalVersion: item.proposalVersion,
    profileVersion: item.profileVersion,
    aiStatus: item.aiStatus,
    clarificationQuestions: item.clarificationQuestions,
    warnings: item.warnings,
    traceId: item.traceId!,
    promptVersion: item.promptVersion!,
    schemaVersion: item.schemaVersion!,
    model: item.model!,
    proposal: structuredClone(item.proposal),
  };
}

export function applyDemoProfileImport(
  ownerId: string,
  importId: string,
  payload: ProfileApplyRequest,
  idempotencyKey: string,
): ProfileApplyRead {
  const store = storeFor(ownerId);
  const item = store.imports.get(importId);
  if (!item) throw new Error("Không tìm thấy bản nhập hồ sơ");
  const digest = JSON.stringify(payload);
  const previous = store.applyReceipts.get(idempotencyKey);
  if (previous) {
    if (previous.digest !== digest) throw new Error("Idempotency key đã được dùng với lựa chọn khác");
    return structuredClone(previous.receipt);
  }

  const selectedIds = payload.items.filter((candidate) => candidate.selected).map((candidate) => candidate.proposalItemId);
  const skippedIds = payload.items.filter((candidate) => !candidate.selected).map((candidate) => candidate.proposalItemId);
  const receipt: ProfileApplyRead = {
    commandId: crypto.randomUUID(),
    status: "APPLIED",
    createdEntityIds: selectedIds.map(() => crypto.randomUUID()),
    skippedItemIds: skippedIds,
    profileVersion: payload.profileVersion + 1,
  };
  item.status = "APPLIED";
  item.version += 1;
  item.profileVersion = receipt.profileVersion;
  item.updatedAt = new Date().toISOString();
  store.applyReceipts.set(idempotencyKey, { digest, receipt });
  return structuredClone(receipt);
}
