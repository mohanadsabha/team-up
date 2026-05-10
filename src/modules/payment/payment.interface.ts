import z, { ZodType } from "zod";

export type StringObject = Record<string, unknown>;

export const idParamSchema = z.object({
  id: z.string().trim().uuid(),
}) satisfies ZodType;

export type IdParam = z.infer<typeof idParamSchema>;

export const createPaymentSchema = z.object({
  projectId: z.string().trim().uuid(),
  paymentMethod: z
    .enum(["CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "E_WALLET"])
    .optional(),
}) satisfies ZodType;

export const updatePaymentStatusSchema = z.object({
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]),
}) satisfies ZodType;

export const getPaymentsQuerySchema = z.object({
  status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
  projectId: z.string().trim().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}) satisfies ZodType;

export type CreatePayment = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatus = z.infer<typeof updatePaymentStatusSchema>;
export type GetPaymentsQuery = z.infer<typeof getPaymentsQuerySchema>;

export type MessageResponse = {
  success: boolean;
  message: string;
};

export type ProjectPreviewResponse = {
  id: string;
  title: string;
  price: number;
};

export type PaymentResponse = {
  id: string;
  buyerId: string;
  projectId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  transactionId: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentDetailsResponse = MessageResponse & {
  payment: PaymentResponse & {
    project: ProjectPreviewResponse;
  };
};

export type PaymentsListResponse = MessageResponse & {
  results: number;
  payments: (PaymentResponse & {
    project: ProjectPreviewResponse;
  })[];
};

export type TransactionHistoryResponse = MessageResponse & {
  results: number;
  transactions: (PaymentResponse & {
    project: ProjectPreviewResponse;
  })[];
};

export type PaymentStatsResponse = MessageResponse & {
  totalRevenue: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
};
