import { Router } from "express";
import { paymentController } from "./payment.controller";
import { protect, restrictTo } from "../../middleware/auth.middleware";

const router = Router();

/**
 * PUBLIC ENDPOINTS - None for payments
 */

/**
 * PROTECTED ENDPOINTS - Authenticated users can view and manage payments
 */
router.use(protect);

// User payment endpoints
router.get("/", paymentController.getPayments);
router.get("/history/transactions", paymentController.getTransactionHistory);
router.get("/:id", paymentController.getPaymentById);
router.post("/", paymentController.createPayment);

/**
 * ADMIN ENDPOINTS
 */
router.use(restrictTo("SYSTEM_ADMIN"));

// Admin payment management
router.get("/admin/all", paymentController.getAllPayments);
router.patch("/:id/status", paymentController.updatePaymentStatus);
router.get("/admin/stats", paymentController.getPaymentStats);

export default router;
