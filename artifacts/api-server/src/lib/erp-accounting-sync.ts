import type { Database as BetterSqliteDatabase } from "better-sqlite3";

export function runErpAccountingSync(db: BetterSqliteDatabase): void {
  try {
    try { db.exec("ALTER TABLE accounts ADD COLUMN category TEXT"); } catch {}
    try { db.exec("ALTER TABLE accounts ADD COLUMN description TEXT"); } catch {}
    try { db.exec("ALTER TABLE accounts ADD COLUMN is_parent INTEGER DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE accounts ADD COLUMN auto_add INTEGER DEFAULT 1"); } catch {}
    try { db.exec("ALTER TABLE accounts ADD COLUMN level INTEGER DEFAULT 2"); } catch {}
    try { db.exec("ALTER TABLE suppliers ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE customers ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE hr_employees ADD COLUMN account_code TEXT"); } catch {}
    try { db.exec("ALTER TABLE hr_employees ADD COLUMN balance REAL DEFAULT 0"); } catch {}
    try { db.exec("ALTER TABLE orders ADD COLUMN employee_id INTEGER"); } catch {}

    // 1. Ensure standard Omni System Pro ERP Chart of Accounts names & structure
    const accountRenames: Record<string, { name: string; category: string; description: string; type: string; parent_code: string | null; is_parent: number }> = {
      "11100": {
        name: "الصندوق الرئيسي والخزينة",
        category: "الأصول المتداولة - النقدية",
        description: "النقدية المتوفرة بالصندوق الرئيسي",
        type: "asset",
        parent_code: "11000",
        is_parent: 0
      },
      "11200": {
        name: "البنوك والحسابات الجارية",
        category: "الأصول المتداولة - البنوك",
        description: "الأرصدة النقدية في الحسابات البنكية ونقاط البيع",
        type: "asset",
        parent_code: "11000",
        is_parent: 0
      },
      "11300": {
        name: "المخزون السلعي وبضاعة المستودعات",
        category: "الأصول المتداولة - المخزون",
        description: "قيمة البضائع والمنتجات المتوفرة في المخازن والمستودعات",
        type: "asset",
        parent_code: "11000",
        is_parent: 0
      },
      "11400": {
        name: "ذمم العملاء والمدينين التجاريين",
        category: "الأصول المتداولة - العملاء",
        description: "المبالغ المستحقة على العملاء والشركات من مبيعات آجلة",
        type: "asset",
        parent_code: "11000",
        is_parent: 1
      },
      "11500": {
        name: "ضريبة القيمة المضافة للمشتريات (مدخلات)",
        category: "الأصول المتداولة - الضرائب",
        description: "الضرائب المدفوعة على فواتير المشتريات القابلة للاسترداد",
        type: "asset",
        parent_code: "11000",
        is_parent: 0
      },
      "21100": {
        name: "ذمم الموردين والدائنين التجاريين",
        category: "الالتزامات المتداولة - الموردين",
        description: "المبالغ المستحقة للموردين وشركات التوريد والمصانع",
        type: "liability",
        parent_code: "21000",
        is_parent: 1
      },
      "21200": {
        name: "ضريبة القيمة المضافة للمبيعات (مخرجات)",
        category: "الالتزامات المتداولة - الضرائب",
        description: "الضرائب المحصلة على فواتير المبيعات لصالح هيئة الزكاة والضريبة",
        type: "liability",
        parent_code: "21000",
        is_parent: 0
      },
      "21300": {
        name: "ضريبة القيمة المضافة المحصلة (مخرجات)",
        category: "الالتزامات المتداولة - الضرائب",
        description: "الضرائب المحصلة على فواتير المبيعات لصالح هيئة الزكاة والضريبة",
        type: "liability",
        parent_code: "21000",
        is_parent: 0
      },
      "21400": {
        name: "مستحقات الرواتب والأجور وحسابات الموظفين",
        category: "الالتزامات المتداولة - الموظفين",
        description: "الأرصدة والرواتب والبدلات المستحقة للموظفين والعاملين",
        type: "liability",
        parent_code: "21000",
        is_parent: 1
      },
      "41000": {
        name: "إيرادات مبيعات البضائع والمنتجات",
        category: "الإيرادات التشغيلية",
        description: "إجمالي مبيعات الأصناف والمنتجات عبر نقاط البيع والفواتير",
        type: "revenue",
        parent_code: "40000",
        is_parent: 1
      },
      "41100": {
        name: "إيرادات مبيعات التجزئة والمعارض",
        category: "الإيرادات التشغيلية",
        description: "إيرادات المبيعات المباشرة للعملاء عبر الفروع ونقاط البيع",
        type: "revenue",
        parent_code: "41000",
        is_parent: 0
      },
      "41200": {
        name: "إيرادات مبيعات الجملة وعقود التوريد",
        category: "الإيرادات التشغيلية",
        description: "إيرادات مبيعات الجملة وتوريدات الشركات والمؤسسات",
        type: "revenue",
        parent_code: "41000",
        is_parent: 0
      },
      "41300": {
        name: "إيرادات الخدمات والتركيب والصيانة",
        category: "الإيرادات التشغيلية",
        description: "إيرادات الخدمات الفنية والتركيب والدعم",
        type: "revenue",
        parent_code: "41000",
        is_parent: 0
      },
      "41400": {
        name: "إيرادات التوصيل والشحن والخدمات اللوجستية",
        category: "الإيرادات التشغيلية",
        description: "إيرادات خدمات الشحن والتوصيل للعملاء",
        type: "revenue",
        parent_code: "41000",
        is_parent: 0
      },
      "42000": {
        name: "خصومات مكتسبة وحوافز الموردين",
        category: "الإيرادات التشغيلية",
        description: "الحوافز والخصومات المكتسبة من الموردين وعقود التوريد",
        type: "revenue",
        parent_code: "40000",
        is_parent: 0
      },
      "43000": {
        name: "إيرادات تشغيلية وأخرى متنوعة",
        category: "إيرادات أخرى",
        description: "إيرادات متنوعة وعمولات تجارية",
        type: "revenue",
        parent_code: "40000",
        is_parent: 0
      },
      "51000": {
        name: "تكلفة البضاعة المباعة والمشتريات (COGS)",
        category: "تكلفة المبيعات",
        description: "التكلفة المباشرة للبضائع والأصناف المباعة",
        type: "cogs",
        parent_code: "50000",
        is_parent: 1
      },
      "51100": {
        name: "تكلفة مشتريات البضائع والمنتجات",
        category: "تكلفة المبيعات",
        description: "تكلفة شراء البضائع والأصناف التجارية من الموردين",
        type: "cogs",
        parent_code: "51000",
        is_parent: 0
      },
      "51200": {
        name: "تكلفة الشحن والتخليص والنقل للواردات",
        category: "تكلفة المبيعات",
        description: "مصاريف نقل وشحن وتخليص البضائع المشتراة للمستودعات",
        type: "cogs",
        parent_code: "51000",
        is_parent: 0
      },
      "51300": {
        name: "تكلفة التغليف والتعبئة ومواد المخازن",
        category: "تكلفة المبيعات",
        description: "تكاليف مواد التعبئة والتغليف وتجهيز الطلبيات",
        type: "cogs",
        parent_code: "51000",
        is_parent: 0
      },
      "51400": {
        name: "تالف، فاقد، وتسويات عجز المخزون",
        category: "تكلفة المبيعات",
        description: "تكلفة البضائع التالفة أو منتهية الصلاحية وعجز الجرد",
        type: "cogs",
        parent_code: "51000",
        is_parent: 0
      },
      "52500": {
        name: "مصروفات الأنظمة التقنية والاشتراكات السحابية",
        category: "المصروفات العمومية والإدارية",
        description: "اشتراكات أنظمة المحاسبة والمخازن والإنترنت",
        type: "expense",
        parent_code: "52000",
        is_parent: 0
      },
      "61000": {
        name: "الرواتب والأجور والبدلات",
        category: "المصروفات التشغيلية والإدارية",
        description: "رواتب وأجور وبدلات ومكافآت الموظفين والعاملين",
        type: "expense",
        parent_code: "60000",
        is_parent: 0
      },
      "62000": {
        name: "الإيجارات والمرافق والكهرباء والمياه",
        category: "المصروفات التشغيلية والإدارية",
        description: "إيجارات الفروع والمستودعات وفواتير الكهرباء والمياه",
        type: "expense",
        parent_code: "60000",
        is_parent: 0
      },
      "63000": {
        name: "مصروف الرواتب والأجور وعمولات الموظفين",
        category: "المصروفات التشغيلية والإدارية",
        description: "إجمالي مصروفات رواتب وأجور وبدلات وعمولات الموظفين",
        type: "expense",
        parent_code: "60000",
        is_parent: 0
      }
    };

    for (const [code, info] of Object.entries(accountRenames)) {
      const exists = db.prepare("SELECT id FROM accounts WHERE code = ?").get(code);
      if (exists) {
        db.prepare(`
          UPDATE accounts
          SET name = ?, category = ?, description = ?, type = ?, parent_code = ?, is_parent = ?
          WHERE code = ?
        `).run(info.name, info.category, info.description, info.type, info.parent_code, info.is_parent, code);
      } else {
        db.prepare(`
          INSERT INTO accounts (code, name, category, description, type, parent_code, balance, active, is_parent, auto_add, level)
          VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, 1, 2)
        `).run(code, info.name, info.category, info.description, info.type, info.parent_code, info.is_parent);
      }
    }

    // 1.5 Ensure Branches, Warehouses, Commercial Categories & Products
    try {
      const bCount = (db.prepare("SELECT COUNT(*) as c FROM branches").get() as any)?.c || 0;
      if (bCount === 0) {
        db.prepare("INSERT INTO branches (name, address, phone, active) VALUES (?, ?, ?, 1)").run("الفرع الرئيسي - المركز التجاري", "الرياض - طريق الملك فهد", "0112345678");
        db.prepare("INSERT INTO branches (name, address, phone, active) VALUES (?, ?, ?, 1)").run("فرع المبيعات والتوزيع الثاني", "جدة - طريق المدينة", "0126543210");
      }
      const wCount = (db.prepare("SELECT COUNT(*) as c FROM warehouses").get() as any)?.c || 0;
      if (wCount === 0) {
        db.prepare("INSERT INTO warehouses (name, branch_id, location, active) VALUES (?, 1, ?, 1)").run("المستودع المركزي الرئيسي", "الرياض - المنطقة المستودعية");
        db.prepare("INSERT INTO warehouses (name, branch_id, location, active) VALUES (?, 2, ?, 1)").run("مستودع الفرع الثاني", "جدة - حي الصفا");
      }

      const catCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as any)?.c || 0;
      if (catCount === 0) {
        const insCat = db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)");
        insCat.run("المواد الغذائية والتموينية", "#10b981");
        insCat.run("المشروبات والألبان", "#0284c7");
        insCat.run("الأجهزة الإلكترونية وتقنية المعلومات", "#6366f1");
        insCat.run("المستلزمات المكتبية والتغليف", "#f59e0b");
        insCat.run("المنظفات والعناية", "#8b5cf6");
      } else {
        db.prepare("UPDATE categories SET name = 'المواد الغذائية والتموينية' WHERE name = 'تذاكر الطيران'").run();
        db.prepare("UPDATE categories SET name = 'المشروبات والألبان' WHERE name = 'حجوزات الفنادق'").run();
        db.prepare("UPDATE categories SET name = 'الأجهزة الإلكترونية وتقنية المعلومات' WHERE name = 'التأشيرات والدخوليات'").run();
        db.prepare("UPDATE categories SET name = 'المستلزمات المكتبية والتغليف' WHERE name = 'البرامج والباقات السياحية'").run();
      }

      const cats = db.prepare("SELECT id FROM categories ORDER BY id ASC").all() as { id: number }[];
      const c1 = cats[0]?.id || 1;
      const c2 = cats[1]?.id || c1;
      const c3 = cats[2]?.id || c1;
      const c4 = cats[3]?.id || c1;

      const pCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any)?.c || 0;
      if (pCount <= 1) {
        const insProd = db.prepare(`
          INSERT OR IGNORE INTO products (number, name, price, cost, barcode, category_id, active, stock, min_stock, max_stock, unit, supplier_id, warehouse_id, is_sellable, show_in_pos, item_type)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 500, ?, ?, 1, 1, 1, 'sellable')
        `);
        insProd.run(101, "أرز بسمتي هندي درجة أولى (كيس 10 كجم)", 85, 65, "6281000101", c1, 140, 25, "كيس", 1);
        insProd.run(102, "زيت طبخ نباتي صافي (كرتون 6 عبوات)", 98, 75, "6281000102", c1, 90, 20, "كرتون", 1);
        insProd.run(103, "سكر أبيض ناعم (كيس 10 كجم)", 44, 32, "6281000103", c1, 14, 30, "كيس", 2);
        insProd.run(104, "حليب طويل الأجل كامل الدسم (كرتون 12 لتر)", 72, 54, "6281000104", c2, 110, 25, "كرتون", 1);
        insProd.run(105, "قهوة عربية فاخرة محمصة (عبوة 1 كجم)", 68, 48, "6281000105", c2, 9, 20, "عبوة", 2);
        insProd.run(106, "شاي سيلاني ممتاز (كرتون 24 علبة)", 145, 110, "6281000106", c2, 65, 15, "كرتون", 2);
        insProd.run(107, "جهاز قارئ باركود ليزر لاسلكي احترافي", 260, 180, "6281000107", c3, 28, 8, "حبة", 3);
        insProd.run(108, "ورق طباعة فواتير حراري 80مم (كرتون 50 رول)", 135, 95, "6281000108", c4, 11, 20, "كرتون", 3);
      }
      // Also rename any legacy product#1 if it was named with travel text
      db.prepare("UPDATE products SET name = 'أرز بسمتي هندي درجة أولى (كيس 10 كجم)', price = 85, cost = 65, unit = 'كيس', category_id = ? WHERE id = 1 AND (name LIKE '%طيران%' OR name LIKE '%فندق%' OR name LIKE '%تذكرة%' OR price = 0)").run(c1);
    } catch (prodSeedErr) {
      console.warn("Product/Category sync note:", prodSeedErr);
    }

    // 2. Rename legacy seeded travel suppliers to commercial ERP suppliers
    const supplierRenames: Record<string, { name: string; contact_person: string; notes: string }> = {
      "الخطوط الجوية العربية السعودية (Saudia)": {
        name: "شركة التوريدات الغذائية والتجارية العالمية",
        contact_person: "خالد العتيبي",
        notes: "المورد الرئيسي للمواد الغذائية والاستهلاكية"
      },
      "شركة الخطوط الجوية السعودية (Saudia)": {
        name: "شركة التوريدات الغذائية والتجارية العالمية",
        contact_person: "خالد العتيبي",
        notes: "المورد الرئيسي للمواد الغذائية والاستهلاكية"
      },
      "منصة أماديوس العالمية للتوزيع (Amadeus GDS)": {
        name: "الشركة الوطنية لتوزيع الأجهزة والإلكترونيات",
        contact_person: "طارق السعيد",
        notes: "توريد الأجهزة الإلكترونية ومستلزمات التشغيل"
      },
      "مجموعة فنادق هيلتون العالمية": {
        name: "مؤسسة النخبة للمواد الاستهلاكية والجملة",
        contact_person: "سلمان الدوسري",
        notes: "عقود توريد بضائع الجملة والتجزئة"
      },
      "مجموعة فنادق أكور العالمية (Accor Hotels)": {
        name: "مؤسسة النخبة للمواد الاستهلاكية والجملة",
        contact_person: "سلمان الدوسري",
        notes: "عقود توريد بضائع الجملة والتجزئة"
      },
      "شركة الفرسان للنقل البري والليموزين": {
        name: "شركة الإمداد اللوجستي والتجهيزات المكتبية",
        contact_person: "فهد القحطاني",
        notes: "توريد القرطاسية ومواد التعبئة والتغليف"
      },
      "الشركة السعودية للنقل الجماعي (سابتكو SAPTCO)": {
        name: "شركة الإمداد اللوجستي والتجهيزات المكتبية",
        contact_person: "فهد القحطاني",
        notes: "توريد القرطاسية ومواد التعبئة والتغليف"
      },
      "مركز التأشيرات الدولي المعتمد VFS Global": {
        name: "شركة الخليج للتوريدات الصناعية والتغليف",
        contact_person: "طارق السعيد",
        notes: "توريد مستلزمات المخازن والتغليف والأجهزة"
      }
    };

    for (const [oldName, newInfo] of Object.entries(supplierRenames)) {
      db.prepare("UPDATE suppliers SET name = ?, contact_person = ?, notes = ? WHERE name = ?")
        .run(newInfo.name, newInfo.contact_person, newInfo.notes, oldName);
    }

    // 2.5 Seed HR Departments, Employees & Salaries if empty
    try {
      const deptCount = (db.prepare("SELECT COUNT(*) as c FROM hr_departments").get() as any)?.c || 0;
      if (deptCount === 0) {
        const insDept = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?, ?)");
        insDept.run("إدارة المبيعات ونقاط البيع", 150000);
        insDept.run("إدارة المخازن وسلسلة الإمداد", 120000);
        insDept.run("الإدارة المالية والمحاسبة", 100000);
        insDept.run("إدارة المشتريات والتوريد", 90000);
      }

      const empCount = (db.prepare("SELECT COUNT(*) as c FROM hr_employees").get() as any)?.c || 0;
      if (empCount === 0) {
        const depts = db.prepare("SELECT id FROM hr_departments ORDER BY id ASC").all() as { id: number }[];
        const d1 = depts[0]?.id || 1;
        const d2 = depts[1]?.id || d1;
        const d3 = depts[2]?.id || d1;
        const d4 = depts[3]?.id || d1;

        const insEmp = db.prepare(`
          INSERT INTO hr_employees (employee_number, name, phone, position, department_id, basic_salary, hire_date, active, account_code, balance)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);
        insEmp.run("1", "أحمد محمد الغامدي", "0501122334", "مدير المبيعات ونقاط البيع", d1, 8500, "2024-01-15", "21401", 0);
        insEmp.run("2", "خالد عبدالله القحطاني", "0552233445", "أمين المستودع المركزي", d2, 6500, "2024-03-01", "21402", 6500);
        insEmp.run("3", "عمر سعيد باوزير", "0563344556", "محاسب مالي أول", d3, 7500, "2024-02-10", "21403", 0);
        insEmp.run("4", "فهد عبدالرحمن الدوسري", "0544455667", "أخصائي المشتريات والتوريد", d4, 6000, "2024-05-20", "21404", 6200);

        const curMonth = new Date().toISOString().slice(0, 7);
        const insSal = db.prepare(`
          INSERT INTO hr_salaries (employee_id, month, basic_salary, bonuses, deductions, net_salary, status, payment_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insSal.run(1, curMonth, 8500, 500, 0, 9000, "paid", new Date().toISOString().slice(0, 10), "راتب شهر معتمد ومصروف من الصندوق الرئيسي");
        insSal.run(2, curMonth, 6500, 300, 300, 6500, "pending", null, "راتب مستحق قيد الصرف");
        insSal.run(3, curMonth, 7500, 0, 0, 7500, "paid", new Date().toISOString().slice(0, 10), "راتب شهر معتمد ومصروف");
        insSal.run(4, curMonth, 6000, 400, 200, 6200, "pending", null, "راتب مستحق قيد الصرف");
      }
    } catch (hrSeedErr) {
      console.warn("HR seed note:", hrSeedErr);
    }

    // 2.6 Seed 10 Purchasing Services sample records if any table is empty
    try {
      const supps = db.prepare("SELECT * FROM suppliers ORDER BY id ASC").all() as any[];
      const prods = db.prepare("SELECT * FROM products ORDER BY id ASC").all() as any[];
      const s1 = supps[0] || { id: 1, name: "شركة التوريدات الغذائية والتجارية العالمية" };
      const s2 = supps[1] || s1;
      const p1 = prods[0] || { id: 1, name: "أرز بسمتي هندي درجة أولى (كيس 10 كجم)", cost: 65, unit: "كيس" };
      const p2 = prods[1] || p1;
      const todayStr = new Date().toISOString().slice(0, 10);

      // PR
      const prCount = (db.prepare("SELECT COUNT(*) as c FROM purchase_requests").get() as any)?.c || 0;
      if (prCount === 0) {
        const prRes = db.prepare(`
          INSERT INTO purchase_requests (pr_number, requester_name, department, branch_id, warehouse_id, request_date, need_date, priority, reason, status, approved_by, approval_date, notes)
          VALUES ('PR-00001-10', 'خالد عبدالله القحطاني', 'إدارة المخازن', 1, 1, ?, ?, 'عالي', 'تعزيز مخزون المواد الغذائية الأساسية', 'approved', 'مدير النظام العام', ?, 'طلب شراء معتمد للتوريد')
        `).run(todayStr, todayStr, todayStr);
        db.prepare(`
          INSERT INTO purchase_request_items (pr_id, product_id, product_name, unit, requested_qty, need_date, notes)
          VALUES (?, ?, ?, ?, 50, ?, 'مواصفات درجة أولى')
        `).run(prRes.lastInsertRowid, p1.id, p1.name, p1.unit || "كيس", todayStr);
      }

      // RFQ
      const rfqCount = (db.prepare("SELECT COUNT(*) as c FROM purchase_rfqs").get() as any)?.c || 0;
      if (rfqCount === 0) {
        db.prepare(`
          INSERT INTO purchase_rfqs (rfq_number, pr_id, item_name, quantity, unit, supplier_id, supplier_name, unit_price, lead_time_days, total_price, quality_rating, payment_terms, status, notes)
          VALUES ('RFQ-00001-20', 1, ?, 50, ?, ?, ?, 65, 2, 3250, 5, '30 يوم', 'selected', 'أفضل عرض سعر وتوريد فوري')
        `).run(p1.name, p1.unit || "كيس", s1.id, s1.name);
      }

      // PO
      const poCount = (db.prepare("SELECT COUNT(*) as c FROM purchase_orders").get() as any)?.c || 0;
      let poId = 1;
      if (poCount === 0) {
        const poRes = db.prepare(`
          INSERT INTO purchase_orders (po_number, pr_id, supplier_id, branch_id, warehouse_id, order_date, expected_delivery_date, status, subtotal, discount, tax, shipping_cost, total, payment_terms, delivery_terms, approval_tier, approved_by, approved_at, shipment_status, notes)
          VALUES ('PO-00001-30', 1, ?, 1, 1, ?, ?, 'received', 3250, 0, 487.5, 0, 3737.5, '30 يوم', 'تسليم المستودع المركزي', 'branch', 'مدير النظام العام', ?, 'delivered', 'أمر شراء رسمي معتمد')
        `).run(s1.id, todayStr, todayStr, todayStr);
        poId = Number(poRes.lastInsertRowid);
        db.prepare(`
          INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, received_qty, unit_price, total)
          VALUES (?, ?, ?, 50, 50, 65, 3250)
        `).run(poId, p1.id, p1.name);
      }

      // GRN
      const grnCount = (db.prepare("SELECT COUNT(*) as c FROM goods_receipt_notes").get() as any)?.c || 0;
      let grnId = 1;
      if (grnCount === 0) {
        const grnRes = db.prepare(`
          INSERT INTO goods_receipt_notes (grn_number, po_id, supplier_id, supplier_name, branch_id, warehouse_id, received_date, delivery_note_ref, received_by, qc_passed, notes)
          VALUES ('GRN-00001-40', ?, ?, ?, 1, 1, ?, 'DN-2026-101', 'خالد عبدالله القحطاني', 1, 'تم الفحص والاستلام بالمواصفات الكاملة')
        `).run(poId, s1.id, s1.name, todayStr);
        grnId = Number(grnRes.lastInsertRowid);
        db.prepare(`
          INSERT INTO goods_receipt_items (grn_id, product_id, product_name, ordered_qty, received_qty, accepted_qty, rejected_qty, temperature, expiry_date, batch_number, quality_status)
          VALUES (?, ?, ?, 50, 50, 50, 0, 22, '2027-12-31', 'BATCH-2026-01', 'مطابق بالمواصفات')
        `).run(grnId, p1.id, p1.name);
      }

      // Purchase Invoice
      const pinvCount = (db.prepare("SELECT COUNT(*) as c FROM purchase_invoices").get() as any)?.c || 0;
      let invId = 1;
      if (pinvCount === 0) {
        const invRes = db.prepare(`
          INSERT INTO purchase_invoices (invoice_number, supplier_invoice_ref, po_id, grn_id, supplier_id, supplier_name, branch_id, warehouse_id, invoice_date, due_date, subtotal, discount, tax, shipping_cost, additional_expenses, total, paid_amount, remaining_amount, payment_status, payment_method, is_direct_purchase, notes)
          VALUES ('PINV-00001-50', 'SUP-INV-901', ?, ?, ?, ?, 1, 1, ?, ?, 3250, 0, 487.5, 0, 0, 3737.5, 1737.5, 2000, 'partially_paid', 'cash', 0, 'فاتورة توريد بضاعة للمستودع المركزي')
        `).run(poId, grnId, s1.id, s1.name, todayStr, todayStr);
        invId = Number(invRes.lastInsertRowid);
        db.prepare(`
          INSERT INTO purchase_invoice_items (invoice_id, product_id, product_name, unit, quantity, unit_price, discount, tax, total)
          VALUES (?, ?, ?, ?, 50, 65, 0, 487.5, 3737.5)
        `).run(invId, p1.id, p1.name, p1.unit || "كيس");
      } else {
        const firstInv = db.prepare("SELECT id FROM purchase_invoices ORDER BY id ASC LIMIT 1").get() as any;
        if (firstInv) invId = firstInv.id;
      }

      // Contract
      const cntCount = (db.prepare("SELECT COUNT(*) as c FROM supplier_contracts").get() as any)?.c || 0;
      if (cntCount === 0) {
        db.prepare(`
          INSERT INTO supplier_contracts (contract_number, supplier_id, supplier_name, title, start_date, end_date, agreed_amount, payment_terms, status, notes)
          VALUES ('CNT-00001', ?, ?, 'عقد توريد المواد الغذائية والتموينية السنوي', '2026-01-01', '2026-12-31', 250000, '30 يوم', 'active', 'عقد توريد معتمد بأسعار ثابتة')
        `).run(s1.id, s1.name);
      }

      // Purchase Return
      const pretCount = (db.prepare("SELECT COUNT(*) as c FROM purchase_returns").get() as any)?.c || 0;
      if (pretCount === 0) {
        const pretRes = db.prepare(`
          INSERT INTO purchase_returns (return_number, supplier_id, supplier_name, invoice_id, return_date, total_amount, status, notes, created_by)
          VALUES ('PRET-00001', ?, ?, ?, ?, 150, 'approved', 'إرجاع كرتونين لوجود تلف في التغليف الخارجي', 'مدير النظام العام')
        `).run(s2.id, s2.name, invId, todayStr);
        db.prepare(`
          INSERT INTO purchase_return_items (return_id, product_id, product_name, quantity, unit_price, total_price)
          VALUES (?, ?, ?, 2, 75, 150)
        `).run(pretRes.lastInsertRowid, p2.id, p2.name);
      }
    } catch (purchSeedErr) {
      console.warn("Purchasing seed note:", purchSeedErr);
    }

    // 2.7 Clean up legacy travel descriptions in orders, order_items, journal_entries, and safe_transactions
    try {
      db.prepare("UPDATE orders SET note = 'فاتورة مبيعات مواد غذائية وتموينية بالجملة - العميل عبدالله العتيبي' WHERE id = 1 AND note LIKE '%سياح%'").run();
      db.prepare("UPDATE orders SET note = 'فاتورة مبيعات أجهزة قارئ باركود ومستلزمات مكتبية' WHERE id = 2 AND note LIKE '%تأشيرة%'").run();
      db.prepare("UPDATE orders SET note = 'فاتورة مبيعات مشروبات وقهوة عربية فاخرة' WHERE id = 3 AND note LIKE '%سابتكو%'").run();

      db.prepare("UPDATE order_items SET product_name = 'أرز بسمتي هندي درجة أولى (كيس 10 كجم)', category_name = 'المواد الغذائية والتموينية' WHERE product_name LIKE '%تذكرة طيران%'").run();
      db.prepare("UPDATE order_items SET product_name = 'زيت طبخ نباتي صافي (كرتون 6 عبوات)', category_name = 'المواد الغذائية والتموينية' WHERE product_name LIKE '%أتلانتس%' OR product_name LIKE '%فندق%'").run();
      db.prepare("UPDATE order_items SET product_name = 'جهاز قارئ باركود ليزر لاسلكي احترافي', category_name = 'الأجهزة الإلكترونية وتقنية المعلومات' WHERE product_name LIKE '%شنغن%'").run();
      db.prepare("UPDATE order_items SET product_name = 'ورق طباعة فواتير حراري 80مم (كرتون 50 رول)', category_name = 'المستلزمات المكتبية والتغليف' WHERE product_name LIKE '%صالة فرسان%'").run();
      db.prepare("UPDATE order_items SET product_name = 'قهوة عربية فاخرة محمصة (عبوة 1 كجم)', category_name = 'المشروبات والألبان' WHERE product_name LIKE '%سابتكو%'").run();

      db.prepare("UPDATE journal_entries SET description = 'قيد استحقاق وإثبات فاتورة مبيعات نقدية #INV-2026-001 - العميل عبدالله العتيبي' WHERE entry_number = 'JV-2026-001' AND description LIKE '%طيران%'").run();
      db.prepare("UPDATE journal_entries SET description = 'قيد سداد دفعة للمورد شركة التوريدات الغذائية والتجارية العالمية' WHERE entry_number = 'JV-2026-002' AND description LIKE '%الخطوط السعودية%'").run();
      db.prepare("UPDATE journal_entries SET description = 'إثبات فاتورة مبيعات نقدية #INV-2026-003 - العميل فاطمة الزهراني' WHERE entry_number = 'JV-2026-003' AND description LIKE '%سابتكو%'").run();

      db.prepare("UPDATE journal_entry_lines SET description = 'تحصيل نقدي بالصندوق الرئيسي مقابل فاتورة مبيعات #INV-2026-001' WHERE description LIKE '%INV-TRV-2026-001%'").run();
      db.prepare("UPDATE journal_entry_lines SET description = 'إثبات إيرادات مبيعات البضائع والمنتجات التجارية' WHERE description LIKE '%خدمات السفر والسياحة%' OR description LIKE '%النقل البري الحافلات%'").run();
      db.prepare("UPDATE journal_entry_lines SET description = 'سداد دفعة لحساب المورد شركة التوريدات الغذائية والتجارية العالمية (21101)' WHERE description LIKE '%الخطوط السعودية%'").run();
      db.prepare("UPDATE journal_entry_lines SET description = 'تحصيل نقدي بالصندوق الرئيسي مقابل فاتورة مبيعات #INV-2026-003' WHERE description LIKE '%تذكرة سابتكو%'").run();

      db.prepare("UPDATE safe_transactions SET statement = 'قبض قيمة فاتورة مبيعات نقدية #INV-2026-001', reference_number = 'INV-2026-001' WHERE statement LIKE '%تذكرة طيران%'").run();
    } catch {}

    // 3. Sync Suppliers with Chart of Accounts under 21100
    const suppliers = db.prepare("SELECT * FROM suppliers ORDER BY id ASC").all() as any[];
    const validSupplierCodes = new Set<string>();

    // First clean up unused 211XX accounts so canonical 21101, 21102, ... are free
    try {
      const subAccs = db.prepare("SELECT id, code FROM accounts WHERE parent_code = '21100' AND code != '21100'").all() as { id: number; code: string }[];
      const currentSuppCodes = new Set(suppliers.map(s => s.account_code).filter(Boolean));
      for (const sa of subAccs) {
        if (!currentSuppCodes.has(sa.code)) {
          const usedCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entry_lines WHERE account_id = ?").get(sa.id) as any)?.c || 0;
          if (usedCount === 0) {
            db.prepare("DELETE FROM accounts WHERE id = ?").run(sa.id);
          }
        }
      }
    } catch {}

    for (const supp of suppliers) {
      const rawName = (supp.name || `مورد #${supp.id}`).trim();
      const sName = rawName.startsWith("مورد:") ? rawName : `مورد: ${rawName}`;
      const canonicalCode = `211${String(supp.id).padStart(2, "0")}`;
      const oldCode = supp.account_code;

      // If supplier had an old non-canonical code (like 21118) and canonicalCode is free, migrate it to canonicalCode
      if (oldCode && oldCode !== canonicalCode) {
        const canonicalOccupied = db.prepare("SELECT id FROM accounts WHERE code = ?").get(canonicalCode) as any;
        const oldAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(oldCode) as any;
        if (oldAcc && !canonicalOccupied) {
          db.prepare("UPDATE accounts SET code = ?, name = ? WHERE id = ?").run(canonicalCode, sName, oldAcc.id);
          db.prepare("UPDATE suppliers SET account_code = ? WHERE id = ?").run(canonicalCode, supp.id);
          supp.account_code = canonicalCode;
        }
      }

      const code = canonicalCode;
      let existingAcc = db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any;
      if (!existingAcc) {
        db.prepare(`
          INSERT INTO accounts (code, name, category, type, parent_code, balance, active, is_parent, auto_add, level, description)
          VALUES (?, ?, 'الالتزامات المتداولة - الموردين', 'liability', '21100', ?, 1, 0, 1, 3, ?)
        `).run(code, sName, Number(supp.balance || 0), `حساب الذمم الدائنة للمورد ${rawName}`);
      } else {
        db.prepare(`
          UPDATE accounts
          SET name = ?, category = 'الالتزامات المتداولة - الموردين', parent_code = '21100', type = 'liability', balance = ?, description = ?
          WHERE code = ?
        `).run(sName, Number(supp.balance || 0), `حساب الذمم الدائنة للمورد ${rawName}`, code);
      }

      if (supp.account_code !== code) {
        db.prepare("UPDATE suppliers SET account_code = ? WHERE id = ?").run(code, supp.id);
      }
      validSupplierCodes.add(code);
    }

    // Remove any remaining unused sub-accounts under 21100
    try {
      const subAccs = db.prepare("SELECT id, code FROM accounts WHERE parent_code = '21100' AND code != '21100'").all() as { id: number; code: string }[];
      for (const sa of subAccs) {
        if (!validSupplierCodes.has(sa.code)) {
          const usedCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entry_lines WHERE account_id = ?").get(sa.id) as any)?.c || 0;
          if (usedCount === 0) {
            db.prepare("DELETE FROM accounts WHERE id = ?").run(sa.id);
          }
        }
      }
    } catch {}

    // Roll up supplier sub-accounts into parent 21100
    const totalSuppBalance = (db.prepare("SELECT COALESCE(SUM(balance), 0) as s FROM accounts WHERE parent_code = '21100'").get() as any)?.s ?? 0;
    db.prepare("UPDATE accounts SET balance = ? WHERE code = '21100'").run(Number(totalSuppBalance));

    // 4. Sync Customers with Chart of Accounts under 11400
    const getNextCustomerSubCode = () => {
      const rows = db.prepare("SELECT code FROM accounts WHERE code LIKE '114%' AND code != '11400'").all() as { code: string }[];
      let maxNum = 11400;
      for (const r of rows) {
        const num = parseInt(r.code, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      return String(maxNum + 1);
    };

    const customers = db.prepare("SELECT * FROM customers ORDER BY id ASC").all() as any[];
    for (const cust of customers) {
      // PREVENT employee customer account creation & delete rogue employee customers
      const isEmployee = db.prepare("SELECT id FROM hr_employees WHERE TRIM(name) = TRIM(?)").get(cust.name) as any;
      if (isEmployee) {
        try {
          db.prepare("DELETE FROM customers WHERE id = ?").run(cust.id);
        } catch {}
        continue;
      }

      const rawName = (cust.name || `عميل #${cust.id}`).trim();
      const cName = rawName.startsWith("عميل:") ? rawName : `عميل: ${rawName}`;
      const expectedCode = `114${String(cust.id).padStart(2, "0")}`;
      let code = (cust.account_code && String(cust.account_code).startsWith("114") && cust.account_code !== "11400")
        ? cust.account_code
        : expectedCode;

      let existingAcc = db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any;
      if (!existingAcc) {
        const accByName = db.prepare("SELECT * FROM accounts WHERE parent_code = '11400' AND (name = ? OR name = ?)").get(cName, rawName) as any;
        if (accByName) {
          code = accByName.code;
          existingAcc = accByName;
        } else {
          if (db.prepare("SELECT id FROM accounts WHERE code = ?").get(code)) {
            code = getNextCustomerSubCode();
          }
        }
      }

      // Compute authoritative customer balance from journal entries if available, otherwise from cust.balance
      const jlBalRes = db.prepare("SELECT COALESCE(SUM(debit - credit), 0) as s, COUNT(*) as c FROM journal_entry_lines WHERE account_code = ? OR account_id = ?").get(code, existingAcc?.id || -1) as any;
      const hasJournalLines = jlBalRes && jlBalRes.c > 0;
      const custBal = hasJournalLines ? Math.max(0, Math.round(Number(jlBalRes.s || 0) * 100) / 100) : Number(cust.balance || 0);

      if (Number(cust.balance || 0) !== custBal) {
        db.prepare("UPDATE customers SET balance = ? WHERE id = ?").run(custBal, cust.id);
      }

      if (!existingAcc) {
        db.prepare(`
          INSERT INTO accounts (code, name, category, type, parent_code, balance, active, is_parent, auto_add, level, description)
          VALUES (?, ?, 'الأصول المتداولة - العملاء', 'asset', '11400', ?, 1, 0, 1, 3, ?)
        `).run(code, cName, custBal, `حساب الذمم المدينة للعميل ${rawName}`);
      } else {
        db.prepare(`
          UPDATE accounts
          SET name = ?, category = 'الأصول المتداولة - العملاء', parent_code = '11400', type = 'asset', balance = ?, description = ?
          WHERE code = ?
        `).run(cName, custBal, `حساب الذمم المدينة للعميل ${rawName}`, code);
      }

      if (cust.account_code && String(cust.account_code).startsWith("112") && cust.account_code !== "11200") {
        const oldAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(cust.account_code) as any;
        const newAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(code) as any;
        if (oldAcc && newAcc) {
          try {
            db.prepare("UPDATE journal_entry_lines SET account_id = ? WHERE account_id = ?").run(newAcc.id, oldAcc.id);
            db.prepare("DELETE FROM accounts WHERE id = ?").run(oldAcc.id);
          } catch {}
        }
      }

      if (cust.account_code !== code) {
        db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(code, cust.id);
      }
    }

    // Remove unused 112XX accounts under 11200
    try {
      db.exec(`
        DELETE FROM accounts
        WHERE parent_code = '11200'
          AND code LIKE '112%'
          AND code != '11200'
          AND id NOT IN (SELECT DISTINCT account_id FROM journal_entry_lines WHERE account_id IS NOT NULL)
      `);
    } catch {}

    // Roll up customer sub-accounts into parent 11400
    const totalCustBalance = (db.prepare("SELECT COALESCE(SUM(balance), 0) as s FROM accounts WHERE parent_code = '11400'").get() as any)?.s ?? 0;
    db.prepare("UPDATE accounts SET balance = ? WHERE code = '11400'").run(Number(totalCustBalance));

    // 4.5. Sync Employees with Chart of Accounts under 21400 & normalize employee_number to integers 1, 2, 3...
    try {
      const employees = db.prepare("SELECT * FROM hr_employees ORDER BY id ASC").all() as any[];
      const usedEmpNums = new Set<number>();
      for (const emp of employees) {
        const curNumStr = String(emp.employee_number || "").trim();
        if (/^[1-9]\d*$/.test(curNumStr)) {
          usedEmpNums.add(parseInt(curNumStr, 10));
        }
      }
      let nextSequentialEmpNum = 1;
      for (const emp of employees) {
        const curNumStr = String(emp.employee_number || "").trim();
        if (!/^[1-9]\d*$/.test(curNumStr)) {
          while (usedEmpNums.has(nextSequentialEmpNum)) {
            nextSequentialEmpNum++;
          }
          const newNumStr = String(nextSequentialEmpNum);
          usedEmpNums.add(nextSequentialEmpNum);
          try {
            db.prepare("UPDATE hr_employees SET employee_number = ? WHERE id = ?").run(newNumStr, emp.id);
            emp.employee_number = newNumStr;
          } catch {}
        }
      }

      // Also normalize travel_corporate_employees employee_number to integers 1, 2, 3...
      try {
        const corpEmps = db.prepare("SELECT id, employee_number FROM travel_corporate_employees ORDER BY id ASC").all() as any[];
        const usedCorpNums = new Set<number>();
        for (const ce of corpEmps) {
          const s = String(ce.employee_number || "").trim();
          if (/^[1-9]\d*$/.test(s)) usedCorpNums.add(parseInt(s, 10));
        }
        let nextCorpNum = 1;
        for (const ce of corpEmps) {
          const s = String(ce.employee_number || "").trim();
          if (!/^[1-9]\d*$/.test(s)) {
            while (usedCorpNums.has(nextCorpNum)) nextCorpNum++;
            db.prepare("UPDATE travel_corporate_employees SET employee_number = ? WHERE id = ?").run(String(nextCorpNum), ce.id);
            usedCorpNums.add(nextCorpNum);
          }
        }
      } catch {}
      for (const emp of employees) {
        const rawName = (emp.name || `موظف #${emp.id}`).trim();
        const eName = rawName.startsWith("موظف:") ? rawName : `موظف: ${rawName}`;
        const code = (emp.account_code && String(emp.account_code).startsWith("214") && emp.account_code !== "21400")
          ? emp.account_code
          : `214${String(emp.id).padStart(2, "0")}`;

        // Compute authoritative employee balance from journal entries if available, otherwise from pending salaries
        const pendingSal = (db.prepare("SELECT COALESCE(SUM(net_salary), 0) as s FROM hr_salaries WHERE employee_id = ? AND status != 'paid'").get(emp.id) as any)?.s ?? 0;
        const jlBalRes = db.prepare("SELECT COALESCE(SUM(credit - debit), 0) as s, COUNT(*) as c FROM journal_entry_lines WHERE account_code = ? OR account_id IN (SELECT id FROM accounts WHERE code = ?)").get(code, code) as any;
        const hasJournalLines = jlBalRes && jlBalRes.c > 0;
        const empBal = hasJournalLines ? Math.round(Number(jlBalRes.s || 0) * 100) / 100 : (Number(emp.balance || 0) !== 0 ? Number(emp.balance) : Number(pendingSal));

        if (Number(emp.balance || 0) !== empBal) {
          db.prepare("UPDATE hr_employees SET balance = ? WHERE id = ?").run(empBal, emp.id);
        }

        const existingAcc = db.prepare("SELECT * FROM accounts WHERE code = ?").get(code) as any;
        if (!existingAcc) {
          db.prepare(`
            INSERT INTO accounts (code, name, category, type, parent_code, balance, active, is_parent, auto_add, level, description)
            VALUES (?, ?, 'الالتزامات المتداولة - الموظفين', 'liability', '21400', ?, 1, 0, 1, 3, ?)
          `).run(code, eName, empBal, `حساب الرواتب والمستحقات للموظف ${rawName}`);
        } else {
          db.prepare(`
            UPDATE accounts
            SET name = ?, category = 'الالتزامات المتداولة - الموظفين', parent_code = '21400', type = 'liability', balance = ?, description = ?
            WHERE code = ?
          `).run(eName, empBal, `حساب الرواتب والمستحقات للموظف ${rawName}`, code);
        }

        if (emp.account_code !== code) {
          db.prepare("UPDATE hr_employees SET account_code = ? WHERE id = ?").run(code, emp.id);
        }
      }

      const totalEmpBalance = (db.prepare("SELECT COALESCE(SUM(balance), 0) as s FROM accounts WHERE parent_code = '21400'").get() as any)?.s ?? 0;
      db.prepare("UPDATE accounts SET balance = ? WHERE code = '21400'").run(Number(totalEmpBalance));

      // Ensure seeded HR salaries have journal entries if none exist yet
      const payrollJvCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries WHERE source_type IN ('payroll', 'payroll_accrual')").get() as any)?.c || 0;
      if (payrollJvCount === 0) {
        const allSals = db.prepare("SELECT s.*, e.name as emp_name, e.account_code as emp_code FROM hr_salaries s JOIN hr_employees e ON e.id = s.employee_id ORDER BY s.id ASC").all() as any[];
        const acc61000 = db.prepare("SELECT id FROM accounts WHERE code = '61000'").get() as any;
        const acc11100 = db.prepare("SELECT id FROM accounts WHERE code = '11100'").get() as any;
        for (const sal of allSals) {
          const empAcc = db.prepare("SELECT id, code FROM accounts WHERE code = ?").get(sal.emp_code || `214${String(sal.employee_id).padStart(2, "0")}`) as any;
          if (!empAcc || !acc61000) continue;
          const net = Number(sal.net_salary || 0);
          if (net <= 0) continue;
          const jvCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries").get() as any)?.c || 0;
          const jvNum = `JV-${String(jvCount + 1).padStart(5, "0")}`;
          const jvDate = sal.payment_date || `${sal.month}-28`;
          if (sal.status === "paid" && acc11100) {
            const jvRes = db.prepare(`
              INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id, currency, currency_rate, reference_no, doc_type, entry_class)
              VALUES (?, ?, ?, 'payroll', ?, 'SAR', 1.0, ?, 'مسير رواتب', 'شؤون الموظفين')
            `).run(jvNum, jvDate, `احتساب وصرف راتب شهر ${sal.month} للموظف ${sal.emp_name}`, sal.id, `SAL-${sal.id}`);
            const jvId = jvRes.lastInsertRowid;
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, '61000', ?, 0, ?, 'SAR', 1.0)")
              .run(jvId, acc61000.id, net, `مصروف راتب شهر ${sal.month} - ${sal.emp_name}`);
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, ?, 0, ?, ?, 'SAR', 1.0)")
              .run(jvId, empAcc.id, empAcc.code, net, `استحقاق راتب شهر ${sal.month} - ${sal.emp_name}`);
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, ?, ?, 0, ?, 'SAR', 1.0)")
              .run(jvId, empAcc.id, empAcc.code, net, `تسوية وصرف راتب شهر ${sal.month} - ${sal.emp_name}`);
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, '11100', 0, ?, ?, 'SAR', 1.0)")
              .run(jvId, acc11100.id, net, `صرف نقدي لراتب شهر ${sal.month} - ${sal.emp_name}`);
            db.prepare("UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(net, acc61000.id);
          } else {
            const jvRes = db.prepare(`
              INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id, currency, currency_rate, reference_no, doc_type, entry_class)
              VALUES (?, ?, ?, 'payroll_accrual', ?, 'SAR', 1.0, ?, 'استحقاق راتب', 'شؤون الموظفين')
            `).run(jvNum, jvDate, `احتساب استحقاق راتب شهر ${sal.month} للموظف ${sal.emp_name}`, sal.id, `SAL-${sal.id}`);
            const jvId = jvRes.lastInsertRowid;
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, '61000', ?, 0, ?, 'SAR', 1.0)")
              .run(jvId, acc61000.id, net, `مصروف راتب شهر ${sal.month} - ${sal.emp_name}`);
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, ?, 0, ?, ?, 'SAR', 1.0)")
              .run(jvId, empAcc.id, empAcc.code, net, `استحقاق راتب شهر ${sal.month} في ذمة الشركة للموظف ${sal.emp_name}`);
            db.prepare("UPDATE accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(net, acc61000.id);
          }
        }
      }
    } catch (empSyncErr) {
      console.error("Employee account sync error:", empSyncErr);
    }

    // 5. Reconcile any existing purchase invoice (e.g. PINV-00001-50) so its journal entry points to the supplier sub-account (211XX) and records its paid_amount in supplier_payments
    try {
      const invs = db.prepare("SELECT * FROM purchase_invoices WHERE supplier_id IS NOT NULL").all() as any[];
      const acc11100 = db.prepare("SELECT id FROM accounts WHERE code = '11100'").get() as any;
      const acc11200 = db.prepare("SELECT id FROM accounts WHERE code = '11200'").get() as any;
      const acc11300 = db.prepare("SELECT id FROM accounts WHERE code = '11300'").get() as any;
      const acc11500 = db.prepare("SELECT id FROM accounts WHERE code = '11500'").get() as any;
      const acc21100 = db.prepare("SELECT id FROM accounts WHERE code = '21100'").get() as any;

      for (const inv of invs) {
        const supp = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(inv.supplier_id) as any;
        if (!supp || !supp.account_code) continue;
        const suppAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(supp.account_code) as any;
        if (!suppAcc) continue;

        // Ensure purchase journal entry exists and credits supplier's sub-account
        let jv = db.prepare("SELECT id FROM journal_entries WHERE source_type = 'purchase' AND source_id = ?").get(inv.id) as any;
        if (!jv && acc11300) {
          const jvCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries").get() as any)?.c || 0;
          const jvNum = `JV-${String(jvCount + 1).padStart(5, "0")}`;
          const invDate = inv.invoice_date || new Date().toISOString().slice(0, 10);
          const totalAmt = Number(inv.total || 0);
          const taxAmt = Number(inv.tax || 0);
          const netInv = Math.max(0, totalAmt - taxAmt);
          const jvRes = db.prepare(`
            INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id, currency, currency_rate, reference_no, doc_type, entry_class)
            VALUES (?, ?, ?, 'purchase', ?, 'SAR', 1.0, ?, 'فاتورة مشتريات', 'مشتريات')
          `).run(jvNum, invDate, `فاتورة مشتريات رقم ${inv.invoice_number} من المورد ${supp.name}`, inv.id, inv.invoice_number);
          const newJvId = jvRes.lastInsertRowid;
          db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, '11300', ?, 0, ?, 'SAR', 1.0)")
            .run(newJvId, acc11300.id, netInv, `توريد بضاعة للمخزن (المخزون السلعي) - فاتورة مشتريات ${inv.invoice_number}`);
          if (taxAmt > 0 && acc11500) {
            db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, '11500', ?, 0, ?, 'SAR', 1.0)")
              .run(newJvId, acc11500.id, taxAmt, `ضريبة القيمة المضافة للمدخلات - فاتورة ${inv.invoice_number}`);
          }
          db.prepare("INSERT INTO journal_entry_lines (journal_entry_id, account_id, account_code, debit, credit, description, currency, exchange_rate) VALUES (?, ?, ?, 0, ?, ?, 'SAR', 1.0)")
            .run(newJvId, suppAcc.id, supp.account_code, totalAmt, `استحقاق فاتورة مشتريات رقم ${inv.invoice_number} للمورد ${supp.name} (${supp.account_code})`);
        } else if (jv && acc21100) {
          db.prepare(`
            UPDATE journal_entry_lines
            SET account_id = ?, account_code = ?, description = ?
            WHERE journal_entry_id = ? AND account_id = ? AND credit > 0
          `).run(
            suppAcc.id,
            supp.account_code,
            `استحقاق فاتورة مشتريات رقم ${inv.invoice_number} للمورد ${supp.name} (${supp.account_code})`,
            jv.id,
            acc21100.id
          );
          db.prepare(`
            UPDATE journal_entry_lines
            SET description = ?
            WHERE journal_entry_id = ? AND debit > 0
          `).run(
            `توريد بضاعة للمخزن (المخزون السلعي) - فاتورة مشتريات ${inv.invoice_number}`,
            jv.id
          );
        }

        // If invoice has paid_amount > 0 but no payment voucher in supplier_payments, create it and its journal entry
        const paidAmt = Number(inv.paid_amount || 0);
        if (paidAmt > 0) {
          const existingPay = db.prepare("SELECT id FROM supplier_payments WHERE invoice_id = ?").get(inv.id) as any;
          if (!existingPay && acc11100) {
            const payCount = (db.prepare("SELECT COUNT(*) as c FROM supplier_payments").get() as any)?.c || 0;
            const payNum = `SPAY-${String(payCount + 1).padStart(5, "0")}`;
            const payDate = inv.invoice_date || new Date().toISOString().slice(0, 10);
            const payMethod = inv.payment_method === "credit" ? "cash" : (inv.payment_method || "cash");
            const payRes = db.prepare(`
              INSERT INTO supplier_payments (payment_number, supplier_id, supplier_name, invoice_id, payment_date, amount, payment_method, reference_number, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              payNum,
              supp.id,
              supp.name,
              inv.id,
              payDate,
              paidAmt,
              payMethod,
              inv.invoice_number,
              `دفعة مسددة مع فاتورة المشتريات رقم ${inv.invoice_number}`
            );

            const jvCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries").get() as any)?.c || 0;
            const jvNum = `JV-${String(jvCount + 1).padStart(5, "0")}`;
            const cashAccId = (payMethod === "bank" || payMethod === "bank_transfer" ? acc11200?.id : acc11100?.id) || acc11100.id;
            const jvRes = db.prepare(`
              INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id, currency, currency_rate, reference_no, doc_type, entry_class)
              VALUES (?, ?, ?, 'voucher', ?, 'SAR', 1.0, ?, 'سند صرف مورد', 'مشتريات')
            `).run(
              jvNum,
              payDate,
              `سند صرف سداد دفعة فاتورة مشتريات ${inv.invoice_number} للمورد ${supp.name} (#${payNum})`,
              payRes.lastInsertRowid,
              payNum
            );

            const newJvId = jvRes.lastInsertRowid;
            db.prepare(`
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, currency, exchange_rate)
              VALUES (?, ?, ?, 0, ?, 'SAR', 1.0)
            `).run(newJvId, suppAcc.id, paidAmt, `سداد دفعة من فاتورة المشتريات ${inv.invoice_number} للمورد ${supp.name} (${supp.account_code})`);
            db.prepare(`
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, currency, exchange_rate)
              VALUES (?, ?, 0, ?, ?, 'SAR', 1.0)
            `).run(newJvId, cashAccId, paidAmt, `صرف مقابل فاتورة المشتريات ${inv.invoice_number}`);
          }
        }
      }
    } catch (recErr) {
      console.error("Error reconciling purchase invoices:", recErr);
    }

    // 6. Ensure Safes & Inventory valuation sync with Chart of Accounts
    try {
      db.prepare("UPDATE safes SET account_code = '11100' WHERE account_code IS NULL OR account_code = ''").run();
      const safeBal = (db.prepare("SELECT COALESCE(SUM(balance), 0) as s FROM safes WHERE active = 1").get() as any)?.s ?? 0;
      const cur11100 = (db.prepare("SELECT balance FROM accounts WHERE code = '11100'").get() as any)?.balance ?? 0;
      if (Number(cur11100) < 0 && Number(safeBal) > 0) {
        db.prepare("UPDATE accounts SET balance = ? WHERE code = '11100'").run(Number(safeBal));
      }
      const invVal = (db.prepare("SELECT COALESCE(SUM(COALESCE(stock, 0) * COALESCE(cost, 0)), 0) as v FROM products WHERE active = 1").get() as any)?.v ?? 0;
      const cur11300 = (db.prepare("SELECT balance FROM accounts WHERE code = '11300'").get() as any)?.balance ?? 0;
      if (Number(cur11300) <= 0 && Number(invVal) > 0) {
        db.prepare("UPDATE accounts SET balance = ? WHERE code = '11300'").run(Number(invVal));
      }

      // Self-healing clean up of any customer accounts (114XX) or customer rows created for employees
      try {
        const emps = db.prepare("SELECT id, name FROM hr_employees").all() as { id: number; name: string }[];
        for (const e of emps) {
          const empName = e.name.trim();
          const cName = empName.startsWith("عميل:") ? empName : `عميل: ${empName}`;
          
          // Delete customer record from customers table permanently
          db.prepare("DELETE FROM customers WHERE TRIM(name) = ? OR TRIM(name) = ? OR TRIM(name) LIKE ?").run(empName, `عميل: ${empName}`, `%${empName}%`);
          
          // Find accounts in COA named after this employee and remap/delete
          const rogueCustAccs = db.prepare("SELECT id, code FROM accounts WHERE TRIM(name) = ? OR TRIM(name) = ? OR TRIM(name) = ? OR TRIM(name) LIKE ?").all(cName, empName, `عميل: ${empName}`, `%${empName}%`) as any[];
          for (const rogueCustAcc of rogueCustAccs) {
            if (rogueCustAcc.code.startsWith("114") || rogueCustAcc.code.startsWith("112")) {
              const empCode = `214${String(e.id).padStart(2, "0")}`;
              const empAcc = db.prepare("SELECT id FROM accounts WHERE code = ?").get(empCode) as any;
              if (empAcc) {
                db.prepare("UPDATE journal_entry_lines SET account_id = ?, account_code = ? WHERE account_id = ?").run(empAcc.id, empCode, rogueCustAcc.id);
              }
              db.prepare("DELETE FROM accounts WHERE id = ?").run(rogueCustAcc.id);
            }
          }
        }
      } catch (cleanEmpCustErr) {
        console.error("Error cleaning up employee customer accounts:", cleanEmpCustErr);
      }
    } catch {}
  } catch (err) {
    console.error("runErpAccountingSync error:", err);
  }
}

