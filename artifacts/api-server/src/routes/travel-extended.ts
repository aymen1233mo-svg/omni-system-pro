import { Router } from "express";
import { db, createDoubleEntryJournal, updateDoubleEntryJournal, deleteDoubleEntryJournal, logAudit, syncSupplierAccounts, ensureTravelBusBookingsColumns } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { getCustomerAccountCode, getSupplierAccountCode } from "./customers";
import { syncJournalEntryForSource, buildTravelJournalLines } from "./travel";
import { getBusinessDate } from "../lib/business-day";

const router = Router();

// ============================================================================
// MODULE 15: TOUR PACKAGES & DAILY ITINERARY (برامج الرحلات السياحية)
// ============================================================================
router.get("/travel/packages", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM travel_package_itinerary WHERE package_id = p.id) as itinerary_days_count
    FROM travel_packages p
    ORDER BY p.id DESC
  `).all();
  res.json(rows);
});

router.get("/travel/packages/:id", (req, res) => {
  const pkg = db.prepare("SELECT * FROM travel_packages WHERE id = ?").get(req.params.id);
  if (!pkg) {
    res.status(404).json({ error: "البرنامج السياحي غير موجود" });
    return;
  }
  const itinerary = db.prepare("SELECT * FROM travel_package_itinerary WHERE package_id = ? ORDER BY day_number ASC").all(req.params.id);
  res.json({ ...pkg, itinerary });
});

router.post("/travel/packages", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    package_code, title, destination, days_count, nights_count,
    hotels_info, trips_info, transport_info, meals_info, activities_info,
    tour_guide, insurance_info, cost_price, selling_price, commission, notes, itinerary
  } = req.body;

  if (!title || !destination) {
    res.status(400).json({ error: "عنوان البرنامج والوجهة مطلوبان" });
    return;
  }

  const code = package_code || `PKG-${Date.now().toString().slice(-6)}`;
  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;

  const stmt = db.prepare(`
    INSERT INTO travel_packages (
      package_code, title, destination, days_count, nights_count,
      hotels_info, trips_info, transport_info, meals_info, activities_info,
      tour_guide, insurance_info, cost_price, selling_price, commission, profit, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    code, title, destination, Number(days_count || 1), Number(nights_count || 0),
    hotels_info || null, trips_info || null, transport_info || null, meals_info || null, activities_info || null,
    tour_guide || null, insurance_info || null, cost, sell, comm, prof, notes || null
  );

  const pkgId = Number(info.lastInsertRowid);

  // Insert itinerary days if provided
  if (Array.isArray(itinerary)) {
    const insDay = db.prepare(`
      INSERT INTO travel_package_itinerary (package_id, day_number, title, description, activity_time, location, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    itinerary.forEach((day: any, idx: number) => {
      insDay.run(
        pkgId, day.day_number || (idx + 1), day.title || `اليوم ${idx + 1}`,
        day.description || null, day.activity_time || null, day.location || null, day.notes || null
      );
    });
  }

  const newPkg = db.prepare("SELECT * FROM travel_packages WHERE id = ?").get(pkgId);
  const days = db.prepare("SELECT * FROM travel_package_itinerary WHERE package_id = ? ORDER BY day_number ASC").all(pkgId);

  res.status(201).json({ ...newPkg, itinerary: days });
});

router.put("/travel/packages/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    title, destination, days_count, nights_count,
    hotels_info, trips_info, transport_info, meals_info, activities_info,
    tour_guide, insurance_info, cost_price, selling_price, commission, status, notes
  } = req.body;

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;

  db.prepare(`
    UPDATE travel_packages SET
      title=?, destination=?, days_count=?, nights_count=?,
      hotels_info=?, trips_info=?, transport_info=?, meals_info=?, activities_info=?,
      tour_guide=?, insurance_info=?, cost_price=?, selling_price=?, commission=?, profit=?, status=?, notes=?
    WHERE id=?
  `).run(
    title, destination, Number(days_count || 1), Number(nights_count || 0),
    hotels_info || null, trips_info || null, transport_info || null, meals_info || null, activities_info || null,
    tour_guide || null, insurance_info || null, cost, sell, comm, prof, status || 'active', notes || null,
    req.params.id
  );

  const updatedPkg = db.prepare("SELECT * FROM travel_packages WHERE id = ?").get(req.params.id);
  res.json(updatedPkg);
});

router.delete("/travel/packages/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_packages WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

router.post("/travel/packages/:id/itinerary", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { day_number, title, description, activity_time, location, notes } = req.body;
  const stmt = db.prepare(`
    INSERT INTO travel_package_itinerary (package_id, day_number, title, description, activity_time, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(req.params.id, Number(day_number || 1), title, description || null, activity_time || null, location || null, notes || null);
  const newDay = db.prepare("SELECT * FROM travel_package_itinerary WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newDay);
});

router.delete("/travel/packages/itinerary/:dayId", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_package_itinerary WHERE id = ?").run(req.params.dayId);
  res.status(204).send();
});


// ============================================================================
// MODULE 16: TRANSPORTATION & LOGISTICS (إدارة النقل والمواصلات)
// ============================================================================
router.get("/travel/vehicles", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_vehicles ORDER BY id DESC").all();
  res.json(rows);
});

router.post("/travel/vehicles", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  const { name, vehicle_type, plate_number, model_year, capacity, company_id, company_name, status, notes } = req.body;
  const stmt = db.prepare(`
    INSERT INTO travel_vehicles (name, vehicle_type, plate_number, model_year, capacity, company_id, company_name, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, vehicle_type || 'سيارة', plate_number || null, model_year || null, Number(capacity || 4), company_id || null, company_name || null, status || 'available', notes || null);
  const newV = db.prepare("SELECT * FROM travel_vehicles WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newV);
});

router.get("/travel/drivers", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_drivers ORDER BY id DESC").all();
  res.json(rows);
});

router.post("/travel/drivers", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  const { name, phone, license_number, nationality, company_id, company_name, status, notes } = req.body;
  const stmt = db.prepare(`
    INSERT INTO travel_drivers (name, phone, license_number, nationality, company_id, company_name, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, phone || null, license_number || null, nationality || null, company_id || null, company_name || null, status || 'available', notes || null);
  const newD = db.prepare("SELECT * FROM travel_drivers WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newD);
});

router.get("/travel/transport-companies", (req, res) => {
  try {
    syncSupplierAccounts();
  } catch {}
  const { search } = req.query;
  let sql = "SELECT * FROM travel_transport_companies WHERE 1=1";
  const params: any[] = [];
  if (search) {
    sql += " AND (name LIKE ? OR phone LIKE ? OR contact_person LIKE ? OR address LIKE ?)";
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  sql += " ORDER BY id DESC";
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/transport-companies", (req, res) => {
  try { syncSupplierAccounts(); /* added sync */ } catch {}
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  const { name, phone, email, contact_person, address, balance, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: "اسم شركة النقل مطلوب" });
    return;
  }
  const stmt = db.prepare(`
    INSERT INTO travel_transport_companies (name, phone, email, contact_person, address, balance, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, phone || null, email || null, contact_person || null, address || null, Number(balance) || 0, notes || null);
  const newC = db.prepare("SELECT * FROM travel_transport_companies WHERE id = ?").get(info.lastInsertRowid);
  try {
    syncSupplierAccounts();
  } catch (syncErr) {
    console.error("Error running syncSupplierAccounts on transport company creation:", syncErr);
  }
  res.status(201).json(newC);
});

router.put("/travel/transport-companies/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  const { name, phone, email, contact_person, address, balance, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: "اسم شركة النقل مطلوب" });
    return;
  }
  db.prepare(`
    UPDATE travel_transport_companies
    SET name = ?, phone = ?, email = ?, contact_person = ?, address = ?, balance = ?, notes = ?
    WHERE id = ?
  `).run(name, phone || null, email || null, contact_person || null, address || null, Number(balance) || 0, notes || null, req.params.id);
  const updated = db.prepare("SELECT * FROM travel_transport_companies WHERE id = ?").get(req.params.id);
  try {
    syncSupplierAccounts();
  } catch (syncErr) {
    console.error("Error running syncSupplierAccounts on transport company update:", syncErr);
  }
  res.json(updated);
});

router.delete("/travel/transport-companies/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_transport_companies WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

router.get("/travel/transport-companies/:id/statement", (req, res) => {
  const compId = req.params.id;
  const company = db.prepare("SELECT * FROM travel_transport_companies WHERE id = ?").get(compId) as any;
  if (!company) { res.status(404).json({ error: "شركة النقل غير موجودة" }); return; }

  const transports = db.prepare("SELECT * FROM travel_transports WHERE company_id = ? ORDER BY id DESC").all(compId);
  const busBookings = db.prepare("SELECT * FROM travel_bus_bookings WHERE (company_id = ? OR company_name = ?) AND COALESCE(supplier_payment_method, '') NOT IN ('cash', 'bank', 'نقداً', 'تحويل بنكي') ORDER BY id DESC").all(compId, company.name);
  
  const totalCostTransports = ((transports as any[]) || []).reduce((sum, t) => sum + (Number(t.cost_price) || 0), 0);
  const totalCostBuses = ((busBookings as any[]) || []).reduce((sum, b) => sum + (Number(b.cost_price) || 0), 0);
  const totalCost = totalCostTransports + totalCostBuses;
  
  let journalEntries: any[] = [];
  if (company.account_code) {
    journalEntries = db.prepare(`
      SELECT jel.*, je.entry_date, je.description as je_desc, je.reference_number
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_code = ?
      ORDER BY je.entry_date DESC, je.id DESC
    `).all(company.account_code);
  }

  const totalDebits = journalEntries.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredits = journalEntries.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balance = totalCredits - totalDebits;

  res.json({
    company,
    summary: {
      totalCost,
      totalDebits,
      totalCredits,
      balance: journalEntries.length > 0 ? balance : (company.balance || totalCost)
    },
    transports,
    busBookings,
    journalEntries
  });
});

router.get("/travel/transports", (req, res) => {
  const { customer_id } = req.query;
  let sql = `
    SELECT t.*, c.name as customer_name, c.phone as customer_phone,
           p.name_ar as passenger_name_ar, p.passport_number,
           v.name as vehicle_name, v.plate_number,
           d.name as driver_name, d.phone as driver_phone
    FROM travel_transports t
    LEFT JOIN customers c ON c.id = t.customer_id
    LEFT JOIN travel_passengers p ON p.id = t.passenger_id
    LEFT JOIN travel_vehicles v ON v.id = t.vehicle_id
    LEFT JOIN travel_drivers d ON d.id = t.driver_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (customer_id) { sql += ` AND t.customer_id = ?`; params.push(customer_id); }
  sql += ` ORDER BY t.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/transports", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    service_type, customer_id, passenger_id, vehicle_id, driver_id, company_id,
    pickup_location, dropoff_location, pickup_datetime, flight_number,
    cost_price, selling_price, commission, status, notes
  } = req.body;

  const num = `TRN-${Date.now().toString().slice(-6)}`;
  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;

  const stmt = db.prepare(`
    INSERT INTO travel_transports (
      transport_number, service_type, customer_id, passenger_id, vehicle_id, driver_id, company_id,
      pickup_location, dropoff_location, pickup_datetime, flight_number,
      cost_price, selling_price, commission, profit, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    num, service_type || 'استقبال مطار', customer_id || null, passenger_id || null, vehicle_id || null, driver_id || null, company_id || null,
    pickup_location || null, dropoff_location || null, pickup_datetime || null, flight_number || null,
    cost, sell, comm, prof, status || 'scheduled', notes || null
  );

  const newTrn = db.prepare("SELECT * FROM travel_transports WHERE id = ?").get(info.lastInsertRowid);

  // Financial accounting double entry journal
  try {
    const entryDate = pickup_datetime ? pickup_datetime.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const desc = `خدمة نقل وسياحة (${service_type || 'استقبال مطار'}) رقم: ${num}`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(company_id);
    const lines: any[] = [
      { account_code: custAcc, debit: sell, credit: 0, description: `استحقاق خدمة النقل على العميل` },
      { account_code: "44001", debit: 0, credit: sell, description: `ايرادات عمولة مبيعات حجوزات النقل البري` }
    ];
    if (req.body.payment_method === 'cash') {
      lines.push(
        { account_code: "11100", debit: sell, credit: 0, description: `تحصيل نقدي بالصندوق لخدمة النقل` },
        { account_code: custAcc, debit: 0, credit: sell, description: `سداد نقدي من العميل لخدمة النقل` }
      );
    }
    if (cost > 0) {
      lines.push(
        { account_code: "54000", debit: cost, credit: 0, description: `تكلفة حجز خدمة النقل` },
        { account_code: suppAcc, debit: 0, credit: cost, description: `مستحقات شركة النقل / المورد` }
      );
      if (req.body.supplier_payment_method === 'cash') {
        lines.push(
          { account_code: suppAcc, debit: cost, credit: 0, description: `سداد نقدي لشركة النقل / المورد` },
          { account_code: "11100", debit: 0, credit: cost, description: `صرف نقدي من الصندوق لشركة النقل / المورد` }
        );
      }
    }
    syncJournalEntryForSource({
      sourceType: "transport",
      sourceId: Number(info.lastInsertRowid),
      entryDate,
      description: desc,
      lines,
      referenceNo: num
    });
  } catch (err) {
    console.error("Journal entry error on transport creation:", err);
  }

  res.status(201).json(newTrn);
});

router.put("/travel/transports/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    service_type, customer_id, passenger_id, vehicle_id, driver_id, company_id,
    pickup_location, dropoff_location, pickup_datetime, flight_number,
    cost_price, selling_price, commission, status, notes
  } = req.body;

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;

  db.prepare(`
    UPDATE travel_transports SET
      service_type=?, customer_id=?, passenger_id=?, vehicle_id=?, driver_id=?, company_id=?,
      pickup_location=?, dropoff_location=?, pickup_datetime=?, flight_number=?,
      cost_price=?, selling_price=?, commission=?, profit=?, status=?, notes=?
    WHERE id=?
  `).run(
    service_type, customer_id || null, passenger_id || null, vehicle_id || null, driver_id || null, company_id || null,
    pickup_location || null, dropoff_location || null, pickup_datetime || null, flight_number || null,
    cost, sell, comm, prof, status || 'scheduled', notes || null, req.params.id
  );

  const updated: any = db.prepare("SELECT * FROM travel_transports WHERE id = ?").get(req.params.id);

  // Sync double entry journal on update
  try {
    const entryDate = pickup_datetime ? pickup_datetime.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const desc = `تعديل خدمة نقل وسياحة رقم: ${updated.transport_number || req.params.id}`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(company_id);
    const lines: any[] = [
      { account_code: custAcc, debit: sell, credit: 0, description: `استحقاق خدمة النقل على العميل` },
      { account_code: "44001", debit: 0, credit: sell, description: `ايرادات عمولة مبيعات حجوزات النقل البري` }
    ];
    if (req.body.payment_method === 'cash') {
      lines.push(
        { account_code: "11100", debit: sell, credit: 0, description: `تحصيل نقدي بالصندوق لخدمة النقل` },
        { account_code: custAcc, debit: 0, credit: sell, description: `سداد نقدي من العميل لخدمة النقل` }
      );
    }
    if (cost > 0) {
      lines.push(
        { account_code: "54000", debit: cost, credit: 0, description: `تكلفة حجز خدمة النقل` },
        { account_code: suppAcc, debit: 0, credit: cost, description: `مستحقات شركة النقل / المورد` }
      );
      if (req.body.supplier_payment_method === 'cash') {
        lines.push(
          { account_code: suppAcc, debit: cost, credit: 0, description: `سداد نقدي لشركة النقل / المورد` },
          { account_code: "11100", debit: 0, credit: cost, description: `صرف نقدي من الصندوق لشركة النقل / المورد` }
        );
      }
    }
    syncJournalEntryForSource({
      sourceType: "transport",
      sourceId: Number(req.params.id),
      entryDate,
      description: desc,
      lines,
      referenceNo: updated.transport_number || `TRN-${req.params.id}`
    });
  } catch (err) {
    console.error("Journal entry error on transport update:", err);
  }
  res.json(updated);
});

