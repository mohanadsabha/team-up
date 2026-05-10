import { Router } from "express";
import { meetingController } from "./meeting.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

router.use(protect);

// Manual reminder sweep route must be registered before parameterized routes.
router.post(
  "/reminders/dispatch",
  restrictTo("SYSTEM_ADMIN"),
  meetingController.sendDueReminders,
);

router.get("/", meetingController.getMeetings);
router.get("/:id", meetingController.getMeetingById);
router.post("/", meetingController.createMeeting);
router.patch("/:id", meetingController.updateMeeting);
router.delete("/:id", meetingController.deleteMeeting);

export default router;