export function getSupplierSubAccountCode(db: BetterSqliteDatabase, supplierId: number | null | undefined, supplierName?: string): string {
  if (!supplierId && !supplierName) return "21100";
  try {
    runErpAccountingSync(db);
    if (supplierId) {
      const supp = db.prepare("SELECT id, name, account_code FROM suppliers WHERE id = ?").get(supplierId) as any;
      if (supp?.account_code && db.prepare("SELECT id FROM accounts WHERE code = ?").get(supp.account_code)) {
        return supp.account_code;
      }
      const code = `211${String(supplierId).padStart(2, "0")}`;
      const rawName = (supp?.name || supplierName || `مورد #${supplierId}`).trim();
      const sName = rawName.startsWith("مورد:") ? rawName : `مورد: ${rawName}`;
      if (!db.prepare("SELECT id FROM accounts WHERE code = ?").get(code)) {
        db.prepare(`
          INSERT INTO accounts (code, name, category, type, parent_code, balance, active, is_parent, auto_add, level, description)
          VALUES (?, ?, 'الالتزامات المتداولة - الموردين', 'liability', '21100', 0, 1, 0, 1, 3, ?)
        `).run(code, sName, `حساب الذمم الدائنة للمورد ${rawName}`);
      }
      db.prepare("UPDATE suppliers SET account_code = ? WHERE id = ?").run(code, supplierId);
      return code;
    }
    if (supplierName) {
      const byName = db.prepare("SELECT account_code FROM suppliers WHERE name = ?").get(supplierName.trim()) as any;
      if (byName?.account_code) return byName.account_code;
    }
  } catch {}
  return "21100";
}

