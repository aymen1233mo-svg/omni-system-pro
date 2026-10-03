import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAuth(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return user;
}

router.get("/recipes/:productId", (req, res) => {
  const recipes = db.prepare("SELECT * FROM product_recipes WHERE product_id=?").all(req.params.productId);
  const modifiers = db.prepare("SELECT * FROM product_modifiers WHERE product_id=?").all(req.params.productId);
  res.json({ recipes, modifiers });
});

router.post("/recipes", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { product_id, ingredient_name, quantity, unit } = req.body;
  const r = db.prepare("INSERT INTO product_recipes (product_id, ingredient_name, quantity, unit) VALUES (?,?,?,?)")
    .run(product_id, ingredient_name, quantity ?? 1, unit ?? "جم");
  res.status(201).json({ id: r.lastInsertRowid, product_id, ingredient_name, quantity, unit });
});

router.delete("/recipes/:id", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.prepare("DELETE FROM product_recipes WHERE id=?").run(req.params.id);
  res.status(204).send();
});

router.post("/modifiers", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { product_id, name, price } = req.body;
  const r = db.prepare("INSERT INTO product_modifiers (product_id, name, price) VALUES (?,?,?)")
    .run(product_id, name, price ?? 0);
  res.status(201).json({ id: r.lastInsertRowid, product_id, name, price: price ?? 0 });
});

router.delete("/modifiers/:id", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.prepare("DELETE FROM product_modifiers WHERE id=?").run(req.params.id);
  res.status(204).send();
});

// Transactional Production / Manufacturing Order Endpoint
router.post("/recipes/produce", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity <= 0) {
    res.status(400).json({ error: "بيانات غير صالحة: يرجى تحديد الصنف والكمية المطلوبة للإنتاج" });
    return;
  }

  const product = db.prepare("SELECT * FROM products WHERE id=?").get(productId) as any;
  if (!product) {
    res.status(404).json({ error: "الصنف المراد تصنيعه غير موجود" });
    return;
  }

  const recipes = db.prepare("SELECT * FROM product_recipes WHERE product_id=?").all(productId) as any[];
  if (recipes.length === 0) {
    res.status(400).json({ error: "لا يمكن إنتاج هذا الصنف لأنه لا توجد وصفة (مكونات) مسجلة له" });
    return;
  }

  // 1. Verify availability of ingredients before any database writes
  const ingredientsToDeduct: { ingredient: any; requiredQty: number }[] = [];

  for (const rec of recipes) {
    const ingProduct = db.prepare("SELECT * FROM products WHERE name=? COLLATE NOCASE LIMIT 1").get(rec.ingredient_name) as any;
    if (!ingProduct) {
      res.status(400).json({ error: `فشل الإنتاج: المكون "${rec.ingredient_name}" المسجل في الوصفة غير موجود في قائمة المستودع` });
      return;
    }
    const requiredQty = rec.quantity * quantity;
    const currentStock = ingProduct.stock ?? 0;
    if (currentStock < requiredQty) {
      res.status(400).json({ 
        error: `عجز في المخزون للمكون "${rec.ingredient_name}": الكمية المتوفرة ${currentStock} ${rec.unit}، بينما الكمية المطلوبة للإنتاج هي ${requiredQty} ${rec.unit}` 
      });
      return;
    }
    ingredientsToDeduct.push({ ingredient: ingProduct, requiredQty });
  }

  // 2. Perform transactional updates
  try {
    db.transaction(() => {
      const prodOrderRef = `PRD-${Date.now().toString().slice(-6)}`;
      
      // A) Deduct ingredients and log stock movements
      for (const item of ingredientsToDeduct) {
        const { ingredient, requiredQty } = item;
        const prevStock = ingredient.stock ?? 0;
        const newStock = prevStock - requiredQty;
        
        db.prepare("UPDATE products SET stock=? WHERE id=?").run(newStock, ingredient.id);
        
        db.prepare(`
          INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
          VALUES (?, 'out', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          ingredient.id,
          requiredQty,
          prevStock,
          newStock,
          `استهلاك مكونات لإنتاج الصنف: ${product.name}`,
          prodOrderRef,
          user.id,
          user.name
        );
      }

      // B) Add quantity to produced composite product and log stock movement
      const prevProductStock = product.stock ?? 0;
      const newProductStock = prevProductStock + quantity;

      db.prepare("UPDATE products SET stock=? WHERE id=?").run(newProductStock, product.id);

      db.prepare(`
        INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, reason, reference_id, user_id, user_name)
        VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product.id,
        quantity,
        prevProductStock,
        newProductStock,
        "عملية إنتاج وتصنيع داخلي للوصفة",
        prodOrderRef,
        user.id,
        user.name
      );

      // C) Log ERP Auditing
      logAudit(user.id, user.name, "أمر إنتاج وتصنيع", `إنتاج ${quantity} وحدة من الصنف [${product.name}] - كود أمر الإنتاج ${prodOrderRef}`);
    })();

    res.json({ success: true, message: `تم تسجيل أمر الإنتاج وتصنيع ${quantity} وحدة من الصنف "${product.name}" بنجاح!` });
  } catch (error: any) {
    console.error("Failed production order transaction:", error);
    res.status(500).json({ error: "حدث خطأ غير متوقع أثناء معالجة أمر الإنتاج والمخازن: " + error.message });
  }
});

export default router;
