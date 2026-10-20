import { Router } from "express";
import rateLimit from 'express-rate-limit';
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadAvatarImage } from "../middleware/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

authRoutes.post("/register", asyncHandler(authController.register));
authRoutes.post("/login", authLimiter, asyncHandler(authController.login));
authRoutes.get("/me", requireAuth, asyncHandler(authController.me));
authRoutes.patch("/me", requireAuth, asyncHandler(authController.updateMe));
// requireAuth runs before uploadAvatarImage deliberately - an unauthorized
// request is rejected before any disk write happens (same pattern as newsRoutes).
authRoutes.post(
  "/me/avatar",
  requireAuth,
  uploadAvatarImage,
  asyncHandler(authController.uploadAvatar),
);
authRoutes.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(authController.forgotPassword),
);
authRoutes.post("/reset-password", authLimiter, asyncHandler(authController.resetPassword));
authRoutes.patch(
  "/password",
  requireAuth,
  asyncHandler(authController.changePassword),
);