export function getCustomerSubAccountCode(db: BetterSqliteDatabase, customerId: number | null | undefined, customerName?: string): string {
  if (!customerId && !customerName) return "11400";
  try {
    runErpAccountingSync(db);
    if (customerId) {
      const cust = db.prepare("SELECT id, name, account_code FROM customers WHERE id = ?").get(customerId) as any;
      if (cust?.account_code && String(cust.account_code).startsWith("114") && cust.account_code !== "11400" && db.prepare("SELECT id FROM accounts WHERE code = ?").get(cust.account_code)) {
        return cust.account_code;
      }
      const code = `114${String(customerId).padStart(2, "0")}`;
      const rawName = (cust?.name || customerName || `عميل #${customerId}`).trim();
      const cName = rawName.startsWith("عميل:") ? rawName : `عميل: ${rawName}`;
      if (!db.prepare("SELECT id FROM accounts WHERE code = ?").get(code)) {
        db.prepare(`
          INSERT INTO accounts (code, name, category, type, parent_code, balance, active, is_parent, auto_add, level, description)
          VALUES (?, ?, 'الأصول المتداولة - العملاء', 'asset', '11400', 0, 1, 0, 1, 3, ?)
        `).run(code, cName, `حساب الذمم المدينة للعميل ${rawName}`);
      }
      db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(code, customerId);
      return code;
    }
    if (customerName) {
      const byName = db.prepare("SELECT account_code FROM customers WHERE name = ?").get(customerName.trim()) as any;
      if (byName?.account_code && String(byName.account_code).startsWith("114")) return byName.account_code;
    }
  } catch {}
  return "11400";
}

