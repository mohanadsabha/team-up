import { Router } from "express";
import { taskController } from "./task.controller";
import { protect } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PROTECTED ENDPOINTS - Authenticated users can manage tasks
 */
router.use(protect);

router.get("/", taskController.getTasks);
router.get("/:id", taskController.getTaskById);
router.post("/", taskController.createTask);
router.patch("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

export default router;
