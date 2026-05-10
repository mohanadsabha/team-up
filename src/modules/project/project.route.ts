import { Router } from "express";
import { projectController } from "./project.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

// Public project discovery
router.get("/", projectController.getProjects);
router.get("/:id", projectController.getProjectById);
router.get("/:id/files", projectController.getProjectFiles);

// Protected project management
router.use(protect);

router.post("/", projectController.createProject);
router.patch("/:id", projectController.updateProject);
router.delete("/:id", projectController.deleteProject);
router.post("/:id/submit", projectController.submitProject);
router.post("/:id/files", projectController.addProjectFile);
router.delete("/:id/files/:fileId", projectController.deleteProjectFile);

// Admin review workflow
router.use(restrictTo("SYSTEM_ADMIN"));
router.post("/:id/approve", projectController.approveProject);
router.post("/:id/reject", projectController.rejectProject);

export default router;
