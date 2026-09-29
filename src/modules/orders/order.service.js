import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { notify } from "../control/notification.service.js";
import { customerService } from "../customers/customer.service.js";
import { compensationRepo } from "../compensation/compensation.repo.js";
import { compensationService } from "../compensation/compensation.service.js";
import { FraudCase } from "../control/fraud.model.js";
import { productRepo } from "../products/product.repo.js";
import { orderRepo, presentOrder } from "./order.repo.js";

const transitions = {
  payment_pending: ["paid", "cancelled"],
  paid: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: ["return_requested"],
  return_requested: ["returned"],
  returned: ["refunded"],
  refunded: [],
  cancelled: [],
};

const staffMoves = new Set(["paid", "packed", "shipped", "delivered", "returned", "refunded"]);

export const orderService = {
  async list(actor) {
    const staff = !["customer", "partner"].includes(actor.role);
    const rows = staff ? await orderRepo.list() : await orderRepo.listForUser(actor.id);
    return rows.map(presentOrder);
  },

  async create(actor, { productId, qty, partnerEmail }) {
    const product = await productRepo.findById(productId);
    if (!product || !product.active) throw new ApiError(400, "That product is not available.");
    let attributed = null;
    if (actor.role === "partner") {
      attributed = actor.id;
    } else if (actor.role === "customer") {
      attributed = await customerService.partnerForCheckout(actor, partnerEmail);
    }
    const order = await orderRepo.create({
      number: `ORD-${Date.now()}`,
      buyer: actor.id,
      attributedPartner: attributed,
      product: product._id,
      productName: product.name,
      sku: product.sku,
      qty,
      price: product.price,
      pv: product.pv,
      bv: product.bv,
      commissionEligible: product.commissionEligible,
      rankEligible: product.rankEligible,
      bonusEligible: product.bonusEligible,
      networkEligible: product.networkEligible,
      total: product.price * qty,
      status: "payment_pending",
    });
    await notify(actor.id, "Order placed", `${order.number} is waiting for payment.`);
    return presentOrder(await orderRepo.findById(order._id));
  },

  async changeStatus(actor, id, status) {
    const order = await orderRepo.findById(id);
    if (!order) throw new ApiError(404, "Order not found.");
    const allowed = transitions[order.status] || [];
    if (!allowed.includes(status)) throw new ApiError(400, `This order cannot move from ${order.status} to ${status}.`);
    const isBuyer = String(order.buyer?._id || order.buyer) === String(actor.id);
    if (staffMoves.has(status) && !actor.permissions.includes("orders.update")) {
      throw new ApiError(403, "You cannot update fulfilment.");
    }
    if ((status === "cancelled" || status === "return_requested") && !isBuyer && !actor.permissions.includes("orders.update")) {
      throw new ApiError(403, "You cannot change this order.");
    }
    if (status === "return_requested") {
      const plan = await compensationRepo.activePlan();
      const days = plan?.returnDays || 30;
      const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
      if (!deliveredAt || Date.now() > deliveredAt.getTime() + days * 24 * 60 * 60 * 1000) {
        throw new ApiError(400, "The return window for this order has ended.");
      }
    }
    order.status = status;
    if (status === "delivered" && !order.deliveredAt) order.deliveredAt = new Date();
    await order.save();
    if (status === "delivered") await compensationService.onDelivered(order);
    if (status === "refunded") {
      await compensationService.onRefunded(order);
      const refunds = await orderRepo.countRefunded(order.buyer._id);
      if (refunds >= 2) {
        await FraudCase.create({
          user: order.buyer._id,
          pattern: "repeated_refund",
          status: "open",
          note: `${order.number} is another refund for this buyer.`,
          order: order._id,
        });
      }
    }
    await notify(order.buyer._id, "Order updated", `${order.number} is now ${status}.`);
    return presentOrder(await orderRepo.findById(id));
  },

  async remove(actor, id) {
    const order = await orderRepo.findById(id);
    if (!order) throw new ApiError(404, "Order not found.");
    if (order.volumePosted) throw new ApiError(409, "This order already posted volume. Refund it instead of deleting it.");
    await orderRepo.remove(id);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "order.deleted",
      entity: "order",
      entityId: String(id),
      before: { number: order.number, status: order.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },
};
