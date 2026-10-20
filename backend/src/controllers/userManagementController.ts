import { Request, Response } from 'express';
import * as userManagementService from '../services/userManagementService.js';
import { logAction } from '../services/systemLogService.js';
import { z } from 'zod';

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  roleId: z.number().int().positive(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  roleId: z.number().int().positive().optional(),
  password: z.string().min(8).optional(),
});

// Opt-in paging: without `page` every account comes back as a plain array.
const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().min(1).max(100).optional(),
  roleId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const listUsers = async (req: Request, res: Response) => {
  const { page, ...query } = listUsersQuerySchema.parse(req.query);
  res
    .status(200)
    .json(page ? await userManagementService.listUsersPage({ page, ...query }) : await userManagementService.listUsers());
};

export const createUser = async (req: Request, res: Response) => {
  const data = createUserSchema.parse(req.body);
  const user = await userManagementService.createUser(data);
  await logAction({
    userId: req.auth?.userId,
    actionType: 'CREATE',
    module: 'UserManagement',
    action: 'Create User',
    targetId: String(user.id),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(user);
};

export const updateUser = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const data = updateUserSchema.parse(req.body);
  const user = await userManagementService.updateUser(id, data);
  await logAction({
    userId: req.auth?.userId,
    actionType: 'UPDATE',
    module: 'UserManagement',
    action: 'Update User',
    targetId: String(id),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(200).json(user);
};

export const toggleUserStatus = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const user = await userManagementService.toggleUserStatus(id);
  await logAction({
    userId: req.auth?.userId,
    actionType: 'UPDATE',
    module: 'UserManagement',
    action: 'Toggle User Status',
    targetId: String(id),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(200).json(user);
};

export const adminResetPassword = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const result = await userManagementService.adminResetPassword(id);
  await logAction({
    userId: req.auth?.userId,
    actionType: 'UPDATE',
    module: 'UserManagement',
    action: 'Admin Reset Password',
    targetId: String(id),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(200).json(result);
};