router.delete("/travel/transports/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    deleteDoubleEntryJournal("transport", Number(req.params.id));
  } catch (err) {
    console.error("Error deleting transport journal entry:", err);
  }
  db.prepare("DELETE FROM travel_transports WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

// ============================================================================
// MODULE: LAND TRANSPORT & BUS TICKET BOOKINGS (حجوزات تذاكر النقل البري ونظام الطرفين)
// ============================================================================

router.get("/travel/bus-bookings/stats", (_req, res) => {
  try {
    const totalCount = (db.prepare("SELECT COUNT(*) as count FROM travel_bus_bookings").get() as any)?.count || 0;
    
    // Stats by currency
    const currencyStats = db.prepare(`
      SELECT 
        customer_currency as currency,
        COUNT(*) as total_bookings,
        SUM(selling_price) as total_sales,
        SUM(cost_price) as total_cost,
        SUM(agency_commission) as total_commission,
        SUM(paid_amount) as total_paid,
        SUM(remaining_balance) as total_remaining
      FROM travel_bus_bookings
      GROUP BY customer_currency
    `).all();

    // Status counts
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM travel_bus_bookings
      GROUP BY status
    `).all();

    res.json({
      total_count: totalCount,
      currency_stats: currencyStats,
      status_counts: statusCounts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/travel/bus-bookings", (req, res) => {
  try {
    const { search, status, customer_id, company_id, currency, trip_type, payment_method, date_from, date_to } = req.query;
    
    let sql = `
      SELECT b.*, 
             c.name as customer_name_joined, c.phone as customer_phone_joined,
             p.name_ar as passenger_name_joined, p.passport_number as passenger_passport_joined, p.phone as passenger_phone_joined,
             tc.name as company_name_joined, tc.phone as company_phone_joined
      FROM travel_bus_bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN travel_passengers p ON p.id = b.passenger_id
      LEFT JOIN travel_transport_companies tc ON tc.id = b.company_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      sql += ` AND (
        b.booking_number LIKE ? OR
        b.ticket_number LIKE ? OR
        b.pnr_number LIKE ? OR
        b.customer_name LIKE ? OR
        b.passenger_name LIKE ? OR
        b.company_name LIKE ? OR
        b.origin_city LIKE ? OR
        b.destination_city LIKE ? OR
        b.bus_number LIKE ? OR
        b.seat_number LIKE ? OR
        b.customer_statement LIKE ? OR
        b.supplier_statement LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s, s, s, s, s, s);
    }

    if (status && status !== "all") {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    if (customer_id) {
      sql += ` AND b.customer_id = ?`;
      params.push(customer_id);
    }

    if (company_id) {
      sql += ` AND b.company_id = ?`;
      params.push(company_id);
    }

    if (currency && currency !== "all") {
      sql += ` AND b.customer_currency = ?`;
      params.push(currency);
    }

    if (trip_type && trip_type !== "all") {
      sql += ` AND b.trip_type = ?`;
      params.push(trip_type);
    }

    if (payment_method && payment_method !== "all") {
      sql += ` AND b.payment_method = ?`;
      params.push(payment_method);
    }

    if (date_from) {
      sql += ` AND b.departure_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      sql += ` AND b.departure_date <= ?`;
      params.push(date_to);
    }

    sql += ` ORDER BY b.id DESC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/travel/bus-bookings/:id", (req, res) => {
  try {
    const row = db.prepare(`
      SELECT b.*, 
             c.name as customer_name_joined, c.phone as customer_phone_joined,
             p.name_ar as passenger_name_joined, p.passport_number as passenger_passport_joined, p.phone as passenger_phone_joined,
             tc.name as company_name_joined, tc.phone as company_phone_joined, tc.address as company_address
      FROM travel_bus_bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN travel_passengers p ON p.id = b.passenger_id
      LEFT JOIN travel_transport_companies tc ON tc.id = b.company_id
      WHERE b.id = ?
    `).get(req.params.id);

    if (!row) {
      res.status(404).json({ error: "حجز التذكرة غير موجود" });
      return;
    }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/travel/bus-bookings", (req, res) => {
  ensureTravelBusBookingsColumns();
  try {
    const user = getAuthUser(req);
    if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

    const {
      booking_number, ticket_number, pnr_number, trip_type, bus_type, bus_number, seat_number,
      customer_id, customer_name, passenger_id, passenger_name, passenger_phone, passenger_national_id,
      selling_price, customer_currency, customer_statement,
      company_id, company_name, cost_price, supplier_currency, supplier_statement,
      agency_commission, commission_currency, commission_statement, exchange_rate,
      origin_city, origin_station, destination_city, destination_station,
      departure_date, departure_time, boarding_time, arrival_date, arrival_time, return_departure_date,
      luggage_weight, luggage_pieces,
      payment_method, payment_status, paid_amount, remaining_balance,
      supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
      status, issue_date, notes
    } = req.body;

    const genBookingNumber = booking_number?.trim() || `BUS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const genTicketNumber = ticket_number?.trim() || `TKT-BUS-${Math.floor(100000 + Math.random() * 900000)}`;

    const sell = Number(selling_price) || 0;
    const cost = Number(cost_price) || 0;
    const comm = agency_commission !== undefined && agency_commission !== "" ? Number(agency_commission) : (sell - cost);
    const paid = Number(paid_amount) || (payment_status === 'paid' ? sell : 0);
    const rem = Number(remaining_balance) !== undefined ? Number(remaining_balance) : Math.max(0, sell - paid);
    const sPaid = Number(supplier_paid_amount) || (supplier_payment_status === 'paid' ? cost : 0);
    const sRem = Number(supplier_remaining_balance) !== undefined ? Number(supplier_remaining_balance) : Math.max(0, cost - sPaid);

    // Resolve customer name if customer_id is provided
    let custName = customer_name;
    if (customer_id && !custName) {
      const c = db.prepare("SELECT name FROM customers WHERE id = ?").get(customer_id) as any;
      if (c) custName = c.name;
    }

    // Resolve company name and id if company_id or company_name is provided
    let finalCompanyId = company_id ? Number(company_id) : null;
    let compName = company_name;
    if (finalCompanyId && !compName) {
      const comp = db.prepare("SELECT name FROM travel_transport_companies WHERE id = ?").get(finalCompanyId) as any;
      if (comp) compName = comp.name;
    } else if (!finalCompanyId && compName) {
      let comp = db.prepare("SELECT id, name FROM travel_transport_companies WHERE name = ?").get(compName) as any;
      if (!comp) {
        const info = db.prepare("INSERT INTO travel_transport_companies (name, balance) VALUES (?, 0)").run(compName);
        comp = db.prepare("SELECT id, name FROM travel_transport_companies WHERE id = ?").get(info.lastInsertRowid);
        try { syncSupplierAccounts(); } catch {}
      }
      if (comp) {
        finalCompanyId = comp.id;
        compName = comp.name;
      }
    }

    // Resolve passenger name
    let passName = passenger_name || custName;
    if (passenger_id && !passenger_name) {
      const p = db.prepare("SELECT name_ar, phone, passport_number, national_id FROM travel_passengers WHERE id = ?").get(passenger_id) as any;
      if (p) {
        passName = p.name_ar;
      }
    }

    const stmt = db.prepare(`
      INSERT INTO travel_bus_bookings (
        booking_number, ticket_number, pnr_number, trip_type, bus_type, bus_number, seat_number,
        customer_id, customer_name, passenger_id, passenger_name, passenger_phone, passenger_national_id,
        selling_price, customer_currency, customer_statement,
        company_id, company_name, cost_price, supplier_currency, supplier_statement,
        agency_commission, commission_currency, commission_statement, exchange_rate,
        origin_city, origin_station, destination_city, destination_station,
        departure_date, departure_time, boarding_time, arrival_date, arrival_time, return_departure_date,
        luggage_weight, luggage_pieces,
        payment_method, payment_status, paid_amount, remaining_balance,
        supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
        status, issue_date, issued_by, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const info = stmt.run(
      genBookingNumber, genTicketNumber, pnr_number || null, trip_type || 'one_way', bus_type || 'حافلة VIP فاخرة', bus_number || null, seat_number || null,
      customer_id || null, custName || 'عميل نقدي', passenger_id || null, passName || 'المسافر', passenger_phone || null, passenger_national_id || null,
      sell, customer_currency || 'SAR', customer_statement || `قيمة تذكرة نقل بري (${origin_city || ''} -> ${destination_city || ''})`,
      finalCompanyId, compName || 'شركة النقل البري', cost, supplier_currency || customer_currency || 'SAR', supplier_statement || `تكلفة حجز مقعد حافلة نقل بري`,
      comm, commission_currency || customer_currency || 'SAR', commission_statement || `عمولة وربح حجز تذكرة نقل بري`, Number(exchange_rate) || 1,
      origin_city || 'الرياض', origin_station || null, destination_city || 'جدة', destination_station || null,
      departure_date || new Date().toISOString().slice(0, 10), departure_time || '08:00', boarding_time || '07:30', arrival_date || null, arrival_time || null, return_departure_date || null,
      Number(luggage_weight) || 30, Number(luggage_pieces) || 2,
      payment_method || 'cash', payment_status || 'paid', paid, rem,
      supplier_payment_method || 'credit', supplier_payment_status || 'unpaid', sPaid, sRem,
      status || 'confirmed', issue_date || getBusinessDate("travel"), user.name || 'مدير النظام', notes || null
    );

    const created = db.prepare("SELECT * FROM travel_bus_bookings WHERE id = ?").get(info.lastInsertRowid);

    // Financial accounting double entry journal for bus booking
    try {
      const entryDate = issue_date || getBusinessDate("travel");
      const desc = customer_statement || `حجز تذكرة نقل بري وباصات رقم: ${genTicketNumber || genBookingNumber} - رحلة ${origin_city || ''} إلى ${destination_city || ''}`;
      const custAcc = getCustomerAccountCode(customer_id);
      const suppAcc = getSupplierAccountCode(finalCompanyId);
      const busCur = customer_currency || supplier_currency || 'SAR';
      const lines = buildTravelJournalLines({
        sell, cost, custPayMethod: payment_method || 'cash', paid,
        suppPayMethod: supplier_payment_method || 'credit', sPaid,
        custAcc, suppAcc, revenueAcc: "44001", expenseAcc: "54000",
        custCur: customer_currency || busCur, suppCur: supplier_currency || busCur,
        custStmt: customer_statement || `حجز تذكرة نقل بري - ${genTicketNumber || genBookingNumber}`,
        suppStmt: supplier_statement || `تكلفة حجز تذكرة نقل بري - ${genTicketNumber || genBookingNumber}`
      });

      syncJournalEntryForSource({
        sourceType: "bus_booking",
        sourceId: Number(info.lastInsertRowid),
        entryDate,
        description: desc,
        lines,
        referenceNo: genTicketNumber || genBookingNumber,
        currency: busCur
      });
    } catch (journalErr) {
      console.error("Journal entry error on bus booking creation:", journalErr);
    }

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/travel/bus-bookings/:id", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

    const {
      booking_number, ticket_number, pnr_number, trip_type, bus_type, bus_number, seat_number,
      customer_id, customer_name, passenger_id, passenger_name, passenger_phone, passenger_national_id,
      selling_price, customer_currency, customer_statement,
      company_id, company_name, cost_price, supplier_currency, supplier_statement,
      agency_commission, commission_currency, commission_statement, exchange_rate,
      origin_city, origin_station, destination_city, destination_station,
      departure_date, departure_time, boarding_time, arrival_date, arrival_time, return_departure_date,
      luggage_weight, luggage_pieces,
      payment_method, payment_status, paid_amount, remaining_balance,
      supplier_payment_method, supplier_payment_status, supplier_paid_amount, supplier_remaining_balance,
      status, issue_date, notes
    } = req.body;

    const sell = Number(selling_price) || 0;
    const cost = Number(cost_price) || 0;
    const comm = agency_commission !== undefined && agency_commission !== "" ? Number(agency_commission) : (sell - cost);
    const paid = Number(paid_amount) || 0;
    const rem = Number(remaining_balance) !== undefined ? Number(remaining_balance) : Math.max(0, sell - paid);
    const sPaid = Number(supplier_paid_amount) || 0;
    const sRem = Number(supplier_remaining_balance) !== undefined ? Number(supplier_remaining_balance) : Math.max(0, cost - sPaid);

    let finalCompanyId = company_id ? Number(company_id) : null;
    let compName = company_name;
    if (finalCompanyId && !compName) {
      const comp = db.prepare("SELECT name FROM travel_transport_companies WHERE id = ?").get(finalCompanyId) as any;
      if (comp) compName = comp.name;
    } else if (!finalCompanyId && compName) {
      let comp = db.prepare("SELECT id, name FROM travel_transport_companies WHERE name = ?").get(compName) as any;
      if (!comp) {
        const info = db.prepare("INSERT INTO travel_transport_companies (name, balance) VALUES (?, 0)").run(compName);
        comp = db.prepare("SELECT id, name FROM travel_transport_companies WHERE id = ?").get(info.lastInsertRowid);
        try { syncSupplierAccounts(); } catch {}
      }
      if (comp) {
        finalCompanyId = comp.id;
        compName = comp.name;
      }
    }

    db.prepare(`
      UPDATE travel_bus_bookings SET
        booking_number=?, ticket_number=?, pnr_number=?, trip_type=?, bus_type=?, bus_number=?, seat_number=?,
        customer_id=?, customer_name=?, passenger_id=?, passenger_name=?, passenger_phone=?, passenger_national_id=?,
        selling_price=?, customer_currency=?, customer_statement=?,
        company_id=?, company_name=?, cost_price=?, supplier_currency=?, supplier_statement=?,
        agency_commission=?, commission_currency=?, commission_statement=?, exchange_rate=?,
        origin_city=?, origin_station=?, destination_city=?, destination_station=?,
        departure_date=?, departure_time=?, boarding_time=?, arrival_date=?, arrival_time=?, return_departure_date=?,
        luggage_weight=?, luggage_pieces=?,
        payment_method=?, payment_status=?, paid_amount=?, remaining_balance=?,
        supplier_payment_method=?, supplier_payment_status=?, supplier_paid_amount=?, supplier_remaining_balance=?,
        status=?, issue_date=?, notes=?
      WHERE id=?
    `).run(
      booking_number, ticket_number || null, pnr_number || null, trip_type || 'one_way', bus_type || 'حافلة VIP فاخرة', bus_number || null, seat_number || null,
      customer_id || null, customer_name || null, passenger_id || null, passenger_name || null, passenger_phone || null, passenger_national_id || null,
      sell, customer_currency || 'SAR', customer_statement || null,
      finalCompanyId, compName || null, cost, supplier_currency || 'SAR', supplier_statement || null,
      comm, commission_currency || 'SAR', commission_statement || null, Number(exchange_rate) || 1,
      origin_city || null, origin_station || null, destination_city || null, destination_station || null,
      departure_date || null, departure_time || null, boarding_time || null, arrival_date || null, arrival_time || null, return_departure_date || null,
      Number(luggage_weight) || 30, Number(luggage_pieces) || 2,
      payment_method || 'cash', payment_status || 'paid', paid, rem,
      supplier_payment_method || 'credit', supplier_payment_status || 'unpaid', sPaid, sRem,
      status || 'confirmed', issue_date || null, notes || null,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM travel_bus_bookings WHERE id = ?").get(req.params.id);

    // Sync double entry journal on bus booking update
    try {
      const entryDate = issue_date || new Date().toISOString().slice(0, 10);
      const desc = customer_statement || `تعديل حجز تذكرة نقل بري وباصات رقم: ${ticket_number || booking_number} - رحلة ${origin_city || ''} إلى ${destination_city || ''}`;
      const custAcc = getCustomerAccountCode(customer_id);
      const suppAcc = getSupplierAccountCode(finalCompanyId);
      const busCur = customer_currency || supplier_currency || 'SAR';
      const lines = buildTravelJournalLines({
        sell, cost, custPayMethod: payment_method || 'cash', paid,
        suppPayMethod: supplier_payment_method || 'credit', sPaid,
        custAcc, suppAcc, revenueAcc: "44001", expenseAcc: "54000",
        custCur: customer_currency || busCur, suppCur: supplier_currency || busCur,
        custStmt: customer_statement || `تعديل حجز تذكرة نقل بري - ${ticket_number || booking_number}`,
        suppStmt: supplier_statement || `تكلفة حجز تذكرة نقل بري - ${ticket_number || booking_number}`
      });

      syncJournalEntryForSource({
        sourceType: "bus_booking",
        sourceId: Number(req.params.id),
        entryDate,
        description: desc,
        lines,
        referenceNo: ticket_number || booking_number,
        currency: busCur
      });
    } catch (journalErr) {
      console.error("Journal entry error on bus booking update:", journalErr);
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/travel/bus-bookings/:id", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
    try {
      deleteDoubleEntryJournal("bus_booking", Number(req.params.id));
    } catch (err) {
      console.error("Error deleting bus booking journal entry:", err);
    }
    db.prepare("DELETE FROM travel_bus_bookings WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/travel/bus-bookings/:id/confirm", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    const current = db.prepare("SELECT * FROM travel_bus_bookings WHERE id = ?").get(req.params.id) as any;
    if (!current) { res.status(404).json({ error: "الحجز غير موجود" }); return; }
    
    const tkt = current.ticket_number || `TKT-BUS-${Math.floor(100000 + Math.random() * 900000)}`;
    db.prepare("UPDATE travel_bus_bookings SET status = 'confirmed', ticket_number = ? WHERE id = ?").run(tkt, req.params.id);
    const updated = db.prepare("SELECT * FROM travel_bus_bookings WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/travel/bus-bookings/:id/issue", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    const current = db.prepare("SELECT * FROM travel_bus_bookings WHERE id = ?").get(req.params.id) as any;
    if (!current) { res.status(404).json({ error: "الحجز غير موجود" }); return; }
    
    const tkt = current.ticket_number || `TKT-BUS-${Math.floor(100000 + Math.random() * 900000)}`;
    const issueDate = current.issue_date || new Date().toISOString().slice(0, 10);
    db.prepare("UPDATE travel_bus_bookings SET status = 'confirmed', ticket_number = ?, issue_date = ? WHERE id = ?")
      .run(tkt, issueDate, req.params.id);
    const updated = db.prepare("SELECT * FROM travel_bus_bookings WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// MODULE 17: TRAVEL INSURANCE MANAGEMENT (إدارة التأمين الصحي والسياحي)
// ============================================================================
router.get("/travel/insurances", (req, res) => {
  const { customer_id } = req.query;
  let sql = `
    SELECT i.*, c.name as customer_name, c.phone as customer_phone,
           p.name_ar as passenger_name_ar, p.passport_number as passenger_passport
    FROM travel_insurances i
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN travel_passengers p ON p.id = i.passenger_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (customer_id) { sql += ` AND i.customer_id = ?`; params.push(customer_id); }
  sql += ` ORDER BY i.id DESC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.post("/travel/insurances", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    policy_number, insurance_company, customer_id, passenger_id, passenger_name, passport_number,
    start_date, end_date, duration_days, coverage_type, destination_country,
    cost_price, selling_price, commission, status, notes
  } = req.body;

  if (!insurance_company) {
    res.status(400).json({ error: "اسم شركة التأمين مطلوب" });
    return;
  }

  const polNum = policy_number || `POL-${Date.now().toString().slice(-6)}`;
  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;

  const stmt = db.prepare(`
    INSERT INTO travel_insurances (
      policy_number, insurance_company, customer_id, passenger_id, passenger_name, passport_number,
      start_date, end_date, duration_days, coverage_type, destination_country,
      cost_price, selling_price, commission, profit, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    polNum, insurance_company, customer_id || null, passenger_id || null, passenger_name || null, passport_number || null,
    start_date || new Date().toISOString().slice(0, 10), end_date || null, Number(duration_days || 30),
    coverage_type || 'تأمين طبي وسياحي شامل', destination_country || null,
    cost, sell, comm, prof, status || 'active', notes || null
  );

  const insId = Number(info.lastInsertRowid);

  // Accounting double entry journal for insurance policy
  try {
    const entryDate = start_date || new Date().toISOString().slice(0, 10);
    const desc = `إصدار وثيقة تأمين طبي وسياحي رقم: ${polNum} (${coverage_type || 'شامل'})`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(insurance_company);
    const insCur = req.body.currency || 'SAR';
    const lines: any[] = [
      { account_code: custAcc, debit: sell, credit: 0, description: `استحقاق قيمة وثيقة التأمين على العميل`, currency: insCur },
      { account_code: "45000", debit: 0, credit: sell, description: `ايرادات وعمولات مبيعات وثائق التأمين`, currency: insCur }
    ];
    if (cost > 0) {
      lines.push(
        { account_code: "55000", debit: cost, credit: 0, description: `تكلفة وثيقة التأمين الطبي والسياحي`, currency: insCur },
        { account_code: suppAcc, debit: 0, credit: cost, description: `مستحقات شركة التأمين / المورد`, currency: insCur }
      );
      if (req.body.supplier_payment_method === 'cash') {
        lines.push(
          { account_code: suppAcc, debit: cost, credit: 0, description: `سداد نقدي لشركة التأمين`, currency: insCur },
          { account_code: "11100", debit: 0, credit: cost, description: `صرف نقدي من الصندوق لشركة التأمين`, currency: insCur }
        );
      }
    }
    if (req.body.payment_method === 'cash' || Number(req.body.paid_amount || 0) > 0) {
      const paidAmt = Number(req.body.paid_amount || sell);
      lines.push(
        { account_code: "11100", debit: paidAmt, credit: 0, description: `تحصيل نقدي لوثيقة التأمين`, currency: insCur },
        { account_code: custAcc, debit: 0, credit: paidAmt, description: `سداد من العميل لوثيقة التأمين`, currency: insCur }
      );
    }
    syncJournalEntryForSource({
      sourceType: "insurance",
      sourceId: insId,
      entryDate,
      description: desc,
      lines,
      referenceNo: polNum,
      currency: insCur
    });
  } catch (insJournalErr) {
    console.error("Journal entry error on insurance creation:", insJournalErr);
  }

  const newIns = db.prepare("SELECT * FROM travel_insurances WHERE id = ?").get(insId);
  res.status(201).json(newIns);
});

router.put("/travel/insurances/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    policy_number, insurance_company, customer_id, passenger_id, passenger_name, passport_number,
    start_date, end_date, duration_days, coverage_type, destination_country,
    cost_price, selling_price, commission, status, notes
  } = req.body;

  const cost = Number(cost_price || 0);
  const sell = Number(selling_price || 0);
  const comm = Number(commission || (sell - cost));
  const prof = sell - cost;

  db.prepare(`
    UPDATE travel_insurances SET
      policy_number=?, insurance_company=?, customer_id=?, passenger_id=?, passenger_name=?, passport_number=?,
      start_date=?, end_date=?, duration_days=?, coverage_type=?, destination_country=?,
      cost_price=?, selling_price=?, commission=?, profit=?, status=?, notes=?
    WHERE id=?
  `).run(
    policy_number, insurance_company, customer_id || null, passenger_id || null, passenger_name || null, passport_number || null,
    start_date, end_date || null, Number(duration_days || 30),
    coverage_type, destination_country || null,
    cost, sell, comm, prof, status || 'active', notes || null, req.params.id
  );

  const updated: any = db.prepare("SELECT * FROM travel_insurances WHERE id = ?").get(req.params.id);

  // Sync double entry journal on insurance update
  try {
    const entryDate = start_date || new Date().toISOString().slice(0, 10);
    const desc = `تعديل وثيقة تأمين طبي وسياحي رقم: ${policy_number || req.params.id}`;
    const custAcc = getCustomerAccountCode(customer_id);
    const suppAcc = getSupplierAccountCode(insurance_company);
    const insCur = req.body.currency || 'SAR';
    const lines: any[] = [
      { account_code: custAcc, debit: sell, credit: 0, description: `استحقاق قيمة وثيقة التأمين على العميل`, currency: insCur },
      { account_code: "45000", debit: 0, credit: sell, description: `ايرادات وعمولات مبيعات وثائق التأمين`, currency: insCur }
    ];
    if (cost > 0) {
      lines.push(
        { account_code: "55000", debit: cost, credit: 0, description: `تكلفة وثيقة التأمين الطبي والسياحي`, currency: insCur },
        { account_code: suppAcc, debit: 0, credit: cost, description: `مستحقات شركة التأمين / المورد`, currency: insCur }
      );
      if (req.body.supplier_payment_method === 'cash') {
        lines.push(
          { account_code: suppAcc, debit: cost, credit: 0, description: `سداد نقدي لشركة التأمين`, currency: insCur },
          { account_code: "11100", debit: 0, credit: cost, description: `صرف نقدي من الصندوق لشركة التأمين`, currency: insCur }
        );
      }
    }
    if (req.body.payment_method === 'cash' || Number(req.body.paid_amount || 0) > 0) {
      const paidAmt = Number(req.body.paid_amount || sell);
      lines.push(
        { account_code: "11100", debit: paidAmt, credit: 0, description: `تحصيل نقدي لوثيقة التأمين`, currency: insCur },
        { account_code: custAcc, debit: 0, credit: paidAmt, description: `سداد من العميل لوثيقة التأمين`, currency: insCur }
      );
    }
    syncJournalEntryForSource({
      sourceType: "insurance",
      sourceId: Number(req.params.id),
      entryDate,
      description: desc,
      lines,
      referenceNo: policy_number || `POL-${req.params.id}`,
      currency: insCur
    });
  } catch (insJournalErr) {
    console.error("Journal entry error on insurance update:", insJournalErr);
  }

  res.json(updated);
});

