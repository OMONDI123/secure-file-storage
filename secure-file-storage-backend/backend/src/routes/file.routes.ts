import { Router } from "express";
import * as fileController from "../controllers/file.controller";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { upload } from "../middleware/upload";

const router = Router();

// Public share endpoints (no auth required) — declared before "/:id" routes
// so "public" is never captured as an :id param.
router.get("/public/:token", fileController.getPublicFile);
router.get("/public/:token/download", fileController.downloadPublicFile);

router.use(requireAuth);

router.post("/", upload.single("file"), fileController.uploadFile);
router.get("/", fileController.listFiles);
router.get("/:id", fileController.getFile);
router.patch("/:id/visibility", validateBody(fileController.visibilitySchema), fileController.updateVisibility);
router.delete("/:id", fileController.removeFile);
router.get("/:id/download", fileController.downloadFile);

export default router;
