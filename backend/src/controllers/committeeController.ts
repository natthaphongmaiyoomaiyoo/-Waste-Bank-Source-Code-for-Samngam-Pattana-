import type { Request, Response } from 'express';
import * as committeeService from '../services/committeeService.js';
import * as committeeSellRequestService from '../services/committeeSellRequestService.js';
import * as committeeRoundService from '../services/committeeRoundService.js';
import * as committeeDashboardService from '../services/committeeDashboardService.js';
import * as funeralCaseService from '../services/funeralCaseService.js';
import { ApiError } from '../utils/ApiError.js';
import { villageScopeOf } from '../middleware/villageScope.js';
import { discardUploads } from '../middleware/upload.js';
import { logAction } from '../services/systemLogService.js';
import { assertSellRequestInScope } from '../services/villageScopeService.js';
import type { VillageScope } from '../middleware/villageScope.js';
import {
  committeeRoundCreateSchema,
  committeeRoundIdParamSchema,
  committeeRoundListQuerySchema,
  committeeRoundUpdateSchema,
} from '../validators/committeeRoundValidators.js';
import {
  committeeCreateMemberSchema,
  committeeHouseholdListQuerySchema,
  committeeIdParamSchema,
  committeeMemberDocumentParamSchema,
  committeeMarkDeceasedSchema,
  committeeMemberDocumentSchema,
  committeeMemberListQuerySchema,
  committeePurchaseSchema,
  committeeResetMemberPasswordSchema,
  committeeSellRequestListQuerySchema,
  committeeSellRequestSummaryQuerySchema,
  committeeStatusNoteSchema,
  committeeUpdateMemberSchema,
  committeeVerificationSchema,
} from '../validators/committeeValidators.js';

// Every handler resolves the caller's village scope (null = admin, unrestricted)
// and hands it to the service layer, which is where the actual isolation is
// enforced - see services/villageScopeService.ts.

function effectiveScopeOf(req: Request, queryAreaId?: number): VillageScope | null {
  const scope = villageScopeOf(req);
  return !scope && queryAreaId ? { villageAreaId: queryAreaId, villageName: '', moo: '' } : scope;
}

export async function createMember(req: Request, res: Response) {
  const input = committeeCreateMemberSchema.parse(req.body);
  res.status(201).json(await committeeService.createMember(input, villageScopeOf(req)));
}

export async function listHouseholds(req: Request, res: Response) {
  const query = committeeHouseholdListQuerySchema.parse(req.query);
  res.json(await committeeService.listHouseholds(query, villageScopeOf(req)));
}

export async function listMembers(req: Request, res: Response) {
  const query = committeeMemberListQuerySchema.parse(req.query);
  res.json(await committeeService.listMembers(query, effectiveScopeOf(req, query.villageAreaId)));
}

export async function getMembersSummary(req: Request, res: Response) {
  const query = committeeMemberListQuerySchema.parse(req.query ?? {});
  res.json(await committeeService.getMembersSummary(effectiveScopeOf(req, query.villageAreaId)));
}

export async function getMemberDetail(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  res.json(await committeeService.getMemberDetail(id, villageScopeOf(req)));
}

export async function listMemberDocuments(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  res.json(await committeeService.listMemberDocuments(id, villageScopeOf(req)));
}

export async function addMemberDocument(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const input = committeeMemberDocumentSchema.parse(req.body);
  res
    .status(201)
    .json(
      await committeeService.addMemberDocument(
        id,
        input,
        req.file,
        req.auth!.userId,
        villageScopeOf(req),
      ),
    );
}

export async function deleteMemberDocument(req: Request, res: Response) {
  const { id, documentId } = committeeMemberDocumentParamSchema.parse(req.params);
  await committeeService.deleteMemberDocument(id, documentId, villageScopeOf(req));
  res.status(204).send();
}

export async function updateMember(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const input = committeeUpdateMemberSchema.parse(req.body);
  res.json(await committeeService.updateMember(id, input, villageScopeOf(req)));
}

export async function recordVerification(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const input = committeeVerificationSchema.parse(req.body);
  res
    .status(201)
    .json(
      await committeeService.recordVerification(id, input, req.auth!.userId, villageScopeOf(req)),
    );
}

export async function approveMember(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  res.json(await committeeService.approveMember(id, villageScopeOf(req), req.auth!.userId));
}

