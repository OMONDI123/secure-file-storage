import { Router } from "express";
import * as fileController from "../controllers/file.controller";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { upload } from "../middleware/upload";

const router = Router();

/**
 * Public Routes
 * These must be declared before the /:id routes to prevent "public" from being
 * interpreted as a file ID parameter.
 */
router.get("/public/:token", fileController.getPublicFile);
router.get("/public/:token/download", fileController.downloadPublicFile);

/**
 * Protected Routes
 * All routes below this line require authentication.
 */
router.use(requireAuth);

// File upload endpoint with multer middleware for handling multipart/form-data
router.post("/", upload.single("file"), fileController.uploadFile);

// List all files for the authenticated user
router.get("/", fileController.listFiles);

// Get a specific file by ID (must be owned by the user)
router.get("/:id", fileController.getFile);

// Update file visibility (public/private)
router.patch(
  "/:id/visibility",
  validateBody(fileController.visibilitySchema),
  fileController.updateVisibility
);

// Delete a file (owner only)
router.delete("/:id", fileController.removeFile);

// Download a file (generates signed URL)
router.get("/:id/download", fileController.downloadFile);

export default router;