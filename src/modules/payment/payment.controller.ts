import { Request, Response, NextFunction } from "express";
import { zodValidation } from "../../utils/zod.util";
import {
  CreatePayment,
  createPaymentSchema,
  GetPaymentsQuery,
  getPaymentsQuerySchema,
  IdParam,
  idParamSchema,
  MessageResponse,
  PaymentDetailsResponse,
  PaymentResponse,
  PaymentsListResponse,
  PaymentStatsResponse,
  StringObject,
  TransactionHistoryResponse,
  UpdatePaymentStatus,
  updatePaymentStatusSchema,
} from "./payment.interface";
import AppError from "../../utils/appError";
import { prisma } from "../../config/prisma";

class PaymentController {
  private isAutoConfirmEnabled() {
    return String(process.env.PAYMENT_AUTO_CONFIRM ?? "false") === "true";
  }

  public getPayments = async (
    req: Request<StringObject, StringObject, StringObject, GetPaymentsQuery>,
    res: Response<PaymentsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getPaymentsQuerySchema, req.query);

    const payments = await prisma.payment.findMany({
      where: {
        buyerId: req.user.userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.startDate || query.endDate
          ? {
              createdAt: {
                ...(query.startDate ? { gte: query.startDate } : {}),
                ...(query.endDate ? { lte: query.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Payments fetched successfully.",
      results: payments.length,
      payments,
    });
  };

  public getAllPayments = async (
    req: Request<StringObject, StringObject, StringObject, GetPaymentsQuery>,
    res: Response<PaymentsListResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getPaymentsQuerySchema, req.query);

    const payments = await prisma.payment.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.startDate || query.endDate
          ? {
              createdAt: {
                ...(query.startDate ? { gte: query.startDate } : {}),
                ...(query.endDate ? { lte: query.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Payments fetched successfully.",
      results: payments.length,
      payments,
    });
  };

  public getPaymentById = async (
    req: Request<IdParam>,
    res: Response<PaymentDetailsResponse>,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    if (!payment) {
      throw new AppError("Payment not found.", 404);
    }

    if (
      payment.buyerId !== req.user.userId &&
      !["SYSTEM_ADMIN"].includes(req.user.role)
    ) {
      throw new AppError(
        "You do not have permission to access this payment.",
        403,
      );
    }

    res.status(200).json({
      success: true,
      message: "Payment fetched successfully.",
      payment,
    });
  };

  public createPayment = async (
    req: Request<StringObject, StringObject, CreatePayment>,
    res: Response<
      MessageResponse & {
        payment: PaymentResponse & {
          project: { id: string; title: string; price: number };
        };
      }
    >,
    _next: NextFunction,
  ) => {
    const payload = zodValidation(createPaymentSchema, req.body);

    const project = await prisma.graduationProject.findUnique({
      where: { id: payload.projectId },
      select: { id: true, price: true, title: true },
    });

    if (!project) {
      throw new AppError("Project not found.", 404);
    }

    const existingPayment = await prisma.payment.findFirst({
      where: {
        projectId: payload.projectId,
        buyerId: req.user.userId,
        status: "SUCCESS",
      },
    });

    if (existingPayment) {
      throw new AppError("You have already purchased this project.", 409);
    }

    const autoConfirm = this.isAutoConfirmEnabled() || project.price <= 0;
    const initialStatus = autoConfirm ? "SUCCESS" : "PENDING";
    const processedAt = autoConfirm ? new Date() : null;
    const transactionId = autoConfirm ? `TXN_${Date.now()}` : null;

    const payment = await prisma.payment.create({
      data: {
        buyerId: req.user.userId,
        projectId: payload.projectId,
        amount: project.price,
        paymentMethod: payload.paymentMethod,
        status: initialStatus,
        transactionId,
        processedAt,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: autoConfirm
        ? "Payment processed successfully."
        : "Payment initiated successfully and is pending confirmation.",
      payment,
    });
  };

  public updatePaymentStatus = async (
    req: Request<IdParam, StringObject, UpdatePaymentStatus>,
    res: Response<
      MessageResponse & {
        payment: PaymentResponse & {
          project: { id: string; title: string; price: number };
        };
      }
    >,
    _next: NextFunction,
  ) => {
    const params = zodValidation(idParamSchema, req.params);
    const payload = zodValidation(updatePaymentStatusSchema, req.body);

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
    });

    if (!payment) {
      throw new AppError("Payment not found.", 404);
    }

    const updated = await prisma.payment.update({
      where: { id: params.id },
      data: {
        status: payload.status,
        ...(payload.status === "SUCCESS"
          ? {
              processedAt: new Date(),
              transactionId: payment.transactionId ?? `TXN_${Date.now()}`,
            }
          : payload.status === "FAILED"
            ? {
                processedAt: null,
              }
            : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      message: "Payment status updated successfully.",
      payment: updated,
    });
  };

  public getPaymentStats = async (
    req: Request,
    res: Response<PaymentStatsResponse>,
    _next: NextFunction,
  ) => {
    const [totalRevenue, completedPayments, pendingPayments, failedPayments] =
      await Promise.all([
        prisma.payment.aggregate({
          where: { status: "SUCCESS" },
          _sum: { amount: true },
        }),
        prisma.payment.count({ where: { status: "SUCCESS" } }),
        prisma.payment.count({ where: { status: "PENDING" } }),
        prisma.payment.count({ where: { status: "FAILED" } }),
      ]);

    res.status(200).json({
      success: true,
      message: "Payment stats fetched successfully.",
      totalRevenue: totalRevenue._sum.amount || 0,
      successfulPayments: completedPayments,
      pendingPayments,
      failedPayments,
    });
  };

  public getTransactionHistory = async (
    req: Request<StringObject, StringObject, StringObject, GetPaymentsQuery>,
    res: Response<TransactionHistoryResponse>,
    _next: NextFunction,
  ) => {
    const query = zodValidation(getPaymentsQuerySchema, req.query);

    const transactions = await prisma.payment.findMany({
      where: {
        buyerId: req.user.userId,
        status: "SUCCESS",
        ...(query.startDate || query.endDate
          ? {
              createdAt: {
                ...(query.startDate ? { gte: query.startDate } : {}),
                ...(query.endDate ? { lte: query.endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      message: "Transaction history fetched successfully.",
      results: transactions.length,
      transactions,
    });
  };
}

export const paymentController = new PaymentController();