router.delete("/travel/insurances/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    deleteDoubleEntryJournal("insurance", Number(req.params.id));
  } catch (err) {
    console.error("Error deleting insurance journal entry:", err);
  }
  db.prepare("DELETE FROM travel_insurances WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ============================================================================
// MODULE 18: SUPPLIERS & AGENTS MANAGEMENT (إدارة الموردين والوكلاء)
// ============================================================================
router.get("/travel/suppliers", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_suppliers ORDER BY id DESC").all();
  res.json(rows);
});

router.post("/travel/suppliers", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name, supplier_type, contact_person, phone, email, address, country, currency, bank_details, notes } = req.body;
  if (!name) {
    res.status(400).json({ error: "اسم المورد/الوكيل مطلوب" });
    return;
  }

  const code = `SUP-${Date.now().toString().slice(-6)}`;
  const stmt = db.prepare(`
    INSERT INTO travel_suppliers (supplier_code, name, supplier_type, contact_person, phone, email, address, country, currency, bank_details, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(code, name, supplier_type || 'شركة طيران', contact_person || null, phone || null, email || null, address || null, country || 'السعودية', currency || 'ريال', bank_details || null, notes || null);
  syncSupplierAccounts();
  const newSupp = db.prepare("SELECT * FROM travel_suppliers WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newSupp);
});

router.put("/travel/suppliers/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { name, supplier_type, contact_person, phone, email, address, country, currency, bank_details, notes, active } = req.body;
  db.prepare(`
    UPDATE travel_suppliers SET
      name=?, supplier_type=?, contact_person=?, phone=?, email=?, address=?, country=?, currency=?, bank_details=?, notes=?, active=?
    WHERE id=?
  `).run(name, supplier_type, contact_person || null, phone || null, email || null, address || null, country || 'السعودية', currency || 'ريال', bank_details || null, notes || null, active !== undefined ? active : 1, req.params.id);

  syncSupplierAccounts();
  const updated = db.prepare("SELECT * FROM travel_suppliers WHERE id = ?").get(req.params.id);
  res.json(updated);
});

router.get("/travel/suppliers/:id/statement", (req, res) => {
  const suppId = req.params.id;
  const supp = db.prepare("SELECT * FROM travel_suppliers WHERE id = ?").get(suppId);
  if (!supp) { res.status(404).json({ error: "المورد غير موجود" }); return; }

  // Get all associated bookings, hotel bookings, procurement invoices, payments
  const bookings = db.prepare("SELECT * FROM travel_bookings WHERE supplier_id = ? ORDER BY id DESC").all(suppId);
  const procurementInvoices = db.prepare("SELECT * FROM travel_procurement_invoices WHERE supplier_id = ? ORDER BY id DESC").all(suppId);
  const payments = db.prepare("SELECT * FROM travel_supplier_payments WHERE supplier_id = ? ORDER BY id DESC").all(suppId);

  // Calculate totals
  const totalCostFromBookings = ((bookings as any[]) || []).reduce((sum, b) => sum + (b.cost_price || 0), 0);
  const totalCostFromProcurement = ((procurementInvoices as any[]) || []).reduce((sum, p) => sum + (p.cost_subtotal || 0), 0);
  const totalPurchases = totalCostFromBookings + totalCostFromProcurement;
  const totalPayments = ((payments as any[]) || []).reduce((sum, pay) => sum + (pay.amount || 0), 0);
  const balance = totalPurchases - totalPayments;

  res.json({
    supplier: supp,
    summary: {
      totalPurchases,
      totalPayments,
      balance
    },
    bookings,
    procurementInvoices,
    payments
  });
});

router.post("/travel/suppliers/:id/payments", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const suppId = req.params.id;
  const supp = db.prepare("SELECT * FROM travel_suppliers WHERE id = ?").get(suppId) as any;
  if (!supp) { res.status(404).json({ error: "المورد غير موجود" }); return; }

  const { amount, voucher_date, payment_method, safe_id, bank_account_id, notes } = req.body;
  const amt = Number(amount || 0);
  if (amt <= 0) { res.status(400).json({ error: "مبلغ السداد يجب أن يكون أكبر من الصفر" }); return; }

  const vNum = `PAY-SUP-${Date.now().toString().slice(-6)}`;
  const dateStr = voucher_date || getBusinessDate("travel");

  let journalEntryId: number | null = null;
  try {
    const suppAcc = getSupplierAccountCode(supp.account_code || supp.id || supp.name);
    const creditAcc = (payment_method === 'bank' || bank_account_id) ? '11120' : '11100';
    const creditDesc = creditAcc === '11120' ? 'دائن: صرف من الحساب البنكي' : 'دائن: صرف من الصندوق الرئيسي';
    journalEntryId = createDoubleEntryJournal(
      dateStr,
      `سداد دفعة للمورد/الوكيل ${supp.name} - سند رقم ${vNum}`,
      "supplier_payment",
      Number(suppId),
      [
        { account_code: suppAcc, debit: amt, credit: 0, description: `مدين: سداد وتخفيض مستحقات المورد ${supp.name}` },
        { account_code: creditAcc, debit: 0, credit: amt, description: creditDesc }
      ]
    );
  } catch (err) {
    console.error("Journal entry error on supplier payment:", err);
  }

  const stmt = db.prepare(`
    INSERT INTO travel_supplier_payments (
      voucher_number, supplier_id, voucher_date, amount, payment_method, safe_id, bank_account_id, journal_entry_id, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(vNum, suppId, dateStr, amt, payment_method || 'cash', safe_id || 1, bank_account_id || null, journalEntryId, notes || null, user.name);

  // Update supplier balance
  db.prepare("UPDATE travel_suppliers SET current_balance = current_balance - ? WHERE id = ?").run(amt, suppId);

  const newPay = db.prepare("SELECT * FROM travel_supplier_payments WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newPay);
});


// ============================================================================
// MODULE 19: CENTRALIZED SALES & INVOICING SYSTEM (الفواتير المركزية والمبيعات)
// ============================================================================
router.get("/travel/invoices", (req, res) => {
  try {
    const { search, currency, payment_method } = req.query;
    let sql = `
      SELECT i.*,
             (SELECT COUNT(*) FROM travel_invoice_items WHERE invoice_id = i.id) as items_count
      FROM travel_invoices i
      WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      sql += ` AND (i.invoice_number LIKE ? OR i.customer_name LIKE ? OR i.customer_statement LIKE ? OR i.notes LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (currency && currency !== "all") {
      sql += ` AND i.currency = ?`;
      params.push(currency);
    }
    if (payment_method && payment_method !== "all") {
      sql += ` AND i.payment_method = ?`;
      params.push(payment_method);
    }
    sql += ` ORDER BY i.id DESC`;
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (err: any) {
    console.error("Error fetching travel invoices:", err);
    res.status(500).json({ error: "فشل في جلب قائمة الفواتير: " + err.message });
  }
});

router.get("/travel/invoices/:id", (req, res) => {
  try {
    const inv = db.prepare("SELECT * FROM travel_invoices WHERE id = ?").get(req.params.id);
    if (!inv) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }
    const items = db.prepare("SELECT * FROM travel_invoice_items WHERE invoice_id = ?").all(req.params.id);
    res.json({ ...inv, items });
  } catch (err: any) {
    console.error("Error fetching invoice details:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/travel/invoices", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

    const {
      customer_id, customer_name, customer_statement, currency, exchange_rate,
      invoice_date, payment_method, payment_status,
      discount, paid_amount, notes, items,
      debit_account_code, credit_account_code, commission_account_code, supplier_account_code
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      res.status(400).json({ error: "اسم العميل مطلوب لإصدار الفاتورة" });
      return;
    }

    const itemsList = Array.isArray(items) && items.length > 0 ? items : [
      {
        service_type: "flight",
        description: "خدمة سياحية",
        statement: "بيان الفاتورة",
        cost_price: 0,
        service_fees: 0,
        agency_commission: 0,
        selling_price: 0
      }
    ];

    // Calculate totals: Cost + Fees + Selling = Profit formula
    let costSub = 0;
    let feesSub = 0;
    let sellingSub = 0;
    let totalComm = 0;

    const processedItems = itemsList.map((item: any) => {
      const cost = Math.max(0, Number(item.cost_price || 0));
      const fees = Math.max(0, Number(item.service_fees || 0));
      const sell = Math.max(0, Number(item.selling_price || 0));
      const comm = Number(item.agency_commission !== undefined ? item.agency_commission : Math.max(0, sell - (cost + fees)));
      const profit = sell - (cost + fees);

      costSub += cost;
      feesSub += fees;
      sellingSub += sell;
      totalComm += comm;

      return {
        service_type: item.service_type || 'flight',
        service_ref_id: item.service_ref_id ? Number(item.service_ref_id) : null,
        supplier_type: item.supplier_type || null,
        supplier_id: item.supplier_id ? Number(item.supplier_id) : null,
        supplier_name: item.supplier_name || null,
        description: item.description || 'خدمة سياحية',
        statement: item.statement || item.description || customer_statement || 'بيان الخدمة',
        passenger_name: item.passenger_name || customer_name || null,
        cost_price: cost,
        service_fees: fees,
        agency_commission: comm,
        selling_price: sell,
        profit,
        accounting_impact_account: item.accounting_impact_account || (
          item.service_type === 'flight' ? '41001' :
          item.service_type === 'hotel' ? '42001' :
          item.service_type === 'visa' ? '43001' :
          item.service_type === 'transport' ? '44001' : '40000'
        )
      };
    });

    const disc = Math.max(0, Number(discount || 0));
    const netSell = Math.max(0, sellingSub - disc);
    const netProf = netSell - (costSub + feesSub);
    const paid = Number(paid_amount !== undefined ? paid_amount : (payment_method === 'credit' ? 0 : netSell));
    const rem = Math.max(0, netSell - paid);
    const invNum = `INV-TRV-${Date.now().toString().slice(-6)}`;
    const dateStr = invoice_date || getBusinessDate("travel");
    const curr = currency || 'SAR';
    const exRate = Number(exchange_rate || 1.0);

    const custAcc = getCustomerAccountCode(customer_id);
    let debitAcc = debit_account_code || (payment_method === 'cash' ? '11100' : payment_method === 'bank' ? '11102' : custAcc);
    let creditAcc = credit_account_code || '40000';
    let commAcc = commission_account_code || '45000';
    let suppAcc = supplier_account_code || '21100';

    // Verify accounts exist in DB
    const checkAcc = (code: string, fallback: string) => {
      try {
        const acc = db.prepare("SELECT code FROM accounts WHERE code = ?").get(code);
        return acc ? code : fallback;
      } catch {
        return fallback;
      }
    };
    debitAcc = checkAcc(debitAcc, '11100');
    creditAcc = checkAcc(creditAcc, '40000');
    commAcc = checkAcc(commAcc, '45000');
    suppAcc = checkAcc(suppAcc, '21100');

    // Accounting Double Entry Journal Entry Creation
    let journalEntryId: number | null = null;
    try {
      const journalLines: any[] = [];

      if (paid > 0) {
        journalLines.push({
          account_code: debitAcc,
          debit: paid,
          credit: 0,
          description: `استلام دفعة من العميل ${customer_name} - فاتورة ${invNum} (${curr})`
        });
      }

      if (rem > 0) {
        journalLines.push({
          account_code: custAcc, // ذمم مدينة
          debit: rem,
          credit: 0,
          description: `ذمم مدينة متبقية على العميل ${customer_name} - فاتورة ${invNum}`
        });
      }

      // Revenue credit
      if (netSell > 0) {
        journalLines.push({
          account_code: creditAcc,
          debit: 0,
          credit: netSell,
          description: `إيرادات مبيعات خدمات السفر والرحلات (${customer_statement || 'فاتورة مبيعات مركزية'})`
        });
      }

      // Cost & Supplier entries if cost > 0
      if (costSub + feesSub > 0) {
        const cogsAcc = checkAcc("50000", "50000");
        journalLines.push({
          account_code: cogsAcc,
          debit: costSub + feesSub,
          credit: 0,
          description: `تكلفة التذاكر والخدمات المباعة - فاتورة ${invNum}`
        });
        journalLines.push({
          account_code: suppAcc,
          debit: 0,
          credit: costSub + feesSub,
          description: `مستحقات الموردين وشركات الطيران والخدمات - فاتورة ${invNum}`
        });
      }

      if (journalLines.length >= 2) {
        journalEntryId = createDoubleEntryJournal(
          dateStr,
          `فاتورة مبيعات خدمات سفر وسياحة رقم ${invNum} للعميل ${customer_name} [${customer_statement || 'معاملة شاملة'}]`,
          "travel_sales_invoice",
          0,
          journalLines,
          { currency: curr, currency_rate: exRate, reference_no: invNum, doc_type: "فاتورة مبيعات" }
        );
      }
    } catch (err) {
      console.error("Journal entry warning on travel invoice:", err);
    }

    const stmt = db.prepare(`
      INSERT INTO travel_invoices (
        invoice_number, invoice_date, customer_id, customer_name, customer_statement, currency, exchange_rate,
        payment_method, payment_status,
        cost_subtotal, fees_subtotal, selling_subtotal, discount, net_selling, net_profit,
        total_commission, paid_amount, remaining_amount,
        debit_account_code, credit_account_code, commission_account_code, supplier_account_code,
        journal_entry_id, user_id, user_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      invNum, dateStr, customer_id || null, customer_name, customer_statement || `معاملة سفر للعميل ${customer_name}`, curr, exRate,
      payment_method || 'cash', payment_status || (rem <= 0 ? 'paid' : 'partial'),
      costSub, feesSub, sellingSub, disc, netSell, netProf,
      totalComm, paid, rem,
      debitAcc, creditAcc, commAcc, suppAcc,
      journalEntryId, user.id, user.name, notes || null
    );

    const invId = Number(info.lastInsertRowid);

    const itemStmt = db.prepare(`
      INSERT INTO travel_invoice_items (
        invoice_id, service_type, service_ref_id, supplier_type, supplier_id, supplier_name,
        description, statement, passenger_name, cost_price, service_fees, agency_commission,
        selling_price, profit, accounting_impact_account
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    processedItems.forEach(i => {
      itemStmt.run(
        invId, i.service_type, i.service_ref_id, i.supplier_type, i.supplier_id, i.supplier_name,
        i.description, i.statement, i.passenger_name, i.cost_price, i.service_fees, i.agency_commission,
        i.selling_price, i.profit, i.accounting_impact_account
      );
    });

    const newInv = db.prepare("SELECT * FROM travel_invoices WHERE id = ?").get(invId);
    const invItems = db.prepare("SELECT * FROM travel_invoice_items WHERE invoice_id = ?").all(invId);

    logAudit(user.id, user.name, "إصدار فاتورة مبيعات مركزية", `تم إصدار الفاتورة رقم: ${invNum} للعميل: ${customer_name} بإجمالي: ${netSell} ${curr}`);

    res.status(201).json({ ...newInv, items: invItems });
  } catch (err: any) {
    console.error("Error creating travel invoice:", err);
    res.status(500).json({ error: "فشل في حفظ وتأكيد الفاتورة: " + err.message });
  }
});

router.put("/travel/invoices/:id", (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

    const id = req.params.id;
    const existing = db.prepare("SELECT * FROM travel_invoices WHERE id = ?").get(id) as any;
    if (!existing) { res.status(404).json({ error: "الفاتورة غير موجودة" }); return; }

    const {
      customer_id, customer_name, customer_statement, currency, exchange_rate,
      invoice_date, payment_method, payment_status,
      discount, paid_amount, notes, items,
      debit_account_code, credit_account_code, commission_account_code, supplier_account_code
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      res.status(400).json({ error: "اسم العميل مطلوب" });
      return;
    }

    const itemsList = Array.isArray(items) && items.length > 0 ? items : [
      {
        service_type: "flight",
        description: "خدمة سياحية",
        cost_price: 0,
        service_fees: 0,
        agency_commission: 0,
        selling_price: 0
      }
    ];

    let costSub = 0;
    let feesSub = 0;
    let sellingSub = 0;
    let totalComm = 0;

    const processedItems = itemsList.map((item: any) => {
      const cost = Math.max(0, Number(item.cost_price || 0));
      const fees = Math.max(0, Number(item.service_fees || 0));
      const sell = Math.max(0, Number(item.selling_price || 0));
      const comm = Number(item.agency_commission !== undefined ? item.agency_commission : Math.max(0, sell - (cost + fees)));
      const profit = sell - (cost + fees);

      costSub += cost;
      feesSub += fees;
      sellingSub += sell;
      totalComm += comm;

      return {
        service_type: item.service_type || 'flight',
        service_ref_id: item.service_ref_id ? Number(item.service_ref_id) : null,
        supplier_type: item.supplier_type || null,
        supplier_id: item.supplier_id ? Number(item.supplier_id) : null,
        supplier_name: item.supplier_name || null,
        description: item.description || 'خدمة سياحية',
        statement: item.statement || item.description || customer_statement || 'بيان الخدمة',
        passenger_name: item.passenger_name || customer_name || null,
        cost_price: cost,
        service_fees: fees,
        agency_commission: comm,
        selling_price: sell,
        profit,
        accounting_impact_account: item.accounting_impact_account || '40000'
      };
    });

    const disc = Math.max(0, Number(discount || 0));
    const netSell = Math.max(0, sellingSub - disc);
    const netProf = netSell - (costSub + feesSub);
    const paid = Number(paid_amount !== undefined ? paid_amount : (payment_method === 'credit' ? 0 : netSell));
    const rem = Math.max(0, netSell - paid);
    const dateStr = invoice_date || existing.invoice_date;
    const curr = currency || existing.currency || 'SAR';
    const exRate = Number(exchange_rate || existing.exchange_rate || 1.0);

    const debitAcc = debit_account_code || existing.debit_account_code || '11100';
    const creditAcc = credit_account_code || existing.credit_account_code || '40000';
    const commAcc = commission_account_code || existing.commission_account_code || '45000';
    const suppAcc = supplier_account_code || existing.supplier_account_code || '21100';

    db.prepare(`
      UPDATE travel_invoices SET
        customer_id = ?, customer_name = ?, customer_statement = ?, currency = ?, exchange_rate = ?,
        invoice_date = ?, payment_method = ?, payment_status = ?,
        cost_subtotal = ?, fees_subtotal = ?, selling_subtotal = ?, discount = ?, net_selling = ?, net_profit = ?,
        total_commission = ?, paid_amount = ?, remaining_amount = ?,
        debit_account_code = ?, credit_account_code = ?, commission_account_code = ?, supplier_account_code = ?,
        notes = ?
      WHERE id = ?
    `).run(
      customer_id || null, customer_name, customer_statement || `معاملة سفر للعميل ${customer_name}`, curr, exRate,
      dateStr, payment_method || 'cash', payment_status || (rem <= 0 ? 'paid' : 'partial'),
      costSub, feesSub, sellingSub, disc, netSell, netProf,
      totalComm, paid, rem,
      debitAcc, creditAcc, commAcc, suppAcc,
      notes || null, id
    );

    // Replace items
    db.prepare("DELETE FROM travel_invoice_items WHERE invoice_id = ?").run(id);

    const itemStmt = db.prepare(`
      INSERT INTO travel_invoice_items (
        invoice_id, service_type, service_ref_id, supplier_type, supplier_id, supplier_name,
        description, statement, passenger_name, cost_price, service_fees, agency_commission,
        selling_price, profit, accounting_impact_account
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    processedItems.forEach(i => {
      itemStmt.run(
        id, i.service_type, i.service_ref_id, i.supplier_type, i.supplier_id, i.supplier_name,
        i.description, i.statement, i.passenger_name, i.cost_price, i.service_fees, i.agency_commission,
        i.selling_price, i.profit, i.accounting_impact_account
      );
    });

    const updatedInv = db.prepare("SELECT * FROM travel_invoices WHERE id = ?").get(id);
    const updatedItems = db.prepare("SELECT * FROM travel_invoice_items WHERE invoice_id = ?").all(id);

    logAudit(user.id, user.name, "تعديل فاتورة مبيعات مركزية", `تم تعديل الفاتورة رقم: ${existing.invoice_number}`);

    res.json({ ...updatedInv, items: updatedItems });
  } catch (err: any) {
    console.error("Error updating travel invoice:", err);
    res.status(500).json({ error: "فشل في تحديث الفاتورة: " + err.message });
  }
});

router.delete("/travel/invoices/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  db.prepare("DELETE FROM travel_invoices WHERE id = ?").run(req.params.id);
  res.status(204).send();
});


// ============================================================================
// MODULE 20: QUOTATIONS SYSTEM (عروض الأسعار)
// ============================================================================
router.get("/travel/quotations", (_req, res) => {
  const rows = db.prepare(`
    SELECT q.*,
           (SELECT COUNT(*) FROM travel_quotation_items WHERE quotation_id = q.id) as items_count
    FROM travel_quotations q
    ORDER BY q.id DESC
  `).all();
  res.json(rows);
});

router.get("/travel/quotations/:id", (req, res) => {
  const quo = db.prepare("SELECT * FROM travel_quotations WHERE id = ?").get(req.params.id);
  if (!quo) { res.status(404).json({ error: "عرض السعر غير موجود" }); return; }
  const items = db.prepare("SELECT * FROM travel_quotation_items WHERE quotation_id = ?").all(req.params.id);
  res.json({ ...quo, items });
});

router.post("/travel/quotations", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    customer_id, customer_name, quotation_date, valid_until, terms_conditions, notes, items
  } = req.body;

  if (!customer_name || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "بيانات العميل وبنود عرض السعر مطلوبة" });
    return;
  }

  let totalCost = 0;
  let totalFees = 0;
  let totalSelling = 0;

  const processedItems = items.map((item: any) => {
    const cost = Number(item.cost_price || 0);
    const fees = Number(item.service_fees || 0);
    const sell = Number(item.selling_price || 0);
    const profit = sell - (cost + fees);

    totalCost += cost;
    totalFees += fees;
    totalSelling += sell;

    return {
      service_type: item.service_type || 'flight',
      description: item.description || 'خدمة سياحية',
      cost_price: cost,
      service_fees: fees,
      selling_price: sell,
      profit
    };
  });

  const totalProf = totalSelling - (totalCost + totalFees);
  const quoNum = `QUO-${Date.now().toString().slice(-6)}`;
  const qDate = quotation_date || getBusinessDate("travel-services");
  const vUntil = valid_until || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const stmt = db.prepare(`
    INSERT INTO travel_quotations (
      quotation_number, quotation_date, valid_until, customer_id, customer_name, status,
      total_cost, total_fees, total_selling, total_profit, terms_conditions, user_name, notes
    ) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    quoNum, qDate, vUntil, customer_id || null, customer_name,
    totalCost, totalFees, totalSelling, totalProf,
    terms_conditions || "العرض ساري لمدة 7 أيام من تاريخه والتأكيد يعتمد على إتاحة التذاكر والفنادق",
    user.name, notes || null
  );

  const quoId = Number(info.lastInsertRowid);
  const itemStmt = db.prepare(`
    INSERT INTO travel_quotation_items (quotation_id, service_type, description, cost_price, service_fees, selling_price, profit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  processedItems.forEach(i => {
    itemStmt.run(quoId, i.service_type, i.description, i.cost_price, i.service_fees, i.selling_price, i.profit);
  });

  const newQuo = db.prepare("SELECT * FROM travel_quotations WHERE id = ?").get(quoId);
  const quoItems = db.prepare("SELECT * FROM travel_quotation_items WHERE quotation_id = ?").all(quoId);

  res.status(201).json({ ...newQuo, items: quoItems });
});

router.put("/travel/quotations/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { status, terms_conditions, notes } = req.body;
  db.prepare("UPDATE travel_quotations SET status = ?, terms_conditions = ?, notes = ? WHERE id = ?")
    .run(status || 'sent', terms_conditions || null, notes || null, req.params.id);

  const updated = db.prepare("SELECT * FROM travel_quotations WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// Convert quotation to official sales invoice in 1 click!
router.post("/travel/quotations/:id/convert", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const quo = db.prepare("SELECT * FROM travel_quotations WHERE id = ?").get(req.params.id) as any;
  if (!quo) { res.status(404).json({ error: "عرض السعر غير موجود" }); return; }

  const items = db.prepare("SELECT * FROM travel_quotation_items WHERE quotation_id = ?").all(req.params.id) as any[];

  const invNum = `INV-TRV-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toISOString().slice(0, 10);

  // Journal Entry
  let jId: number | null = null;
  try {
    jId = createDoubleEntryJournal(
      dateStr,
      `تحويل عرض سعر رقم ${quo.quotation_number} إلى فاتورة مبيعات ${invNum}`,
      "travel_quotation_convert",
      quo.id,
      [
        { account_code: "11100", debit: quo.total_selling, credit: 0, description: `تحصيل قيمة فاتورة عرض السعر ${quo.quotation_number}` },
        { account_code: "41000", debit: 0, credit: quo.total_selling, description: `إيرادات مبيعات خدمات السفر` },
        { account_code: "51000", debit: quo.total_cost + quo.total_fees, credit: 0, description: `تكلفة خدمات العرض` },
        { account_code: "21100", debit: 0, credit: quo.total_cost + quo.total_fees, description: `مستحقات الموردين` }
      ]
    );
  } catch (err) {
    console.error("Journal entry error on quotation conversion:", err);
  }

  const stmt = db.prepare(`
    INSERT INTO travel_invoices (
      invoice_number, invoice_date, customer_id, customer_name, payment_method, payment_status,
      cost_subtotal, fees_subtotal, selling_subtotal, discount, net_selling, net_profit,
      paid_amount, remaining_amount, journal_entry_id, user_id, user_name, notes
    ) VALUES (?, ?, ?, ?, 'cash', 'paid', ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    invNum, dateStr, quo.customer_id, quo.customer_name,
    quo.total_cost, quo.total_fees, quo.total_selling, quo.total_selling, quo.total_profit,
    quo.total_selling, jId, user.id, user.name, `تم الإصدار بناء على عرض السعر ${quo.quotation_number}`
  );

  const invId = Number(info.lastInsertRowid);
  const itemStmt = db.prepare(`
    INSERT INTO travel_invoice_items (invoice_id, service_type, description, cost_price, service_fees, selling_price, profit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  items.forEach(i => {
    itemStmt.run(invId, i.service_type, i.description, i.cost_price, i.service_fees, i.selling_price, i.profit);
  });

  // Update quotation status
  db.prepare("UPDATE travel_quotations SET status = 'accepted', converted_invoice_id = ? WHERE id = ?")
    .run(invId, req.params.id);

  res.json({ message: "تم تحويل عرض السعر إلى فاتورة مبيعات بنجاح ✅", invoice_id: invId });
});


// ============================================================================
// MODULE 21: PROCUREMENT SYSTEM (إدارة المشتريات والخدمات)
// ============================================================================
router.get("/travel/procurement/orders", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_procurement_orders ORDER BY id DESC").all();
  res.json(rows);
});

router.post("/travel/procurement/orders", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { supplier_id, supplier_name, service_category, total_cost, expected_selling_price, notes } = req.body;
  if (!supplier_name) { res.status(400).json({ error: "اسم المورد مطلوب" }); return; }

  const poNum = `PO-TRV-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toISOString().slice(0, 10);
  const cost = Number(total_cost || 0);
  const sell = Number(expected_selling_price || 0);
  const prof = sell - cost;

  const stmt = db.prepare(`
    INSERT INTO travel_procurement_orders (po_number, po_date, supplier_id, supplier_name, service_category, status, total_cost, expected_selling_price, expected_profit, user_name, notes)
    VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(poNum, dateStr, supplier_id || null, supplier_name, service_category || 'تذاكر طيران', cost, sell, prof, user.name, notes || null);
  const newPo = db.prepare("SELECT * FROM travel_procurement_orders WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(newPo);
});

router.get("/travel/procurement/invoices", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_procurement_invoices ORDER BY id DESC").all();
  res.json(rows);
});

router.post("/travel/procurement/invoices", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    po_id, supplier_id, supplier_name, supplier_invoice_ref,
    payment_method, notes, items
  } = req.body;

  if (!supplier_name || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "اسم المورد وبنود فاتورة المشتريات مطلوبة" });
    return;
  }

  let costSub = 0;
  let feesSub = 0;
  let sellingSub = 0;

  const processedItems = items.map((i: any) => {
    const cost = Number(i.cost_price || 0);
    const fees = Number(i.fees || 0);
    const sell = Number(i.selling_price || 0);
    const profit = sell - (cost + fees);

    costSub += cost;
    feesSub += fees;
    sellingSub += sell;

    return {
      service_type: i.service_type || 'flight',
      description: i.description || 'خدمة مشتراة',
      cost_price: cost,
      fees,
      selling_price: sell,
      profit
    };
  });

  const netProf = sellingSub - (costSub + feesSub);
  const piNum = `PI-TRV-${Date.now().toString().slice(-6)}`;
  const dateStr = new Date().toISOString().slice(0, 10);

  // Journal Entry
  let jId: number | null = null;
  try {
    // Debit COGS / Cost of Services (51000)
    // Credit Bank / Cash (11100) or Supplier Payables (21100)
    jId = createDoubleEntryJournal(
      dateStr,
      `فاتورة توريد وشراء خدمات سفر وسياحة رقم ${piNum} من المورد ${supplier_name}`,
      "travel_procurement_invoice",
      0,
      [
        { account_code: "51000", debit: costSub + feesSub, credit: 0, description: `تكلفة الخدمات المشتراة من ${supplier_name}` },
        { account_code: "21100", debit: 0, credit: costSub + feesSub, description: `دائن: مستحقات المورد ${supplier_name}` }
      ]
    );
  } catch (err) {
    console.error("Journal entry error on travel procurement:", err);
  }

  const stmt = db.prepare(`
    INSERT INTO travel_procurement_invoices (
      pi_number, pi_date, po_id, supplier_id, supplier_name, supplier_invoice_ref,
      cost_subtotal, fees_subtotal, selling_subtotal, net_profit, payment_status, payment_method,
      journal_entry_id, user_name, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)
  `);

  const info = stmt.run(
    piNum, dateStr, po_id || null, supplier_id || null, supplier_name, supplier_invoice_ref || null,
    costSub, feesSub, sellingSub, netProf, payment_method || 'bank',
    jId, user.name, notes || null
  );

  const piId = Number(info.lastInsertRowid);
  const itemStmt = db.prepare(`
    INSERT INTO travel_procurement_items (procurement_invoice_id, service_type, description, cost_price, fees, selling_price, profit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  processedItems.forEach(i => {
    itemStmt.run(piId, i.service_type, i.description, i.cost_price, i.fees, i.selling_price, i.profit);
  });

  // Update supplier balance
  if (supplier_id) {
    db.prepare("UPDATE travel_suppliers SET current_balance = current_balance + ? WHERE id = ?").run(costSub + feesSub, supplier_id);
  }

  const newPi = db.prepare("SELECT * FROM travel_procurement_invoices WHERE id = ?").get(piId);
  res.status(201).json(newPi);
});

// ============================================================================
// MODULE 22: COMMISSIONS MANAGEMENT (إدارة العمولات)
// ============================================================================
router.get("/travel/commissions", (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = "SELECT * FROM travel_commissions WHERE 1=1";
    const params: any[] = [];

    if (type) {
      query += " AND commission_type = ?";
      params.push(type);
    }
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    if (search) {
      query += " AND (entity_name LIKE ? OR commission_code LIKE ? OR notes LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += " ORDER BY id DESC";
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/travel/commissions/stats", (_req, res) => {
  try {
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(expected_amount), 0) as total_expected,
        COALESCE(SUM(received_amount), 0) as total_received,
        COALESCE(SUM(due_amount), 0) as total_due,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(difference), 0) as total_difference,
        COUNT(*) as total_count
      FROM travel_commissions
    `).get() as any;

    const byType = db.prepare(`
      SELECT
        commission_type,
        COALESCE(SUM(expected_amount), 0) as expected,
        COALESCE(SUM(received_amount), 0) as received,
        COALESCE(SUM(due_amount), 0) as due,
        COALESCE(SUM(paid_amount), 0) as paid,
        COALESCE(SUM(difference), 0) as difference,
        COUNT(*) as count
      FROM travel_commissions
      GROUP BY commission_type
    `).all();

    res.json({
      ...totals,
      byType
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/travel/commissions", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    commission_type, entity_id, entity_name, reference_type, reference_id, reference_number,
    currency, expected_amount, received_amount, due_amount, paid_amount, due_date, notes
  } = req.body;

  if (!commission_type || !entity_name) {
    res.status(400).json({ error: "نوع العمولة واسم الجهة/الجهة المانحة أو المستحقة حقلان إجباريان" });
    return;
  }

  const code = `COM-${Date.now().toString().slice(-6)}`;
  const exp = Number(expected_amount || 0);
  const rec = Number(received_amount || 0);
  const due = Number(due_amount || (exp - rec > 0 ? exp - rec : 0));
  const pd = Number(paid_amount || 0);
  const diff = exp - (rec + pd);

  let status = "pending";
  if (diff <= 0 && exp > 0) status = "settled";
  else if (rec > 0 || pd > 0) status = "partially_received";

  try {
    const stmt = db.prepare(`
      INSERT INTO travel_commissions (
        commission_code, commission_type, entity_id, entity_name, reference_type, reference_id, reference_number,
        currency, expected_amount, received_amount, due_amount, paid_amount, difference, status, due_date, notes, user_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      code, commission_type, entity_id || null, entity_name, reference_type || 'booking', reference_id || null, reference_number || null,
      currency || 'ريال', exp, rec, due, pd, diff, status, due_date || null, notes || null, user.name
    );

    const created = db.prepare("SELECT * FROM travel_commissions WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/travel/commissions/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    commission_type, entity_name, currency, expected_amount, received_amount,
    due_amount, paid_amount, status, due_date, payment_date, notes
  } = req.body;

  const exp = Number(expected_amount || 0);
  const rec = Number(received_amount || 0);
  const due = Number(due_amount || 0);
  const pd = Number(paid_amount || 0);
  const diff = exp - (rec + pd);

  try {
    db.prepare(`
      UPDATE travel_commissions
      SET commission_type = COALESCE(?, commission_type),
          entity_name = COALESCE(?, entity_name),
          currency = COALESCE(?, currency),
          expected_amount = ?,
          received_amount = ?,
          due_amount = ?,
          paid_amount = ?,
          difference = ?,
          status = COALESCE(?, status),
          due_date = ?,
          payment_date = ?,
          notes = ?
      WHERE id = ?
    `).run(
      commission_type || null, entity_name || null, currency || null,
      exp, rec, due, pd, diff, status || null,
      due_date || null, payment_date || null, notes || null,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM travel_commissions WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/travel/commissions/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  try {
    db.prepare("DELETE FROM travel_commissions WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "تم حذف سجل العمولة بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 21: DOCUMENT NUMBERING CONFIG (ترقيم المستندات)
// ============================================================================
router.get("/travel/numbering-config", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM document_numbering_config ORDER BY branch_id, doc_type").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/travel/numbering-config", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const configs = Array.isArray(req.body) ? req.body : [req.body];
  try {
    const stmt = db.prepare(`
      INSERT INTO document_numbering_config (branch_id, doc_type, prefix, use_year, seq_length, current_seq, suffix)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(branch_id, doc_type) DO UPDATE SET
        prefix = excluded.prefix,
        use_year = excluded.use_year,
        seq_length = excluded.seq_length,
        current_seq = excluded.current_seq,
        suffix = excluded.suffix
    `);

    configs.forEach((cfg: any) => {
      stmt.run(
        cfg.branch_id || 1,
        cfg.doc_type,
        cfg.prefix || "DOC",
        cfg.use_year !== undefined ? (cfg.use_year ? 1 : 0) : 1,
        cfg.seq_length || 5,
        cfg.current_seq || 1,
        cfg.suffix || ""
      );
    });

    res.json({ success: true, message: "تم تحديث إعدادات ترقيم المستندات بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Helper route to generate next document number
router.post("/travel/generate-doc-number", (req, res) => {
  const { branch_id = 1, doc_type = "invoice" } = req.body;
  try {
    let cfg: any = db.prepare("SELECT * FROM document_numbering_config WHERE branch_id = ? AND doc_type = ?").get(branch_id, doc_type);
    if (!cfg) {
      cfg = { branch_id, doc_type, prefix: doc_type.toUpperCase().slice(0, 3), use_year: 1, seq_length: 5, current_seq: 1, suffix: "" };
      db.prepare(`
        INSERT INTO document_numbering_config (branch_id, doc_type, prefix, use_year, seq_length, current_seq, suffix)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(branch_id, doc_type, cfg.prefix, 1, 5, 1, "");
    }

    const currentYear = new Date().getFullYear();
    const seqStr = String(cfg.current_seq).padStart(cfg.seq_length || 5, '0');
    const yearStr = cfg.use_year ? `${currentYear}-` : '';
    const generatedNumber = `${cfg.prefix}-${yearStr}${seqStr}${cfg.suffix || ''}`;

    // Increment current sequence
    db.prepare("UPDATE document_numbering_config SET current_seq = current_seq + 1 WHERE branch_id = ? AND doc_type = ?")
      .run(branch_id, doc_type);

    res.json({ number: generatedNumber, doc_type, branch_id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 22: NOTIFICATIONS & REMINDERS (التنبيهات والتذكيرات)
// ============================================================================
router.get("/travel/notifications", (req, res) => {
  try {
    const status = req.query.status as string;
    let query = "SELECT * FROM travel_notifications";
    const params: any[] = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }
    query += " ORDER BY id DESC LIMIT 100";

    const rows = db.prepare(query).all(...params);

    // Also auto-generate reminders from active databases if requested or empty
    const unreadCount = (db.prepare("SELECT COUNT(*) as c FROM travel_notifications WHERE status = 'unread'").get() as { c: number }).c;
    res.json({ notifications: rows, unread_count: unreadCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/travel/notifications", (req, res) => {
  const { category, title, message, entity_type, entity_id, customer_name, passenger_name, due_date } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO travel_notifications (category, title, message, entity_type, entity_id, customer_name, passenger_name, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(category, title, message, entity_type || null, entity_id || null, customer_name || null, passenger_name || null, due_date || null);
    const created = db.prepare("SELECT * FROM travel_notifications WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/travel/notifications/:id/read", (req, res) => {
  try {
    db.prepare("UPDATE travel_notifications SET status = 'read' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 23: FILE ATTACHMENTS (إدارة الملفات والمرفقات)
// ============================================================================
router.get("/travel/attachments", (req, res) => {
  const { entity_type, entity_id } = req.query;
  try {
    let query = "SELECT id, entity_type, entity_id, file_name, file_type, file_size, category, created_by, created_at FROM travel_attachments";
    const params: any[] = [];

    if (entity_type && entity_id) {
      query += " WHERE entity_type = ? AND entity_id = ?";
      params.push(entity_type, entity_id);
    }
    query += " ORDER BY id DESC";

    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/travel/attachments", (req, res) => {
  const user = getAuthUser(req);
  const { entity_type, entity_id, file_name, file_type, file_size, file_data, category } = req.body;

  if (!entity_type || !entity_id || !file_name) {
    res.status(400).json({ error: "نوع الكيان ومعرفه واسم الملف حقول إجبارية" });
    return;
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO travel_attachments (entity_type, entity_id, file_name, file_type, file_size, file_data, category, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(entity_type, entity_id, file_name, file_type || 'application/octet-stream', file_size || 0, file_data || null, category || 'مستند عام', user ? user.name : 'النظام');
    const created = db.prepare("SELECT id, entity_type, entity_id, file_name, file_type, file_size, category, created_by, created_at FROM travel_attachments WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/travel/attachments/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM travel_attachments WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "تم حذف المرفق بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 24: GLOBAL UNIFIED SEARCH (البحث الشامل)
// ============================================================================
router.get("/travel/global-search", (req, res) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) {
    res.json({ customers: [], passengers: [], tickets: [], bookings: [], visas: [], hotels: [], invoices: [] });
    return;
  }

  const searchTerm = `%${q}%`;

  try {
    // 1. Customers
    const customers = db.prepare(`
      SELECT id, name, phone, email, passport_number, nationality, 'customer' as result_type
      FROM customers
      WHERE name LIKE ? OR phone LIKE ? OR passport_number LIKE ? OR email LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm, searchTerm);

    // 2. Passengers
    const passengers = db.prepare(`
      SELECT id, full_name_ar as name, passport_number, phone, nationality, 'passenger' as result_type
      FROM travel_passengers
      WHERE full_name_ar LIKE ? OR full_name_en LIKE ? OR passport_number LIKE ? OR phone LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm, searchTerm);

    // 3. Bookings & Tickets
    const bookings = db.prepare(`
      SELECT id, booking_code as code, pnr, customer_name, passenger_name, ticket_number, destination, service_type, 'booking' as result_type
      FROM travel_bookings
      WHERE booking_code LIKE ? OR pnr LIKE ? OR ticket_number LIKE ? OR customer_name LIKE ? OR passenger_name LIKE ? OR destination LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

    // 4. Visas
    const visas = db.prepare(`
      SELECT id, visa_code as code, passport_number, passenger_name, country, visa_type, status, 'visa' as result_type
      FROM travel_visas
      WHERE visa_code LIKE ? OR passport_number LIKE ? OR passenger_name LIKE ? OR country LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm, searchTerm);

    // 5. Hotels
    const hotels = db.prepare(`
      SELECT id, name_ar as name, city, country, phone, 'hotel' as result_type
      FROM travel_hotels_db
      WHERE name_ar LIKE ? OR name_en LIKE ? OR city LIKE ? OR phone LIKE ?
      LIMIT 10
    `).all(searchTerm, searchTerm, searchTerm, searchTerm);

    res.json({ customers, passengers, bookings, visas, hotels });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 25: SMART ANALYTICS DASHBOARD (التقارير الذكية)
// ============================================================================
router.get("/travel/smart-analytics", (_req, res) => {
  try {
    // Top Services
    const topServices = db.prepare(`
      SELECT service_type, COUNT(*) as count, SUM(selling_price) as total_sales, SUM(selling_price - cost_price) as total_profit
      FROM travel_bookings
      GROUP BY service_type
      ORDER BY total_sales DESC
    `).all();

    // Top Destinations
    const topDestinations = db.prepare(`
      SELECT destination_city as destination, COUNT(*) as count, SUM(selling_price) as total_sales
      FROM travel_bookings
      WHERE destination_city IS NOT NULL AND destination_city != ''
      GROUP BY destination_city
      ORDER BY count DESC
      LIMIT 6
    `).all();

    // Top Buyers / Customers
    const topCustomers = db.prepare(`
      SELECT COALESCE(c.name, tb.user_name, 'عميل عام') as customer_name, COUNT(*) as bookings_count, SUM(tb.selling_price) as total_spent
      FROM travel_bookings tb
      LEFT JOIN customers c ON c.id = tb.customer_id
      GROUP BY COALESCE(c.name, tb.user_name, 'عميل عام')
      ORDER BY total_spent DESC
      LIMIT 5
    `).all();

    // Top Airlines
    const topAirlines = db.prepare(`
      SELECT airline_supplier as airline_name, COUNT(*) as tickets_count, SUM(selling_price) as total_sales
      FROM travel_bookings
      WHERE airline_supplier IS NOT NULL AND airline_supplier != ''
      GROUP BY airline_supplier
      ORDER BY tickets_count DESC
      LIMIT 5
    `).all();

    // Overall metrics
    const totals = db.prepare(`
      SELECT 
        COUNT(*) as total_bookings,
        COALESCE(AVG(selling_price), 0) as avg_booking_value,
        COALESCE(SUM(cost_price), 0) as total_cost,
        COALESCE(SUM(selling_price), 0) as total_revenue,
        COALESCE(SUM(selling_price - cost_price), 0) as total_profit,
        COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END), 0) as refunded_count
      FROM travel_bookings
    `).get() as any;

    const totalBookings = totals.total_bookings || 1;
    const cancelRate = ((totals.cancelled_count / totalBookings) * 100).toFixed(1);
    const refundRate = ((totals.refunded_count / totalBookings) * 100).toFixed(1);
    const profitMargin = totals.total_revenue > 0 ? ((totals.total_profit / totals.total_revenue) * 100).toFixed(1) : "0";

    res.json({
      top_services: topServices,
      top_destinations: topDestinations,
      top_customers: topCustomers,
      top_airlines: topAirlines,
      avg_booking_value: Math.round(totals.avg_booking_value || 0),
      total_revenue: totals.total_revenue || 0,
      total_profit: totals.total_profit || 0,
      profit_margin: `${profitMargin}%`,
      cancellation_rate: `${cancelRate}%`,
      refund_rate: `${refundRate}%`
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 32: COMPREHENSIVE TRAVEL REPORTS CENTER (مركز تقارير السفريات)
// ============================================================================
router.get("/travel/reports/comprehensive", (req, res) => {
  try {
    const { startDate, endDate, branchId, serviceType } = req.query;
    const start = startDate ? String(startDate) : "1970-01-01";
    const end = endDate ? String(endDate) + " 23:59:59" : "2099-12-31 23:59:59";

    let branchCondition = "";
    const params: any[] = [start, end];
    if (branchId && branchId !== "all") {
      branchCondition = " AND branch_id = ?";
      params.push(Number(branchId));
    }

    // 1. Sales Summary by Service Type
    const salesByService = db.prepare(`
      SELECT 
        service_type,
        COUNT(*) as total_count,
        COALESCE(SUM(cost_price), 0) as total_cost,
        COALESCE(SUM(selling_price), 0) as total_sales,
        COALESCE(SUM(commission), 0) as total_commission,
        COALESCE(SUM(profit), 0) as total_profit
      FROM travel_bookings
      WHERE created_at BETWEEN ? AND ? ${branchCondition}
      GROUP BY service_type
    `).all(...params);

    // 2. Ticket Operations Report (Issued, Cancelled, Refunded, Modified)
    const ticketOperations = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(selling_price), 0) as sales_amount,
        COALESCE(SUM(profit), 0) as profit_amount
      FROM travel_bookings
      WHERE service_type = 'flight' AND created_at BETWEEN ? AND ? ${branchCondition}
      GROUP BY status
    `).all(...params);

    // 3. Airline Sales & Profits
    const airlineReport = db.prepare(`
      SELECT 
        COALESCE(airline_name, airline_supplier, 'غير محدد') as airline,
        COUNT(*) as ticket_count,
        COALESCE(SUM(selling_price), 0) as total_sales,
        COALESCE(SUM(cost_price), 0) as total_cost,
        COALESCE(SUM(profit), 0) as total_profit
      FROM travel_bookings
      WHERE (service_type = 'flight' OR service_type = 'طيران') AND created_at BETWEEN ? AND ? ${branchCondition}
      GROUP BY airline
      ORDER BY total_sales DESC
    `).all(...params);

    // 4. Employee / Agent Performance
    const employeePerformance = db.prepare(`
      SELECT 
        COALESCE(user_name, 'المدير') as agent_name,
        COUNT(*) as bookings_count,
        COALESCE(SUM(selling_price), 0) as total_sales,
        COALESCE(SUM(profit), 0) as total_profit,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
      FROM travel_bookings
      WHERE created_at BETWEEN ? AND ? ${branchCondition}
      GROUP BY agent_name
      ORDER BY total_sales DESC
    `).all(...params);

    // 5. Visas & Hotels Status Summary
    const visasSummary = db.prepare(`
      SELECT 
        country,
        status,
        COUNT(*) as count,
        COALESCE(SUM(cost_price), 0) as total_cost,
        COALESCE(SUM(selling_price), 0) as total_sales,
        COALESCE(SUM(selling_price - cost_price), 0) as total_profit
      FROM travel_visas
      WHERE created_at BETWEEN ? AND ?
      GROUP BY country, status
    `).all(start, end);

    const hotelsSummary = db.prepare(`
      SELECT 
        hotel_name,
        city_country,
        COUNT(*) as bookings_count,
        COALESCE(SUM(nights), 0) as total_nights,
        COALESCE(SUM(cost_price), 0) as total_cost,
        COALESCE(SUM(selling_price), 0) as total_sales,
        COALESCE(SUM(selling_price - cost_price), 0) as total_profit
      FROM travel_hotels
      WHERE created_at BETWEEN ? AND ?
      GROUP BY hotel_name
      ORDER BY total_sales DESC
    `).all(start, end);

    // 6. Financial Overview (Debts & Receivables, Totals)
    const overallStats = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        COALESCE(SUM(cost_price), 0) as grand_cost,
        COALESCE(SUM(selling_price), 0) as grand_sales,
        COALESCE(SUM(profit), 0) as grand_profit,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN selling_price ELSE 0 END), 0) as unpaid_receivables
      FROM travel_bookings
      WHERE created_at BETWEEN ? AND ? ${branchCondition}
    `).get(...params) as any;

    res.json({
      sales_by_service: salesByService,
      ticket_operations: ticketOperations,
      airline_report: airlineReport,
      employee_performance: employeePerformance,
      visas_summary: visasSummary,
      hotels_summary: hotelsSummary,
      overall_stats: overallStats
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 31: BRANCHES DATA & SUMMARY (الفروع)
// ============================================================================
router.get("/travel/branches/summary", (_req, res) => {
  try {
    const branches = db.prepare("SELECT * FROM branches WHERE active = 1").all() as any[];
    const result = branches.map(b => {
      const bookingsStat = db.prepare(`
        SELECT 
          COUNT(*) as total_bookings,
          COALESCE(SUM(selling_price), 0) as total_sales,
          COALESCE(SUM(profit), 0) as total_profit
        FROM travel_bookings
        WHERE branch_id = ?
      `).get(b.id) as any;

      const safeStat = db.prepare(`
        SELECT COALESCE(SUM(balance), 0) as safe_balance
        FROM safes
        WHERE branch_id = ? OR id = 1
      `).get(b.id) as any;

      const userCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE branch_id = ?").get(b.id) as any)?.c || 0;

      return {
        ...b,
        bookings_count: bookingsStat?.total_bookings || 0,
        total_sales: bookingsStat?.total_sales || 0,
        total_profit: bookingsStat?.total_profit || 0,
        safe_balance: safeStat?.safe_balance || 0,
        employees_count: userCount
      };
    });

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 37: MESSAGING SYSTEM (نظام المراسلات والإشعارات للعملاء)
// ============================================================================
router.post("/travel/send-message", (req, res) => {
  const user = getAuthUser(req);
  const { customer_id, customer_name, phone, message_type, template_name, content, reference_type, reference_id } = req.body;

  if (!phone || !content) {
    res.status(400).json({ error: "رقم الهاتف ونص الرسالة حقول إجبارية" });
    return;
  }

  try {
    // Format phone number for WhatsApp wa.me
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(content)}`;

    // Log contact in database
    const stmt = db.prepare(`
      INSERT INTO travel_contact_logs (customer_id, contact_type, summary, user_name)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(customer_id || 1, message_type || "واتساب", `إرسال رسالة [${template_name || 'مخصصة'}]: ${content.slice(0, 80)}...`, user ? user.name : "النظام");

    // Log audit for sensitive communications
    logAudit(
      user ? user.id : 0,
      user ? user.name : "النظام",
      "إرسال رسالة للعميل",
      `إرسال رسالة ${message_type || 'واتساب'} للعميل ${customer_name || phone} - المرجع: ${reference_type || ''} #${reference_id || ''}`,
      req.headers["user-agent"] || "Web Browser",
      req.ip,
      undefined,
      JSON.stringify({ phone, template_name, message_type })
    );

    res.json({
      success: true,
      whatsapp_url: waUrl,
      logged_at: new Date().toISOString(),
      message: "تم تجهيز وتسجيل الرسالة بنجاح"
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 39: WORKFLOW / STATE MANAGEMENT (إدارة الحالات ومسار العمليات)
// ============================================================================
router.post("/travel/bookings/:id/workflow", (req, res) => {
  const user = getAuthUser(req);
  const { target_status, note, reason } = req.body;
  const bookingId = req.params.id;

  try {
    const oldBooking: any = db.prepare("SELECT * FROM travel_bookings WHERE id = ?").get(bookingId);
    if (!oldBooking) {
      res.status(404).json({ error: "الحجز غير موجود" });
      return;
    }

    const oldStatus = oldBooking.status;

    // Update status
    db.prepare(`
      UPDATE travel_bookings 
      SET status = ?, 
          notes = CASE WHEN ? IS NOT NULL THEN notes || ' | ' || ? ELSE notes END
      WHERE id = ?
    `).run(target_status, note || null, note || null, bookingId);

    const updatedBooking = db.prepare("SELECT * FROM travel_bookings WHERE id = ?").get(bookingId);

    // Audit log state transition
    logAudit(
      user ? user.id : 0,
      user ? user.name : "النظام",
      "تحديث حالة الحجز (Workflow)",
      `تغيير حالة الحجز #${bookingId} (${oldBooking.booking_number || ''}) من [${oldStatus}] إلى [${target_status}]`,
      req.headers["user-agent"] || "Web Browser",
      req.ip,
      JSON.stringify({ status: oldStatus, booking: oldBooking }),
      JSON.stringify({ status: target_status, updated: updatedBooking }),
      reason || note
    );

    res.json({
      success: true,
      old_status: oldStatus,
      new_status: target_status,
      booking: updatedBooking
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 44: COMPREHENSIVE TRAVEL SYSTEM SETTINGS (إعدادات النظام الشاملة)
// ============================================================================
router.get("/travel/settings", (_req, res) => {
  try {
    let settings = db.prepare("SELECT * FROM travel_system_settings WHERE id = 1").get();
    if (!settings) {
      db.prepare(`
        INSERT INTO travel_system_settings (id, company_name_ar, company_name_en)
        VALUES (1, 'شركة العالمية للرحلات والسياحة', 'Al-Alamiya Travel & Tourism Co.')
      `).run();
      settings = db.prepare("SELECT * FROM travel_system_settings WHERE id = 1").get();
    }
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/travel/settings", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح: تعديل إعدادات النظام يتطلب صلاحية المدير" });
    return;
  }

  const {
    company_name_ar, company_name_en, iata_code, license_number, tax_number, commercial_reg,
    phone_primary, phone_secondary, email, website, address, default_currency, vat_percentage,
    allow_selling_below_cost, require_customer_for_tickets, enforce_visa_document_checklist,
    auto_generate_invoice_on_booking, auto_register_commission, strict_financial_deletion_prevention,
    ticket_refund_penalty_default, ticket_refund_office_fee_default,
    invoice_header_text, invoice_footer_terms, ticket_header_text, ticket_footer_terms, visa_footer_terms, logo_url
  } = req.body;

  try {
    const oldSettings = db.prepare("SELECT * FROM travel_system_settings WHERE id = 1").get();

    db.prepare(`
      UPDATE travel_system_settings SET
        company_name_ar = ?, company_name_en = ?, iata_code = ?, license_number = ?, tax_number = ?, commercial_reg = ?,
        phone_primary = ?, phone_secondary = ?, email = ?, website = ?, address = ?, default_currency = ?, vat_percentage = ?,
        allow_selling_below_cost = ?, require_customer_for_tickets = ?, enforce_visa_document_checklist = ?,
        auto_generate_invoice_on_booking = ?, auto_register_commission = ?, strict_financial_deletion_prevention = ?,
        ticket_refund_penalty_default = ?, ticket_refund_office_fee_default = ?,
        invoice_header_text = ?, invoice_footer_terms = ?, ticket_header_text = ?, ticket_footer_terms = ?, visa_footer_terms = ?, logo_url = ?
      WHERE id = 1
    `).run(
      company_name_ar || 'شركة العالمية للرحلات والسياحة',
      company_name_en || 'Al-Alamiya Travel & Tourism Co.',
      iata_code || null,
      license_number || null,
      tax_number || null,
      commercial_reg || null,
      phone_primary || null,
      phone_secondary || null,
      email || null,
      website || null,
      address || null,
      default_currency || 'ريال',
      Number(vat_percentage || 15.0),
      allow_selling_below_cost ? 1 : 0,
      require_customer_for_tickets ? 1 : 0,
      enforce_visa_document_checklist ? 1 : 0,
      auto_generate_invoice_on_booking ? 1 : 0,
      auto_register_commission ? 1 : 0,
      strict_financial_deletion_prevention ? 1 : 0,
      Number(ticket_refund_penalty_default || 100),
      Number(ticket_refund_office_fee_default || 50),
      invoice_header_text || null,
      invoice_footer_terms || null,
      ticket_header_text || null,
      ticket_footer_terms || null,
      visa_footer_terms || null,
      logo_url || '/omnisystem-logo.png'
    );

    const updated = db.prepare("SELECT * FROM travel_system_settings WHERE id = 1").get();

    logAudit(
      user.id,
      user.name,
      "تحديث إعدادات النظام وقواعد العمل",
      "تم تحديث إعدادات وهوية وكالة السفر وقواعد العمل المحاسبية",
      req.headers["user-agent"] || "Web Browser",
      req.ip,
      JSON.stringify(oldSettings),
      JSON.stringify(updated)
    );

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 44/45: VISA TYPES & CHECKLIST MANAGEMENT (أنواع التأشيرات ومتطلباتها)
// ============================================================================
router.get("/travel/visa-types", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM travel_visa_types ORDER BY country ASC, id ASC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/travel/visa-types", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح بإضافة أنواع التأشيرات" });
    return;
  }

  const {
    country, country_en, name, visa_code, visa_category, standard_fee,
    embassy_fee, processing_days, validity_days, stay_days, entry_type,
    required_documents, notes
  } = req.body;

  if (!country || !name) {
    res.status(400).json({ error: "الدولة واسم التأشيرة حقول إجبارية" });
    return;
  }

  try {
    const code = visa_code || `VSA-${Date.now().toString().slice(-5)}`;
    const docsJson = typeof required_documents === "string" ? required_documents : JSON.stringify(required_documents || []);

    const stmt = db.prepare(`
      INSERT INTO travel_visa_types (
        country, country_en, name, visa_code, visa_category, standard_fee,
        embassy_fee, processing_days, validity_days, stay_days, entry_type,
        required_documents, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      country, country_en || null, name, code, visa_category || 'سياحة',
      Number(standard_fee || 0), Number(embassy_fee || 0), Number(processing_days || 7),
      Number(validity_days || 90), Number(stay_days || 30), entry_type || 'سفرة واحدة',
      docsJson, notes || null
    );

    const newVt = db.prepare("SELECT * FROM travel_visa_types WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(newVt);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/travel/visa-types/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }

  const {
    country, country_en, name, visa_code, visa_category, standard_fee,
    embassy_fee, processing_days, validity_days, stay_days, entry_type,
    required_documents, notes, active
  } = req.body;

  try {
    const docsJson = typeof required_documents === "string" ? required_documents : JSON.stringify(required_documents || []);

    db.prepare(`
      UPDATE travel_visa_types SET
        country = ?, country_en = ?, name = ?, visa_code = ?, visa_category = ?,
        standard_fee = ?, embassy_fee = ?, processing_days = ?, validity_days = ?,
        stay_days = ?, entry_type = ?, required_documents = ?, notes = ?, active = ?
      WHERE id = ?
    `).run(
      country, country_en || null, name, visa_code, visa_category || 'سياحة',
      Number(standard_fee || 0), Number(embassy_fee || 0), Number(processing_days || 7),
      Number(validity_days || 90), Number(stay_days || 30), entry_type || 'سفرة واحدة',
      docsJson, notes || null, active !== undefined ? (active ? 1 : 0) : 1,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM travel_visa_types WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/travel/visa-types/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }
  try {
    db.prepare("DELETE FROM travel_visa_types WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODULE 48: TASK & FOLLOW-UP MANAGEMENT (إدارة المهام والمتابعات اليومية)
// ============================================================================
router.get("/travel/tasks", (req, res) => {
  const { status, priority, task_type, user_id, search } = req.query;
  try {
    let sql = `SELECT * FROM travel_tasks WHERE 1=1`;
    const params: any[] = [];

    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (priority && priority !== 'all') {
      sql += ` AND priority = ?`;
      params.push(priority);
    }
    if (task_type && task_type !== 'all') {
      sql += ` AND task_type = ?`;
      params.push(task_type);
    }
    if (user_id) {
      sql += ` AND assigned_to_user_id = ?`;
      params.push(user_id);
    }
    if (search) {
      sql += ` AND (title LIKE ? OR description LIKE ? OR related_entity_title LIKE ? OR assigned_to_name LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    sql += ` ORDER BY CASE WHEN priority = 'urgent' THEN 1 WHEN priority = 'high' THEN 2 WHEN priority = 'medium' THEN 3 ELSE 4 END, due_date ASC, id DESC`;

    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/travel/tasks", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    title, description, task_type, priority, status, assigned_to_user_id,
    assigned_to_name, related_entity_type, related_entity_id, related_entity_title,
    due_date, reminder_date, notes
  } = req.body;

  if (!title) {
    res.status(400).json({ error: "عنوان المهمة مطلوب" });
    return;
  }

  try {
    const code = `TSK-${Date.now().toString().slice(-6)}`;
    const stmt = db.prepare(`
      INSERT INTO travel_tasks (
        task_code, title, description, task_type, priority, status,
        assigned_to_user_id, assigned_to_name, related_entity_type, related_entity_id,
        related_entity_title, due_date, reminder_date, notes, created_by, branch_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const info = stmt.run(
      code, title, description || null, task_type || 'general', priority || 'medium',
      status || 'pending', assigned_to_user_id || null, assigned_to_name || 'موظف غير محدد',
      related_entity_type || null, related_entity_id || null, related_entity_title || null,
      due_date || dateToStr(new Date()), reminder_date || null, notes || null, user.name
    );

    const newTask = db.prepare("SELECT * FROM travel_tasks WHERE id = ?").get(info.lastInsertRowid);

    logAudit(
      user.id,
      user.name,
      "إنشاء مهمة عمل جديدة",
      `إنشاء المهمة [${title}] بالأولوية [${priority || 'متوسط'}] وإسنادها إلى [${assigned_to_name || 'غير محدد'}]`,
      req.headers["user-agent"] || "Web Browser",
      req.ip,
      undefined,
      JSON.stringify(newTask)
    );

    res.status(201).json(newTask);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/travel/tasks/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    title, description, task_type, priority, status, assigned_to_user_id,
    assigned_to_name, related_entity_type, related_entity_id, related_entity_title,
    due_date, reminder_date, notes
  } = req.body;

  try {
    const oldTask = db.prepare("SELECT * FROM travel_tasks WHERE id = ?").get(req.params.id);
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE travel_tasks SET
        title = ?, description = ?, task_type = ?, priority = ?, status = ?,
        assigned_to_user_id = ?, assigned_to_name = ?, related_entity_type = ?,
        related_entity_id = ?, related_entity_title = ?, due_date = ?, reminder_date = ?,
        notes = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now', 'localtime') ELSE NULL END
      WHERE id = ?
    `).run(
      title, description || null, task_type || 'general', priority || 'medium', status || 'pending',
      assigned_to_user_id || null, assigned_to_name || null, related_entity_type || null,
      related_entity_id || null, related_entity_title || null, due_date || null, reminder_date || null,
      notes || null, status, req.params.id
    );

    const updated = db.prepare("SELECT * FROM travel_tasks WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/travel/tasks/:id/status", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { status, notes } = req.body;
  if (!status) {
    res.status(400).json({ error: "الحالة مطلوبة" });
    return;
  }

  try {
    db.prepare(`
      UPDATE travel_tasks SET
        status = ?,
        notes = CASE WHEN ? IS NOT NULL THEN COALESCE(notes, '') || ' | ' || ? ELSE notes END,
        completed_at = CASE WHEN ? = 'completed' THEN datetime('now', 'localtime') ELSE NULL END
      WHERE id = ?
    `).run(status, notes || null, notes || null, status, req.params.id);

    const updated = db.prepare("SELECT * FROM travel_tasks WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/travel/tasks/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    db.prepare("DELETE FROM travel_tasks WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Helper date to string YYYY-MM-DD
function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// MODULE 47: DAILY OPERATIONS CENTER (مركز العمليات اليومية)
// ============================================================================
router.get("/travel/daily-operations", (req, res) => {
  const today = (req.query.date as string) || dateToStr(new Date());

  try {
    // 1. Today's flights departing or arriving or issued
    let todayFlights: any[] = [];
    try {
      todayFlights = db.prepare(`
        SELECT b.*, c.name as customer_name, c.phone as customer_phone,
               p.name_ar as passenger_name_ar, p.passport_number
        FROM travel_bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN travel_passengers p ON p.id = b.passenger_id
        WHERE (b.departure_date = ? OR b.return_date = ? OR b.arrival_date = ? OR b.issue_date = ? OR DATE(b.created_at) = ?)
        ORDER BY b.id DESC
      `).all(today, today, today, today, today);
    } catch (err) {
      console.error("Error fetching today flights:", err);
    }

    // 2. Today's Hotel Check-ins / Check-outs
    let todayHotels: any[] = [];
    try {
      todayHotels = db.prepare(`
        SELECT h.*, c.name as customer_name, c.phone as customer_phone,
               p.name_ar as passenger_name_ar
        FROM travel_hotels h
        LEFT JOIN customers c ON c.id = h.customer_id
        LEFT JOIN travel_passengers p ON p.id = h.passenger_id
        WHERE (h.check_in = ? OR h.check_out = ? OR DATE(h.created_at) = ?)
        ORDER BY h.id DESC
      `).all(today, today, today);
    } catch (err) {
      console.error("Error fetching today hotels:", err);
    }

    // 3. Today's Transport & Airport Transfers
    let todayTransports: any[] = [];
    try {
      todayTransports = db.prepare(`
        SELECT t.*, c.name as customer_name, c.phone as customer_phone
        FROM travel_transports t
        LEFT JOIN customers c ON c.id = t.customer_id
        WHERE (DATE(t.pickup_datetime) = ? OR DATE(t.created_at) = ?)
        ORDER BY t.id DESC
      `).all(today, today);
    } catch (err) {
      console.error("Error fetching today transports:", err);
    }

    // 4. Today's Visas due / submitted / expiring
    let todayVisas: any[] = [];
    try {
      todayVisas = db.prepare(`
        SELECT v.*, c.name as customer_name, c.phone as customer_phone,
               p.name_ar as passenger_name_ar, p.passport_number
        FROM travel_visas v
        LEFT JOIN customers c ON c.id = v.customer_id
        LEFT JOIN travel_passengers p ON p.id = v.passenger_id
        WHERE (v.application_date = ? OR v.expiry_date = ? OR v.status IN ('under_process', 'pending', 'in_embassy') OR DATE(v.created_at) = ?)
        ORDER BY v.id DESC
      `).all(today, today, today);
    } catch (err) {
      console.error("Error fetching today visas:", err);
    }

    // 5. Active & Urgent Tasks for Today
    let todayTasks: any[] = [];
    try {
      todayTasks = db.prepare(`
        SELECT * FROM travel_tasks
        WHERE (due_date = ? OR status IN ('pending', 'in_progress', 'urgent'))
        ORDER BY CASE WHEN priority = 'urgent' THEN 1 WHEN priority = 'high' THEN 2 ELSE 3 END, id DESC
        LIMIT 30
      `).all(today);
    } catch (err) {
      console.error("Error fetching today tasks:", err);
    }

    // 6. Today's Financial summary
    let todayFinancial: any = {
      total_tickets_issued: 0,
      total_ticket_sales: 0,
      total_ticket_profit: 0,
      refunds_count: 0,
      total_refunds_amount: 0
    };
    try {
      todayFinancial = db.prepare(`
        SELECT 
          COUNT(DISTINCT b.id) as total_tickets_issued,
          COALESCE(SUM(b.selling_price), 0) as total_ticket_sales,
          COALESCE(SUM(b.profit), 0) as total_ticket_profit,
          (SELECT COUNT(*) FROM travel_ticket_refunds WHERE DATE(created_at) = ?) as refunds_count,
          (SELECT COALESCE(SUM(net_refund_to_customer), 0) FROM travel_ticket_refunds WHERE DATE(created_at) = ?) as total_refunds_amount
        FROM travel_bookings b
        WHERE b.issue_date = ? OR DATE(b.created_at) = ?
      `).get(today, today, today, today) || todayFinancial;
    } catch (err) {
      console.error("Error fetching today financial:", err);
    }

    // 7. Active Safe Balance
    let safes: any[] = [];
    try {
      safes = db.prepare("SELECT * FROM safes WHERE active = 1").all();
    } catch (err) {
      console.error("Error fetching safes:", err);
    }

    res.json({
      date: today,
      flights: todayFlights,
      hotels: todayHotels,
      transports: todayTransports,
      visas: todayVisas,
      tasks: todayTasks,
      financial: todayFinancial,
      safes
    });
  } catch (e: any) {
    console.error("Critical error in /travel/daily-operations:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;