export function getEmployeeSubAccountCode(db: BetterSqliteDatabase, employeeId: number | null | undefined, employeeName?: string): string {
  if (!employeeId) return "21400";
  try {
    runErpAccountingSync(db);
    const emp = db.prepare("SELECT id, name, account_code FROM hr_employees WHERE id = ?").get(employeeId) as any;
    if (emp?.account_code && db.prepare("SELECT id FROM accounts WHERE code = ?").get(emp.account_code)) {
      return emp.account_code;
    }
    const code = `214${String(employeeId).padStart(2, "0")}`;
    const rawName = (emp?.name || employeeName || `موظف #${employeeId}`).trim();
    const eName = rawName.startsWith("موظف:") ? rawName : `موظف: ${rawName}`;
    if (!db.prepare("SELECT id FROM accounts WHERE code = ?").get(code)) {
      db.prepare(`
        INSERT INTO accounts (code, name, category, type, parent_code, balance, active, is_parent, auto_add, level, description)
        VALUES (?, ?, 'الالتزامات المتداولة - الموظفين', 'liability', '21400', 0, 1, 0, 1, 3, ?)
      `).run(code, eName, `حساب الرواتب والمستحقات للموظف ${rawName}`);
    }
    db.prepare("UPDATE hr_employees SET account_code = ? WHERE id = ?").run(code, employeeId);
    return code;
  } catch {
    return "21400";
  }
}

