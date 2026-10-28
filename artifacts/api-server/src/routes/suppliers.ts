import { Router } from "express";
import { db, logAudit, syncSupplierAccounts } from "../lib/sqlite";
import { runErpAccountingSync } from "../lib/erp-accounting-sync";
import { getAuthUser } from "./auth";

const router = Router();

function requireSupplierAccess(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح - يرجى تسجيل الدخول" });
    return null;
  }
  return user;
}

// GET all suppliers with up-to-date computed balance
router.get("/suppliers", (_req, res) => {
  try {
    try { runErpAccountingSync(db); } catch {}
    const suppliers = db.prepare(`
      SELECT s.*,
        COALESCE(s.balance, 0) as balance,
        (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id = s.id) as orders_count,
        (SELECT COUNT(*) FROM purchase_invoices WHERE supplier_id = s.id) as invoices_count
      FROM suppliers s 
      ORDER BY s.name ASC
    `).all();
    res.json(suppliers);
  } catch (e: any) {
    console.error("Error fetching suppliers:", e);
    try {
      const fallback = db.prepare("SELECT * FROM suppliers ORDER BY name ASC").all();
      res.json(fallback);
    } catch {
      res.status(500).json({ error: "فشل في جلب قائمة الموردين" });
    }
  }
});

// GET single supplier by ID
router.get("/suppliers/:id", (req, res) => {
  try {
    const supplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id);
    if (!supplier) {
      res.status(404).json({ error: "المورد غير موجود" });
      return;
    }
    res.json(supplier);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// CREATE a new supplier
router.post("/suppliers", (req, res) => {
  const user = requireSupplierAccess(req, res);
  if (!user) return;

  const {
    name,
    phone,
    mobile_number,
    email,
    address,
    tax_number,
    commercial_register,
    payment_terms,
    contact_person,
    bank_name,
    bank_account,
    notes,
    rating,
    balance
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: "اسم المورد / الشركة مطلوب" });
    return;
  }

  try {
    const r = db.prepare(`
      INSERT INTO suppliers (
        name, phone, mobile_number, email, address, tax_number, commercial_register,
        payment_terms, contact_person, bank_name, bank_account, notes, rating, balance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      phone?.trim() || null,
      mobile_number?.trim() || null,
      email?.trim() || null,
      address?.trim() || null,
      tax_number?.trim() || null,
      commercial_register?.trim() || null,
      payment_terms?.trim() || "30 يوم",
      contact_person?.trim() || null,
      bank_name?.trim() || null,
      bank_account?.trim() || null,
      notes?.trim() || null,
      rating !== undefined ? Number(rating) : 5,
      balance !== undefined ? Number(balance) : 0
    );

    try { runErpAccountingSync(db); } catch {}
    const createdSupplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(r.lastInsertRowid);
    logAudit(user.id, user.name, "إضافة مورد جديد", `تمت إضافة المورد: ${name} (معرف: ${r.lastInsertRowid})`);

    res.status(201).json(createdSupplier);
  } catch (e: any) {
    console.error("Error creating supplier:", e);
    res.status(500).json({ error: "فشل في حفظ بيانات المورد: " + e.message });
  }
});

// UPDATE existing supplier
router.put("/suppliers/:id", (req, res) => {
  const user = requireSupplierAccess(req, res);
  if (!user) return;

  const {
    name,
    phone,
    mobile_number,
    email,
    address,
    tax_number,
    commercial_register,
    payment_terms,
    contact_person,
    bank_name,
    bank_account,
    notes,
    rating,
    balance
  } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: "اسم المورد مطلوب" });
    return;
  }

  try {
    const existing = db.prepare("SELECT id FROM suppliers WHERE id = ?").get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "المورد غير موجود" });
      return;
    }

    db.prepare(`
      UPDATE suppliers SET
        name = ?,
        phone = ?,
        mobile_number = ?,
        email = ?,
        address = ?,
        tax_number = ?,
        commercial_register = ?,
        payment_terms = ?,
        contact_person = ?,
        bank_name = ?,
        bank_account = ?,
        notes = ?,
        rating = COALESCE(?, rating),
        balance = COALESCE(?, balance)
      WHERE id = ?
    `).run(
      name.trim(),
      phone?.trim() || null,
      mobile_number?.trim() || null,
      email?.trim() || null,
      address?.trim() || null,
      tax_number?.trim() || null,
      commercial_register?.trim() || null,
      payment_terms?.trim() || "30 يوم",
      contact_person?.trim() || null,
      bank_name?.trim() || null,
      bank_account?.trim() || null,
      notes?.trim() || null,
      rating !== undefined ? Number(rating) : null,
      balance !== undefined ? Number(balance) : null,
      req.params.id
    );

    try { runErpAccountingSync(db); } catch {}
    const updated = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id);
    logAudit(user.id, user.name, "تعديل بيانات مورد", `تم تعديل المورد: ${name} (معرف: ${req.params.id})`);

    res.json(updated);
  } catch (e: any) {
    console.error("Error updating supplier:", e);
    res.status(500).json({ error: "فشل في تعديل بيانات المورد: " + e.message });
  }
});

// DELETE supplier
router.delete("/suppliers/:id", (req, res) => {
  const user = requireSupplierAccess(req, res);
  if (!user) return;

  try {
    const supplier = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id) as any;
    if (!supplier) {
      res.status(404).json({ error: "المورد غير موجود" });
      return;
    }

    // Check if supplier has linked invoices or orders
    const linkedInvoices = db.prepare("SELECT COUNT(*) as count FROM purchase_invoices WHERE supplier_id = ?").get(req.params.id) as { count: number };
    const linkedOrders = db.prepare("SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = ?").get(req.params.id) as { count: number };

    if (linkedInvoices.count > 0 || linkedOrders.count > 0) {
      res.status(400).json({
        error: `لا يمكن حذف المورد لوجود ${linkedInvoices.count} فاتورة و ${linkedOrders.count} أمر شراء مرتبطين به. يمكنك تعديل بياناته بدلاً من ذلك.`
      });
      return;
    }

    db.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
    try { runErpAccountingSync(db); } catch {}
    logAudit(user.id, user.name, "حذف مورد", `تم حذف المورد: ${supplier.name} (معرف: ${req.params.id})`);

    res.status(204).send();
  } catch (e: any) {
    console.error("Error deleting supplier:", e);
    res.status(500).json({ error: "فشل في حذف المورد: " + e.message });
  }
});

export default router;

