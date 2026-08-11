// routes/file.routes.ts
import { Router } from "express";
import { upload } from "../middleware/upload";
import { requireAuth } from "../middleware/auth";
import {
  uploadFile,
  listFiles,
  getFile,
  updateVisibility,
  removeFile,
  downloadFile,
  getPublicFile,
  downloadPublicFile,
} from "../controllers/file.controller";

const router = Router();

// Protected routes (require authentication)
router.post("/", requireAuth, upload.single("file"), uploadFile);
router.get("/", requireAuth, listFiles);
router.get("/:id", requireAuth, getFile);
router.patch("/:id/visibility", requireAuth, updateVisibility);
router.delete("/:id", requireAuth, removeFile);
router.get("/:id/download", requireAuth, downloadFile);

// Public routes (no authentication required)
router.get("/public/:token", getPublicFile);
router.get("/public/:token/download", downloadPublicFile);

export default router;