export function updateSafeBalance(db: BetterSqliteDatabase, deltaAmount: number, safeId = 1): void {
  if (!deltaAmount) return;
  try {
    let targetSafe = db.prepare("SELECT id, name FROM safes WHERE id = ?").get(safeId) as any;
    if (!targetSafe) {
      targetSafe = db.prepare("SELECT id, name FROM safes ORDER BY id ASC LIMIT 1").get() as any;
    }
    if (!targetSafe) {
      const ins = db.prepare("INSERT INTO safes (name, balance, currency, notes, active, account_code) VALUES (?, 0, 'ريال', 'الصندوق الرئيسي للنظام', 1, '11100')").run("الصندوق الرئيسي");
      targetSafe = { id: ins.lastInsertRowid, name: "الصندوق الرئيسي" };
    }
    db.prepare("UPDATE safes SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(Number(deltaAmount), targetSafe.id);
  } catch (e) {
    console.warn("updateSafeBalance notice:", e);
  }
}

export function recordSafeOrBankMovement(
  db: BetterSqliteDatabase,
  params: {
    method?: string | null;
    amount: number;
    direction?: "in" | "out";
    type?: "in" | "out";
    statement?: string;
    description?: string;
    reference_number?: string;
    referenceType?: string;
    referenceId?: number | string | null;
    safe_id?: number | null;
    safeId?: number | null;
    bank_account_id?: number | null;
    bankAccountId?: number | null;
    user_id?: number | null;
    userId?: number | null;
    user_name?: string | null;
    userName?: string | null;
  }
): void {
  const amt = Math.abs(Number(params.amount) || 0);
  if (amt <= 0) return;
  const dir = params.direction || params.type || "out";
  const delta = dir === "in" ? amt : -amt;
  const m = (params.method || "cash").toLowerCase();
  const isBank = m === "bank" || m === "bank_transfer" || m === "card" || m === "credit_card" || m === "check" || m === "cheque" || m === "11200";
  const effectiveSafeId = params.safe_id ?? params.safeId ?? null;
  const effectiveBankId = params.bank_account_id ?? params.bankAccountId ?? null;
  const effectiveUserId = params.user_id ?? params.userId ?? 1;
  const effectiveUserName = params.user_name || params.userName || "مدير النظام";
  const effectiveRef = params.reference_number || (params.referenceType && params.referenceId ? `${params.referenceType.toUpperCase()}-${params.referenceId}` : (params.referenceId ? String(params.referenceId) : null));
  const effectiveStatement = (params.statement || params.description || (dir === "in" ? "حركة قبض نقدي بالصندوق" : "حركة صرف نقدي من الصندوق")).trim();

  try {
    if (isBank) {
      let bank = effectiveBankId
        ? (db.prepare("SELECT id FROM bank_accounts WHERE id = ?").get(effectiveBankId) as any)
        : (db.prepare("SELECT id FROM bank_accounts WHERE active = 1 ORDER BY id ASC LIMIT 1").get() as any);
      if (bank) {
        db.prepare("UPDATE bank_accounts SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(delta, bank.id);
      }
    } else {
      let safe = effectiveSafeId
        ? (db.prepare("SELECT id, name FROM safes WHERE id = ?").get(effectiveSafeId) as any)
        : (db.prepare("SELECT id, name FROM safes ORDER BY id ASC LIMIT 1").get() as any);
      if (!safe) {
        const ins = db.prepare("INSERT INTO safes (name, balance, currency, notes, active, account_code) VALUES ('الصندوق الرئيسي', 0, 'ريال', 'الصندوق الرئيسي للنظام', 1, '11100')").run();
        safe = { id: ins.lastInsertRowid, name: "الصندوق الرئيسي" };
      }
      db.prepare("UPDATE safes SET balance = COALESCE(balance, 0) + ? WHERE id = ?").run(delta, safe.id);

      // Log into safe_transactions
      const trxNum = `TRX-SAF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      db.prepare(`
        INSERT INTO safe_transactions (transaction_number, safe_id, safe_name, date, user_id, user_name, amount, currency, statement, reference_number, operation_type)
        VALUES (?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, 'ريال', ?, ?, ?)
      `).run(
        trxNum,
        safe.id,
        safe.name || "الصندوق الرئيسي",
        effectiveUserId,
        effectiveUserName,
        amt,
        effectiveStatement,
        effectiveRef,
        dir === "in" ? "receipt" : "expense"
      );
    }
  } catch (e) {
    console.warn("recordSafeOrBankMovement notice:", e);
  }
}

