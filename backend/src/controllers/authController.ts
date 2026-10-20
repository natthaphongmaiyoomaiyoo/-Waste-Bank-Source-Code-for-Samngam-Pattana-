import type { Request, Response } from 'express';
import * as authService from '../services/authService.js';
import { logAction } from '../services/systemLogService.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
} from '../validators/authValidators.js';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  await logAction({
    userId: result.user.id,
    actionType: 'LOGIN',
    module: 'Auth',
    action: 'User Login',
    targetId: String(result.user.id),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(200).json(result);
}

export async function me(req: Request, res: Response) {
  res.status(200).json(await authService.getCurrentSession(req.auth!.userId));
}

export async function updateMe(req: Request, res: Response) {
  const input = updateMeSchema.parse(req.body);
  res.status(200).json(await authService.updateCurrentUser(req.auth!.userId, input));
}

export async function uploadAvatar(req: Request, res: Response) {
  res.status(200).json(await authService.updateAvatar(req.auth!.userId, req.file));
}

export async function forgotPassword(req: Request, res: Response) {
  const input = forgotPasswordSchema.parse(req.body);
  res.status(202).json(await authService.requestPasswordReset(input));
}

export async function resetPassword(req: Request, res: Response) {
  const input = resetPasswordSchema.parse(req.body);
  await authService.resetPassword(input);
  res.status(204).send();
}

export async function changePassword(req: Request, res: Response) {
  const input = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.auth!.userId, input.currentPassword, input.newPassword);
  res.status(204).send();
}
