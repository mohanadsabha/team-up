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
import { getStripeClient } from "../../utils/stripe";

type RawWebhookRequest = Request & { rawBody?: Buffer };

class PaymentController {
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

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
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

      const wasSuccess = payment.status === "SUCCESS";
      const isSuccess = payload.status === "SUCCESS";

      if (!wasSuccess && isSuccess) {
        await tx.graduationProject.update({
          where: { id: payment.projectId },
          data: { purchaseCount: { increment: 1 } },
        });
      }

      if (wasSuccess && !isSuccess) {
        await tx.graduationProject.update({
          where: { id: payment.projectId },
          data: { purchaseCount: { decrement: 1 } },
        });
      }

      return updatedPayment;
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

  async createCheckoutSession(
    req: Request<{}, {}, CreatePayment>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const payload = zodValidation(createPaymentSchema, req.body);
      const stripe = getStripeClient();
      const project = await prisma.graduationProject.findUniqueOrThrow({
        where: { id: payload.projectId },
        include: { createdBy: true },
      });
      const buyer = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.userId },
      });
      const amountInCents = Math.round(project.price * 100);
      const frontendUrl = process.env.FRONTEND_URL;

      if (!frontendUrl) {
        return next(new AppError("FRONTEND_URL is not configured", 500));
      }

      if (project.createdById === buyer.id) {
        return next(new AppError("You cannot purchase your own project.", 400));
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: buyer.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amountInCents,
              product_data: {
                name: project.title,
                description: project.description,
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${frontendUrl}/dashboard/projects-ideas/payment-success-page?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/payment?status=failed`,
        metadata: {
          buyerId: buyer.id,
          buyerEmail: buyer.email,
          projectOwnerId: project.createdById,
          projectOwnerEmail: project.createdBy.email,
          projectId: project.id,
        },
      });

      await prisma.payment.create({
        data: {
          buyerId: buyer.id,
          projectId: project.id,
          amount: project.price,
          status: "PENDING",
          transactionId: session.id,
          paymentMethod: "stripe",
        },
      });

      res.status(200).json({
        status: "success",
        data: {
          sessionId: session.id,
          url: session.url,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async webhook(req: RawWebhookRequest, res: Response, next: NextFunction) {
    try {
      const stripe = getStripeClient();
      const signature = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        return next(
          new AppError("STRIPE_WEBHOOK_SECRET is not configured", 500),
        );
      }

      if (typeof signature !== "string") {
        return next(new AppError("Missing Stripe signature", 400));
      }

      if (!req.rawBody) {
        return next(new AppError("Missing raw webhook body", 400));
      }

      const event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        webhookSecret,
      );

      if (
        event.type !== "checkout.session.completed" &&
        event.type !== "checkout.session.async_payment_succeeded"
      ) {
        return res.status(200).json({ received: true });
      }

      const checkoutSession = event.data.object as {
        id?: string;
        metadata?: {
          buyerId?: string;
          projectId?: string;
        };
        amount_total?: number;
        payment_intent?: string;
        payment_method_types?: string[];
      };
      const buyerId = checkoutSession.metadata?.buyerId;
      const projectId = checkoutSession.metadata?.projectId;

      if (!buyerId || !projectId) {
        return next(new AppError("Missing checkout metadata", 400));
      }

      const project = await prisma.graduationProject.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          createdById: true,
          price: true,
        },
      });

      if (!project) {
        return next(new AppError("Project not found.", 404));
      }

      const referenceId = checkoutSession.id;
      const paymentAmount = checkoutSession.amount_total
        ? checkoutSession.amount_total / 100
        : project.price;

      await prisma.$transaction(async (tx) => {
        let payment = await tx.payment.findFirst({
          where: {
            OR: [{ transactionId: referenceId }, { buyerId, projectId }],
          },
          orderBy: { createdAt: "desc" },
        });

        const wasSuccessful = payment?.status === "SUCCESS";

        if (!payment) {
          payment = await tx.payment.create({
            data: {
              buyerId,
              projectId,
              amount: paymentAmount,
              status: "SUCCESS",
              transactionId: referenceId,
              paymentMethod:
                checkoutSession.payment_method_types?.[0] ?? "stripe",
              processedAt: new Date(),
            },
          });
        } else if (!wasSuccessful) {
          payment = await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "SUCCESS",
              amount: paymentAmount,
              transactionId: payment.transactionId ?? referenceId,
              paymentMethod:
                checkoutSession.payment_method_types?.[0] ??
                payment.paymentMethod ??
                "stripe",
              processedAt: new Date(),
            },
          });
        }

        if (!wasSuccessful && payment.status === "SUCCESS") {
          await tx.graduationProject.update({
            where: { id: projectId },
            data: { purchaseCount: { increment: 1 } },
          });

          await tx.user.update({
            where: { id: project.createdById },
            data: {
              balance: {
                increment: paymentAmount,
              },
            },
          });
        }

        const existingSave = await tx.projectSave.findUnique({
          where: {
            userId_projectId: {
              userId: buyerId,
              projectId,
            },
          },
        });

        if (!existingSave) {
          await tx.projectSave.create({
            data: {
              userId: buyerId,
              projectId,
            },
          });
          await tx.graduationProject.update({
            where: { id: projectId },
            data: { savesCount: { increment: 1 } },
          });
        }
      });

      res.status(200).json({ received: true });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
