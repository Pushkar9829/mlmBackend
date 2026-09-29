import { ApiError } from "../../utils/api-error.js";
import { auditService } from "../audit/audit.service.js";
import { Order } from "../orders/order.model.js";
import { presentProduct, productRepo } from "./product.repo.js";

export const productService = {
  async list(actor) {
    const manage = actor.permissions.includes("products.manage");
    const rows = await productRepo.list(!manage);
    return rows.map(presentProduct);
  },
  async save(actor, fields, id) {
    if (id) {
      const before = await productRepo.findById(id);
      if (!before) throw new ApiError(404, "Product not found.");
      const updated = await productRepo.update(id, fields);
      await auditService.record({
        actor: actor.id,
        actorEmail: actor.email,
        action: "product.updated",
        entity: "product",
        entityId: String(id),
        before: { price: before.price, pv: before.pv, bv: before.bv },
        after: { price: updated.price, pv: updated.pv, bv: updated.bv },
        ip: actor.ip,
        userAgent: actor.userAgent,
      });
      return presentProduct(updated);
    }
    const existing = await productRepo.findBySku(fields.sku);
    if (existing) throw new ApiError(409, "That SKU already exists.");
    const created = await productRepo.create(fields);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "product.created",
      entity: "product",
      entityId: String(created._id),
      after: { sku: created.sku, price: created.price },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return presentProduct(created);
  },
  async remove(actor, id) {
    const before = await productRepo.findById(id);
    if (!before) throw new ApiError(404, "Product not found.");
    const used = await Order.exists({ product: id });
    if (used) throw new ApiError(409, "This product is on an order, so it cannot be deleted.");
    await productRepo.remove(id);
    await auditService.record({
      actor: actor.id,
      actorEmail: actor.email,
      action: "product.deleted",
      entity: "product",
      entityId: String(id),
      before: { sku: before.sku, name: before.name },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  },
};