export async function resetMemberPassword(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const { newPassword } = committeeResetMemberPasswordSchema.parse(req.body);
  const { username } = await committeeService.resetMemberPassword(
    id,
    newPassword,
    villageScopeOf(req),
  );
  await logAction({
    userId: req.auth!.userId,
    actionType: 'UPDATE',
    module: 'Committee',
    action: 'Reset member password',
    detail: username,
    targetId: String(id),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(204).send();
}

export async function cancelMember(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const { note } = committeeStatusNoteSchema.parse(req.body ?? {});
  res.json(await committeeService.cancelMember(id, villageScopeOf(req), note, req.auth!.userId));
}

export async function markMemberDeceased(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const input = committeeMarkDeceasedSchema.parse(req.body ?? {});
  if (!req.file) {
    throw ApiError.badRequest('death certificate file is required');
  }
  // Only reports it - the municipality's approval is what marks the member
  // deceased and moves the money (funeralCaseService.approveFuneralCase).
  res.json(
    await funeralCaseService.reportMemberDeath(
      id,
      input,
      req.file,
      req.auth!.userId,
      villageScopeOf(req),
    ),
  );
}

// --- Sell-request management (pickup planning + purchase recording) ----------

export async function listSellRequests(req: Request, res: Response) {
  const query = committeeSellRequestListQuerySchema.parse(req.query);
  res.json(await committeeSellRequestService.listRequests(query, villageScopeOf(req)));
}

export async function getSellRequestsSummary(req: Request, res: Response) {
  const { roundId } = committeeSellRequestSummaryQuerySchema.parse(req.query);
  res.json(await committeeSellRequestService.getRequestsSummary(villageScopeOf(req), roundId));
}

export async function getSellRequestRouteCounts(req: Request, res: Response) {
  res.json(await committeeSellRequestService.getRouteCountsByRound(villageScopeOf(req)));
}

export async function getSellRequestDetail(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  await assertSellRequestInScope(id, villageScopeOf(req));
  res.json(await committeeSellRequestService.getRequestDetail(id));
}

export async function confirmSellRequest(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  await assertSellRequestInScope(id, villageScopeOf(req));
  res.json(await committeeSellRequestService.confirmRequest(id));
}

export async function cancelSellRequest(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const { note } = committeeStatusNoteSchema.parse(req.body ?? {});
  await assertSellRequestInScope(id, villageScopeOf(req));
  res.json(await committeeSellRequestService.cancelRequest(id, note));
}

// multipart/form-data: `payload` carries the purchase JSON, `documents` the proof
// files. Both have to arrive together - see recordPurchase for why.
export async function recordSellRequestPurchase(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const { id } = committeeIdParamSchema.parse(req.params);
    const input = committeePurchaseSchema.parse(parsePurchasePayload(req.body));
    await assertSellRequestInScope(id, villageScopeOf(req));
    res
      .status(201)
      .json(
        await committeeSellRequestService.recordPurchase(id, input, req.auth!.userId, files),
      );
  } catch (error) {
    // Nothing was recorded, so the uploaded files are orphans.
    discardUploads(files);
    throw error;
  }
}

// The purchase body is a JSON string field because the request also carries
// files; a plain form can't express the nested `items` array.
function parsePurchasePayload(body: unknown): unknown {
  const payload = (body as { payload?: unknown } | undefined)?.payload;
  if (typeof payload !== 'string') return body;
  try {
    return JSON.parse(payload);
  } catch {
    throw ApiError.badRequest('payload ต้องเป็น JSON ที่ถูกต้อง');
  }
}

// Purchase proof: photos/slips attached to the sale the purchase created.
export async function addSellRequestDocument(req: Request, res: Response) {
  const { id } = committeeIdParamSchema.parse(req.params);
  const { note } = committeeStatusNoteSchema.parse(req.body ?? {});
  await assertSellRequestInScope(id, villageScopeOf(req));
  res
    .status(201)
    .json(
      await committeeSellRequestService.addSaleDocument(id, note, req.file, req.auth!.userId),
    );
}

export async function listWasteTypes(_req: Request, res: Response) {
  res.json(await committeeSellRequestService.listWasteTypes());
}

// --- Collection rounds (the committee's own village's buying schedule) --------

export async function listRounds(req: Request, res: Response) {
  const query = committeeRoundListQuerySchema.parse(req.query);
  res.json(await committeeRoundService.listRounds(query, effectiveScopeOf(req, query.villageAreaId)));
}

export async function getRound(req: Request, res: Response) {
  const { id } = committeeRoundIdParamSchema.parse(req.params);
  res.json(await committeeRoundService.getRound(id, villageScopeOf(req)));
}

export async function getRoundsSummary(req: Request, res: Response) {
  const query = committeeRoundListQuerySchema.parse(req.query);
  res.json(await committeeRoundService.getRoundsSummary(query, effectiveScopeOf(req, query.villageAreaId)));
}

export async function createRound(req: Request, res: Response) {
  const input = committeeRoundCreateSchema.parse(req.body);
  res
    .status(201)
    .json(await committeeRoundService.createRound(input, villageScopeOf(req), req.auth!.userId));
}

export async function updateRound(req: Request, res: Response) {
  const { id } = committeeRoundIdParamSchema.parse(req.params);
  const input = committeeRoundUpdateSchema.parse(req.body);
  res.json(await committeeRoundService.updateRound(id, input, villageScopeOf(req)));
}

export async function cancelRound(req: Request, res: Response) {
  const { id } = committeeRoundIdParamSchema.parse(req.params);
  res.json(await committeeRoundService.cancelRound(id, villageScopeOf(req)));
}

export async function completeRound(req: Request, res: Response) {
  const { id } = committeeRoundIdParamSchema.parse(req.params);
  res.json(await committeeRoundService.completeRound(id, villageScopeOf(req)));
}

export async function listBuyers(_req: Request, res: Response) {
  res.json(await committeeRoundService.listBuyers());
}

// --- Overview dashboard -------------------------------------------------------
// Read-only roll-up of everything above (fund, monthly stats, current round,
// pending approvals, member statuses) for the committee's landing page.

export async function getDashboard(req: Request, res: Response) {
  res.json(await committeeDashboardService.getDashboard(villageScopeOf(req)));
}
