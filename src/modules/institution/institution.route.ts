import { Router } from "express";
import { institutionController } from "./institution.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PUBLIC ENDPOINTS - For signup forms and client-side dropdowns
 * No authentication required
 */
router.get("/universities", institutionController.getUniversities);
router.get("/colleges", institutionController.getColleges);
router.get("/departments", institutionController.getDepartments);

/**
 * PROTECTED ADMIN ENDPOINTS - SYSTEM_ADMIN only
 * Require authentication and SYSTEM_ADMIN role
 */
router.use(protect);
router.use(restrictTo("SYSTEM_ADMIN"));

// University management
router.post("/universities", institutionController.createUniversity);
router.patch("/universities/:id", institutionController.updateUniversity);
router.delete("/universities/:id", institutionController.deleteUniversity);

// College management
router.post("/colleges", institutionController.createCollege);
router.patch("/colleges/:id", institutionController.updateCollege);
router.delete("/colleges/:id", institutionController.deleteCollege);

// Department management
router.post("/departments", institutionController.createDepartment);
router.patch("/departments/:id", institutionController.updateDepartment);
router.delete("/departments/:id", institutionController.deleteDepartment);

export default router;
