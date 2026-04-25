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

const app = express();
app.set("trust proxy", 1);

const corsOptions = {
  origin: [process.env.FRONTEND_URL, process.env.FRONTEND_URL_WWW],
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
  res.status(200).json({
    status: "success",
    message: "Server is healthy",
  });
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

// Unhandled routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// Global Error Handeling Middleware
app.use(globalErrorHandler);

export default app;
