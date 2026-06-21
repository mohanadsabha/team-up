import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import AppError from "./utils/appError";
import globalErrorHandler from "./middleware/error.middleware";
import helmet from "helmet";
import hpp from "hpp";
import compression from "compression";
import xssShield from "xss-shield/build/main/lib/xssShield";
import authRoutes from "./modules/auth/auth.route";
import userRoutes from "./modules/user/user.route";
import institutionRoutes from "./modules/institution/institution.route";
import teamRoutes from "./modules/team/team.route";
import taskRoutes from "./modules/task/task.route";
import notificationRoutes from "./modules/notification/notification.route";
import notificationSettingsRoutes from "./modules/notification-settings/notification-settings.route";
import paymentRoutes from "./modules/payment/payment.route";
import complaintRoutes from "./modules/complaint/complaint.route";
import projectRoutes from "./modules/project/project.route";
import mentorInvitationRoutes from "./modules/mentor-invitation/mentor-invitation.route";
import milestoneRoutes from "./modules/milestone/milestone.route";
import chatRoutes from "./modules/chat/chat.route";
import meetingRoutes from "./modules/meeting/meeting.route";
import joinRequestRoutes from "./modules/join-request/join-request.route";
import settingsRoutes from "./modules/admin/settings/settings.route";
import { paymentController } from "./modules/payment/payment.controller";
import { getEmailConfigurationStatus } from "./utils/email-config";

type RawWebhookRequest = Request & { rawBody?: Buffer };

const app = express();
app.set("trust proxy", 1);

const corsOptions = {
  origin: [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_WWW,
    "https://team-up-website-front.vercel.app",
    "http://localhost:3000",
  ].filter(Boolean),
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};

/**
 * Rate Limiting will be inside Nginx
 */

// Security middlewares
app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  (req: RawWebhookRequest, res: Response, next: NextFunction) => {
    req.rawBody = Buffer.isBuffer(req.body) ? req.body : undefined;
    paymentController.webhook(req, res, next);
  },
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// This middleware for making req.query writable since express v5 made it getter only
app.use((req, res, next) => {
  Object.defineProperty(req, "query", {
    ...Object.getOwnPropertyDescriptor(req, "query"),
    value: req.query,
    writable: true,
  });
  next();
});
app.use(xssShield());
app.use(hpp());
// Compression lastly
app.use(compression());

// Routes
app.use("/api/health", (req: Request, res: Response) => {
  const email = getEmailConfigurationStatus();
  res.status(200).json({
    status: "success",
    message: "Server is healthy",
    emailConfigured: email.configured,
    emailMissingEnv: email.missing,
  });
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/institutions", institutionRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/v1/mentor-invitations", mentorInvitationRoutes);
app.use("/api/v1/join-requests", joinRequestRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/milestones", milestoneRoutes);
app.use("/api/v1/meetings", meetingRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/complaints", complaintRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/notification-settings", notificationSettingsRoutes);
app.use("/api/v1/admin/settings", settingsRoutes);
app.use("/api/v1/payments", paymentRoutes);

// OAuth aliases when API base URL is missing /api/v1
app.get("/auth/google", (req: Request, res: Response) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/v1/auth/google${query}`);
});
app.get("/auth/google/callback", (req: Request, res: Response) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/v1/auth/google/callback${query}`);
});
app.get("/auth/linkedin", (req: Request, res: Response) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/v1/auth/linkedin${query}`);
});
app.get("/auth/linkedin/callback", (req: Request, res: Response) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/v1/auth/linkedin/callback${query}`);
});

// Unhandled routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// Global Error Handeling Middleware
app.use(globalErrorHandler);

export default app;
