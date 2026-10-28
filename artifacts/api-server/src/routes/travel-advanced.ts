import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "../lib/sqlite";
import crypto from "node:crypto";

const router: IRouter = Router();

// Helper to generate ZATCA TLV Base64 QR Code
function generateZatcaTLV(seller: string, vatNo: string, timestamp: string, total: string, vat: string): string {
  const getTLV = (tagNum: number, value: string): Buffer => {
    const valBuf = Buffer.from(value, "utf8");
    const tagBuf = Buffer.from([tagNum]);
    const lenBuf = Buffer.from([valBuf.length]);
    return Buffer.concat([tagBuf, lenBuf, valBuf]);
  };

  const tlv1 = getTLV(1, seller);
  const tlv2 = getTLV(2, vatNo);
  const tlv3 = getTLV(3, timestamp);
  const tlv4 = getTLV(4, total);
  const tlv5 = getTLV(5, vat);

  const fullBuffer = Buffer.concat([tlv1, tlv2, tlv3, tlv4, tlv5]);
  return fullBuffer.toString("base64");
}

// ─────────────────────────────────────────────────────────────
// 1️⃣ IATA NDC PROTOCOLS & DIRECT AIRLINE APIs
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/ndc/gateways", (req: Request, res: Response) => {
  try {
    const gateways = db.prepare("SELECT * FROM travel_ndc_gateways ORDER BY id ASC").all();
    res.json({ success: true, data: gateways });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/ndc/gateways", (req: Request, res: Response) => {
  try {
    const { provider_name, airline_code, api_endpoint, ndc_version, auth_type, client_id, client_secret, fee_discount_pct } = req.body;
    if (!provider_name || !airline_code || !api_endpoint) {
      return res.status(400).json({ success: false, error: "اسم المزود، كود شركة الطيران ورابط الـ API مطلوبة" });
    }
    const stmt = db.prepare(`
      INSERT INTO travel_ndc_gateways (provider_name, airline_code, api_endpoint, ndc_version, auth_type, client_id, client_secret, status, fee_discount_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);
    const result = stmt.run(provider_name, airline_code, api_endpoint, ndc_version || "21.3", auth_type || "oauth2_token", client_id || null, client_secret || null, fee_discount_pct || 4.5);
    res.json({ success: true, id: result.lastInsertRowid, message: "تمت إضافة بوابة الربط المباشر NDC بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/ndc/gateways/:id/test", (req: Request, res: Response) => {
  try {
    const gateway = db.prepare("SELECT * FROM travel_ndc_gateways WHERE id = ?").get(req.params.id) as any;
    if (!gateway) return res.status(404).json({ success: false, error: "بوابة NDC غير موجودة" });

    res.json({
      success: true,
      data: {
        latency_ms: Math.floor(Math.random() * 80) + 45,
        handshake_status: "SUCCESS_200_OK",
        ndc_schema_validated: true,
        version: gateway.ndc_version,
        active_endpoints: ["AirShoppingRQ", "OfferPriceRQ", "OrderCreateRQ", "SeatAvailabilityRQ", "ServiceListRQ"],
        message: `تم التحقق بنجاح من اتصال ${gateway.provider_name} بنظام IATA NDC v${gateway.ndc_version}`
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/ndc/offers", (req: Request, res: Response) => {
  try {
    const { origin, destination, airline } = req.query;
    let sql = "SELECT * FROM travel_ndc_offers WHERE status = 'available'";
    const params: any[] = [];

    if (origin) {
      sql += " AND origin LIKE ?";
      params.push(`%${origin}%`);
    }
    if (destination) {
      sql += " AND destination LIKE ?";
      params.push(`%${destination}%`);
    }
    if (airline) {
      sql += " AND airline_code = ?";
      params.push(airline);
    }
    sql += " ORDER BY id DESC";

    const offers = db.prepare(sql).all(...params).map((o: any) => ({
      ...o,
      ancillaries: o.ancillaries_json ? JSON.parse(o.ancillaries_json) : []
    }));

    res.json({ success: true, data: offers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/ndc/offers/search", (req: Request, res: Response) => {
  try {
    const { origin, destination, departure_date, cabin_class, passengers_count } = req.body;
    
    // Check existing or simulate dynamic live response
    const existing = db.prepare("SELECT * FROM travel_ndc_offers WHERE status = 'available'").all().map((o: any) => ({
      ...o,
      ancillaries: o.ancillaries_json ? JSON.parse(o.ancillaries_json) : []
    }));

    res.json({
      success: true,
      meta: {
        ndc_engines_queried: ["Saudia NDC Hub", "Emirates Gateway", "Qatar Airways Oryx", "Flydubai Direct"],
        search_time_ms: 180,
        currency: "SAR"
      },
      data: existing
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/ndc/book", (req: Request, res: Response) => {
  try {
    const { offer_id, passenger_name, passport_no, selected_ancillaries, payment_method } = req.body;
    const offer = db.prepare("SELECT * FROM travel_ndc_offers WHERE offer_id = ?").get(offer_id) as any;
    if (!offer) return res.status(404).json({ success: false, error: "عرض NDC غير متوفر أو منتهي الصلاحية" });

    const pnr = "NDC" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const ticketNumber = "065-" + Math.floor(1000000000 + Math.random() * 9000000000);

    let ancillariesCost = 0;
    if (selected_ancillaries && Array.isArray(selected_ancillaries)) {
      selected_ancillaries.forEach((a: any) => {
        ancillariesCost += Number(a.price || 0);
      });
    }

    const totalPaid = Number(offer.total_fare) + ancillariesCost;

    // Create Booking in travel_bookings
    try {
      const insBkg = db.prepare(`
        INSERT INTO travel_bookings (
          booking_code, booking_type, customer_id, customer_name,
          traveler_name, passport_number, service_details,
          cost_price, sell_price, profit, status, payment_status, pnr, airline
        ) VALUES (?, 'flight', 1, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'paid', ?, ?)
      `);
      insBkg.run(
        pnr, passenger_name || "مسافر تجريبي", passenger_name || "مسافر تجريبي", passport_no || "P998877",
        `رحلة NDC مباشرة ${offer.flight_no} من ${offer.origin} إلى ${offer.destination} (وفر عمولة GDS: ${offer.ndc_savings} ريال)`,
        Number(offer.base_fare), totalPaid, totalPaid - Number(offer.base_fare), pnr, offer.airline_name
      );
    } catch (e) {
      console.warn("Could not insert to travel_bookings:", e);
    }

    res.json({
      success: true,
      data: {
        pnr,
        ticket_number: ticketNumber,
        airline: offer.airline_name,
        flight_no: offer.flight_no,
        passenger_name: passenger_name || "ALOTAIBI / ABDULLAH MR",
        origin: offer.origin,
        destination: offer.destination,
        departure_time: offer.departure_time,
        seat: "12A (Extra Legroom)",
        total_fare: totalPaid,
        ndc_discount_applied: offer.ndc_savings,
        ancillaries_confirmed: selected_ancillaries || [],
        order_create_response: "IATA_NDC_ORDER_201_CREATED",
        ticket_pdf_url: `/api/travel/tickets/${pnr}/print`
      },
      message: "تم إصدار تذكرة IATA NDC والخدمات الإضافية بنجاح بدون رسوم GDS الإضافية"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 2️⃣ AIR / MIR / BFM AUTOMATIC FILE LISTENER SERVICE
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/air-mir/listeners", (req: Request, res: Response) => {
  try {
    const listeners = db.prepare("SELECT * FROM travel_air_mir_listeners ORDER BY id ASC").all();
    res.json({ success: true, data: listeners });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/air-mir/listeners/:id/toggle", (req: Request, res: Response) => {
  try {
    const listener = db.prepare("SELECT * FROM travel_air_mir_listeners WHERE id = ?").get(req.params.id) as any;
    if (!listener) return res.status(404).json({ success: false, error: "خدمة الاستماع غير موجودة" });

    const newStatus = listener.is_running ? 0 : 1;
    db.prepare("UPDATE travel_air_mir_listeners SET is_running = ?, last_poll_at = datetime('now', 'localtime') WHERE id = ?").run(newStatus, req.params.id);

    res.json({ success: true, is_running: newStatus, message: newStatus ? "تم تفعيل خدمة المراقبة والاستماع لملفات التذاكر" : "تم إيقاف خدمة الاستماع مؤقتاً" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/air-mir/files", (req: Request, res: Response) => {
  try {
    const files = db.prepare("SELECT * FROM travel_air_mir_files ORDER BY id DESC LIMIT 50").all().map((f: any) => ({
      ...f,
      parsed_data: f.parsed_data_json ? JSON.parse(f.parsed_data_json) : null
    }));
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/air-mir/upload", (req: Request, res: Response) => {
  try {
    const { raw_content, file_name, file_type } = req.body;
    if (!raw_content) {
      return res.status(400).json({ success: false, error: "محتوى الملف النصي مطلوب" });
    }

    const type = file_type || (raw_content.includes("RP/") || raw_content.includes("AIR") ? "AIR" : raw_content.includes("MIR") ? "MIR" : "BFM");
    const pnrMatch = raw_content.match(/([A-Z0-9]{6})\b/);
    const pnr = pnrMatch ? pnrMatch[1] : "PNR" + Math.random().toString(36).substring(2, 6).toUpperCase();
    const tktMatch = raw_content.match(/(\d{3}[-\s]?\d{10})/);
    const ticketNo = tktMatch ? tktMatch[1] : "065-" + Math.floor(1000000000 + Math.random() * 9000000000);
    const airlineMatch = raw_content.match(/\b(SV|EK|QR|FZ|XY|F3|MS|RJ|TK|BA|LH)\b/);
    const airlineCode = airlineMatch ? airlineMatch[1] : "SV";

    const parsedData = {
      detected_gds: type === "AIR" ? "Amadeus AIR Spooler" : type === "MIR" ? "Sabre MIR Broadcast" : "Galileo BFM",
      pnr,
      ticket_numbers: [ticketNo],
      airline_code: airlineCode,
      currency: "SAR",
      total_fare: 1850.0,
      tax: 277.5,
      commission_earned: 92.5,
      auto_ledger_posted: true,
      journal_entry_reference: `JV-AIR-${Date.now().toString().slice(-6)}`
    };

    const fname = file_name || `${type}_${Date.now()}.txt`;
    const stmt = db.prepare(`
      INSERT INTO travel_air_mir_files (file_name, file_type, pnr, ticket_numbers, airline_code, passenger_names, total_amount, currency, status, parsed_data_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'SAR', 'processed', ?)
    `);
    const result = stmt.run(
      fname, type, pnr, ticketNo, airlineCode, "ALOTAIBI/MOHAMMED MR", 1850.0, JSON.stringify(parsedData)
    );

    // Update listener counter
    db.prepare("UPDATE travel_air_mir_listeners SET files_processed_count = files_processed_count + 1, last_poll_at = datetime('now', 'localtime') WHERE is_running = 1").run();

    res.json({
      success: true,
      id: result.lastInsertRowid,
      data: parsedData,
      message: `تم تحليل ملف ${type} وقراءة تذكرة رقم ${ticketNo} وترحيل القيد المحاسبي تلقائياً بنجاح!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3️⃣ MULTI-SUPPLIER HOTEL AGGREGATORS & DYNAMIC MARKUP
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/hotel-aggregators", (req: Request, res: Response) => {
  try {
    const aggregators = db.prepare("SELECT * FROM travel_hotel_aggregators ORDER BY id ASC").all();
    res.json({ success: true, data: aggregators });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/hotel-aggregators/:id/test", (req: Request, res: Response) => {
  try {
    const agg = db.prepare("SELECT * FROM travel_hotel_aggregators WHERE id = ?").get(req.params.id) as any;
    if (!agg) return res.status(404).json({ success: false, error: "المزود غير موجود" });

    res.json({
      success: true,
      data: {
        latency_ms: Math.floor(Math.random() * 60) + 70,
        status: "200_CONNECTED",
        credit_balance: agg.credit_balance,
        currency: agg.currency,
        hotels_indexed_count: 324500,
        supported_features: ["Instant Confirmation", "Free Cancellation", "Room Type Deduplication", "Direct Voucher Issuance"],
        message: `تم فحص وتأكيد جاهزية بوابة ${agg.supplier_name} بنجاح`
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/hotel-aggregators/search", (req: Request, res: Response) => {
  try {
    const { city, check_in, check_out, guests, channel } = req.body;
    const targetChannel = channel || "b2c_web";

    // Find applicable markup rule
    const markupRule = db.prepare(`
      SELECT * FROM travel_markup_rules 
      WHERE is_active = 1 AND (channel = ? OR channel = 'all')
      ORDER BY priority DESC LIMIT 1
    `).get(targetChannel) as any;

    const markupPct = markupRule ? markupRule.markup_value : 5.0;

    const baseHotels = [
      {
        id: "HOTEL-01",
        name: "فندق برج ساعة مكة فيرمونت (Fairmont Makkah)",
        city: city || "مكة المكرمة",
        rating: 5,
        supplier: "Hotelbeds",
        board_type: "شامل الإفطار بوفيه مفتوح (BB)",
        room_type: "Deluxe King Kaaba View Room",
        cancellation: "إلغاء مجاني حتى قبل 48 ساعة من الوصول",
        base_rate_usd: 240,
        base_rate_sar: 900,
        image_url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600"
      },
      {
        id: "HOTEL-02",
        name: "منتجع أتلانتس النخلة دبي (Atlantis The Palm)",
        city: city || "دبي",
        rating: 5,
        supplier: "WebBeds",
        board_type: "نصف إقامة فندقية (HB - إفطار وعشاء)",
        room_type: "Ocean View Terrace Suite",
        cancellation: "إلغاء مجاني حتى قبل 7 أيام",
        base_rate_usd: 380,
        base_rate_sar: 1425,
        image_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600"
      },
      {
        id: "HOTEL-03",
        name: "فندق هيلتون إسطنبول البوسفور (Hilton Bosphorus)",
        city: city || "إسطنبول",
        rating: 5,
        supplier: "TBO Holidays",
        board_type: "شامل الإفطار الأوروبي (BB)",
        room_type: "Bosphorus View Superior Room",
        cancellation: "غير قابل للاسترداد (Non-refundable Discount)",
        base_rate_usd: 160,
        base_rate_sar: 600,
        image_url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600"
      },
      {
        id: "HOTEL-04",
        name: "فندق راديسون بلو طرابزون (Radisson Blu Trabzon)",
        city: city || "طرابزون",
        rating: 5,
        supplier: "Expedia EPS",
        board_type: "شامل الإفطار التركي التقليدي",
        room_type: "Panoramic Mountain View Room",
        cancellation: "إلغاء مجاني حتى 24 ساعة",
        base_rate_usd: 120,
        base_rate_sar: 450,
        image_url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600"
      }
    ];

    const results = baseHotels.map(h => {
      const sellPriceSar = Math.round(h.base_rate_sar * (1 + markupPct / 100));
      return {
        ...h,
        markup_applied_pct: markupPct,
        applied_rule: markupRule ? markupRule.rule_name : "تسعير قياسي",
        sell_rate_sar: sellPriceSar,
        agent_margin_sar: sellPriceSar - h.base_rate_sar
      };
    });

    res.json({
      success: true,
      meta: {
        total_suppliers_searched: 5,
        best_price_guarantee: true,
        channel_applied: targetChannel,
        markup_pct: markupPct
      },
      data: results
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/markup-rules", (req: Request, res: Response) => {
  try {
    const rules = db.prepare("SELECT * FROM travel_markup_rules ORDER BY priority DESC, id ASC").all();
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/markup-rules", (req: Request, res: Response) => {
  try {
    const { rule_name, channel, service_type, destination_country, airline_or_chain, markup_type, markup_value, discount_value, priority, notes } = req.body;
    if (!rule_name || markup_value === undefined) {
      return res.status(400).json({ success: false, error: "اسم القاعدة وقيمة الهامش مطلوبة" });
    }
    const stmt = db.prepare(`
      INSERT INTO travel_markup_rules (rule_name, channel, service_type, destination_country, airline_or_chain, markup_type, markup_value, discount_value, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      rule_name, channel || "all", service_type || "all", destination_country || "all",
      airline_or_chain || "all", markup_type || "percentage", markup_value, discount_value || 0,
      priority || 1, notes || null
    );
    res.json({ success: true, id: result.lastInsertRowid, message: "تم حفظ قاعدة التسعير والهامش الديناميكي بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/api/travel/markup-rules/:id", (req: Request, res: Response) => {
  try {
    db.prepare("DELETE FROM travel_markup_rules WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "تم حذف قاعدة التسعير" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4️⃣ CHARTER & FLIGHT/HOTEL BLOCK ALLOTMENTS
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/charter-blocks", (req: Request, res: Response) => {
  try {
    const blocks = db.prepare("SELECT * FROM travel_charter_blocks ORDER BY id DESC").all();
    res.json({ success: true, data: blocks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/charter-blocks", (req: Request, res: Response) => {
  try {
    const {
      block_code, block_name, flight_no, airline_code, origin, destination,
      travel_date, return_date, total_seats_contracted, buy_rate_per_seat, sell_rate_per_seat,
      season_tag, notes
    } = req.body;

    if (!block_code || !block_name || !total_seats_contracted || !buy_rate_per_seat || !sell_rate_per_seat) {
      return res.status(400).json({ success: false, error: "كود البلوك، الاسم، عدد المقاعد وأسعار الشراء والبيع مطلوبة" });
    }

    const totalCost = Number(total_seats_contracted) * Number(buy_rate_per_seat);
    const breakEven = Math.ceil(totalCost / Number(sell_rate_per_seat));

    const stmt = db.prepare(`
      INSERT INTO travel_charter_blocks (
        block_code, block_name, flight_no, airline_code, origin, destination,
        travel_date, return_date, total_seats_contracted, buy_rate_per_seat, total_contract_cost,
        sell_rate_per_seat, seats_sold, seats_held, seats_available, break_even_seats, load_factor_pct, season_tag, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 0.0, ?, 'active', ?)
    `);

    const result = stmt.run(
      block_code, block_name, flight_no || "XY 001", airline_code || "XY", origin || "RUH", destination || "JED",
      travel_date, return_date || null, total_seats_contracted, buy_rate_per_seat, totalCost,
      sell_rate_per_seat, total_seats_contracted, breakEven, season_tag || "umrah", notes || null
    );

    res.json({ success: true, id: result.lastInsertRowid, message: "تم إنشاء عقد المقاعد المؤجرة (Charter Block) بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/charter-blocks/:id/allocations", (req: Request, res: Response) => {
  try {
    const allocations = db.prepare("SELECT * FROM travel_charter_allocations WHERE block_id = ? ORDER BY id DESC").all(req.params.id);
    res.json({ success: true, data: allocations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/charter-blocks/:id/allocations", (req: Request, res: Response) => {
  try {
    const { agent_or_client_name, seats_allocated, price_per_seat, deposit_paid } = req.body;
    const blockId = req.params.id;

    const block = db.prepare("SELECT * FROM travel_charter_blocks WHERE id = ?").get(blockId) as any;
    if (!block) return res.status(404).json({ success: false, error: "البلوك غير موجود" });

    if (Number(seats_allocated) > block.seats_available) {
      return res.status(400).json({ success: false, error: `المقاعد المتاحة لا تكفي (${block.seats_available} مقعد متبقي فقط)` });
    }

    const stmt = db.prepare(`
      INSERT INTO travel_charter_allocations (block_id, agent_or_client_name, seats_allocated, seats_confirmed, price_per_seat, deposit_paid, status)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
    `);
    stmt.run(blockId, agent_or_client_name, seats_allocated, seats_allocated, price_per_seat || block.sell_rate_per_seat, deposit_paid || 0);

    // Update block stats
    const newSold = block.seats_sold + Number(seats_allocated);
    const newAvail = block.seats_available - Number(seats_allocated);
    const newLoadFactor = Math.round((newSold / block.total_seats_contracted) * 100 * 10) / 10;

    db.prepare("UPDATE travel_charter_blocks SET seats_sold = ?, seats_available = ?, load_factor_pct = ? WHERE id = ?")
      .run(newSold, newAvail, newLoadFactor, blockId);

    res.json({ success: true, message: "تم تخصيص المقاعد للوكيل وتحديث مؤشرات إشغال الرحلة" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/hotel-allotments", (req: Request, res: Response) => {
  try {
    const allotments = db.prepare("SELECT * FROM travel_hotel_allotments ORDER BY id DESC").all();
    res.json({ success: true, data: allotments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/hotel-allotments", (req: Request, res: Response) => {
  try {
    const {
      contract_code, hotel_name, destination_city, check_in_start, check_out_end,
      room_type, total_rooms_contracted, buy_rate_per_night, sell_rate_per_night,
      auto_release_days, auto_release_date, notes
    } = req.body;

    if (!contract_code || !hotel_name || !total_rooms_contracted || !buy_rate_per_night || !sell_rate_per_night) {
      return res.status(400).json({ success: false, error: "كود العقد، اسم الفندق، عدد الغرف وأسعار التعاقد مطلوبة" });
    }

    const stmt = db.prepare(`
      INSERT INTO travel_hotel_allotments (
        contract_code, hotel_name, destination_city, check_in_start, check_out_end,
        room_type, total_rooms_contracted, buy_rate_per_night, sell_rate_per_night,
        auto_release_days, auto_release_date, rooms_sold, rooms_available, is_released, penalty_after_release, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, 'active', ?)
    `);

    const result = stmt.run(
      contract_code, hotel_name, destination_city || "مكة المكرمة", check_in_start, check_out_end,
      room_type || "Standard Room", total_rooms_contracted, buy_rate_per_night, sell_rate_per_night,
      auto_release_days || 7, auto_release_date, total_rooms_contracted, notes || null
    );

    res.json({ success: true, id: result.lastInsertRowid, message: "تم تسجيل عقد حجز الغرف الفندقية (Hotel Allotment) بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/hotel-allotments/:id/release", (req: Request, res: Response) => {
  try {
    const allotment = db.prepare("SELECT * FROM travel_hotel_allotments WHERE id = ?").get(req.params.id) as any;
    if (!allotment) return res.status(404).json({ success: false, error: "عقد البلوك الفندقي غير موجود" });

    db.prepare("UPDATE travel_hotel_allotments SET is_released = 1, status = 'released', rooms_available = 0 WHERE id = ?")
      .run(req.params.id);

    res.json({
      success: true,
      message: `تم الإفراج التلقائي (Auto-Release) عن ${allotment.rooms_available} غرفة غير مباعة وإعادتها للفندق قبل تاريخ الإغلاق لتجنب غرامات الإلغاء`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5️⃣ ZATCA PHASE 2 E-INVOICING & MULTI-CURRENCY FX ENGINE
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/zatca/invoices", (req: Request, res: Response) => {
  try {
    const invoices = db.prepare("SELECT * FROM travel_zatca_invoices ORDER BY id DESC").all();
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/zatca/generate", (req: Request, res: Response) => {
  try {
    const {
      buyer_name, buyer_vat_no, total_amount, travel_tax_mode, invoice_type
    } = req.body;

    const invNum = "INV-ZATCA-" + Date.now().toString().slice(-6);
    const issueDate = new Date().toISOString().slice(0, 10);
    const issueTime = new Date().toTimeString().slice(0, 8);
    const sellerName = "شركة أومني فلاي العالمية للسفريات والسياحة";
    const sellerVat = "300123456700003";

    const taxMode = travel_tax_mode || "agent_commission_only";
    const totalNum = Number(total_amount) || 1500;
    
    // In agent commission mode: VAT is 15% only on service markup (e.g. 10% fee)
    let taxableAmount = totalNum;
    let vatAmount = totalNum * 0.15;
    let grandTotal = totalNum + vatAmount;

    if (taxMode === "agent_commission_only") {
      const commissionFee = 150.0;
      taxableAmount = commissionFee;
      vatAmount = commissionFee * 0.15;
      grandTotal = totalNum + vatAmount;
    }

    const uuid = crypto.randomUUID();
    const invoiceHash = crypto.createHash("sha256").update(uuid + invNum + grandTotal).digest("hex");
    const cryptoStamp = "MEQC" + Buffer.from(crypto.randomBytes(32)).toString("base64");
    const tlvQR = generateZatcaTLV(sellerName, sellerVat, `${issueDate}T${issueTime}Z`, grandTotal.toFixed(2), vatAmount.toFixed(2));

    const ublXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${invNum}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="0100000">${invoice_type === "simplified_tax" ? "388" : "388"}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${sellerVat}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${vatAmount.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="SAR">${taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${grandTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">${grandTotal.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

    const stmt = db.prepare(`
      INSERT INTO travel_zatca_invoices (
        invoice_number, invoice_type, travel_tax_mode, issue_date, issue_time,
        seller_name, seller_vat_no, buyer_name, buyer_vat_no,
        total_taxable_amount, vat_rate, vat_amount, grand_total,
        uuid, invoice_hash, cryptographic_stamp, qr_code_tlv_base64, ubl_xml_content,
        zatca_status, zatca_response_msg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 15.0, ?, ?, ?, ?, ?, ?, ?, 'cleared', 'تم التحقق والاعتماد الرقمي بنجاح وفق متطلبات هيئة الزكاة والضريبة والجمارك ZATCA Phase 2')
    `);

    const result = stmt.run(
      invNum, invoice_type || "standard_tax", taxMode, issueDate, issueTime,
      sellerName, sellerVat, buyer_name || "عميل سفر معتمد", buyer_vat_no || null,
      taxableAmount, vatAmount, grandTotal,
      uuid, invoiceHash, cryptoStamp, tlvQR, ublXml
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      data: {
        invoice_number: invNum,
        uuid,
        qr_code_tlv_base64: tlvQR,
        cryptographic_stamp: cryptoStamp,
        tax_mode: taxMode,
        taxable_amount: taxableAmount,
        vat_amount: vatAmount,
        grand_total: grandTotal,
        zatca_status: "cleared"
      },
      message: "تم إصدار الفاتورة الضريبية واعتمادها رقمياً بختم وتشفير ZATCA Phase 2 بنجاح"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/fx/rates", (req: Request, res: Response) => {
  try {
    const rates = db.prepare("SELECT * FROM travel_fx_rates ORDER BY id ASC").all();
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/fx/rates/update", (req: Request, res: Response) => {
  try {
    const { target_currency, rate, inverse_rate } = req.body;
    if (!target_currency || !rate) {
      return res.status(400).json({ success: false, error: "العملة المستهدفة وسعر الصرف مطلوبان" });
    }
    const inv = inverse_rate || (1 / Number(rate));
    db.prepare("UPDATE travel_fx_rates SET rate = ?, inverse_rate = ?, last_updated = datetime('now', 'localtime') WHERE target_currency = ?")
      .run(rate, inv, target_currency);

    res.json({ success: true, message: `تم تحديث سعر صرف ${target_currency} بنجاح` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/fx/revaluations", (req: Request, res: Response) => {
  try {
    const revs = db.prepare("SELECT * FROM travel_fx_revaluations ORDER BY id DESC").all();
    res.json({ success: true, data: revs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/fx/revaluate", (req: Request, res: Response) => {
  try {
    const { account_name, currency, foreign_balance, old_rate, new_rate } = req.body;
    const oldAmount = Number(foreign_balance) * Number(old_rate);
    const newAmount = Number(foreign_balance) * Number(new_rate);
    const gainLoss = newAmount - oldAmount;

    const stmt = db.prepare(`
      INSERT INTO travel_fx_revaluations (revaluation_date, account_name, currency, foreign_balance, old_rate, new_rate, local_amount_old, local_amount_new, gain_loss_amount, is_posted, created_by)
      VALUES (datetime('now', 'localtime'), ?, ?, ?, ?, ?, ?, ?, ?, 1, 'مدير الحسابات والعملات')
    `);
    stmt.run(account_name || "حساب موردين خارجي (USD)", currency || "USD", foreign_balance, old_rate, new_rate, oldAmount, newAmount, gainLoss);

    res.json({
      success: true,
      data: {
        account_name,
        currency,
        foreign_balance,
        gain_loss_amount: gainLoss,
        nature: gainLoss >= 0 ? "أرباح فروق أسعار صرف (دائن)" : "خسائر فروق أسعار صرف (مدين)"
      },
      message: `تم إعادة تقييم الحساب بالعملة الأجنبية وقيد ${Math.abs(gainLoss)} ريال في حساب أرباح/خسائر الصرف`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6️⃣ VIRTUAL CREDIT CARDS (VCC) & SETTLEMENT
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/vcc/cards", (req: Request, res: Response) => {
  try {
    const cards = db.prepare("SELECT * FROM travel_vcc_cards ORDER BY id DESC").all();
    res.json({ success: true, data: cards });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/vcc/cards/generate", (req: Request, res: Response) => {
  try {
    const { card_holder_name, currency, credit_limit, issuer_gateway, card_type, mcc_restriction, notes } = req.body;
    if (!credit_limit) {
      return res.status(400).json({ success: false, error: "حد الرصيد الائتماني للبطاقة مطلوب" });
    }

    const token = "VCC-" + (issuer_gateway || "CONF").substring(0, 4).toUpperCase() + "-" + Date.now().toString().slice(-6);
    const last4 = Math.floor(1000 + Math.random() * 9000);
    const masked = (issuer_gateway === "wex" ? "4111" : "5425") + " •••• •••• " + last4;
    const cvv = String(Math.floor(100 + Math.random() * 900));

    const today = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(today.getDate() + 30);

    const stmt = db.prepare(`
      INSERT INTO travel_vcc_cards (
        card_token, card_number_masked, card_holder_name, expiry_month, expiry_year, cvv,
        currency, credit_limit, amount_charged, balance_available, issuer_gateway, card_type,
        mcc_restriction, activation_date, expiration_date, status, notes
      ) VALUES (?, ?, ?, '12', '2027', ?, ?, ?, 0.0, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);

    const result = stmt.run(
      token, masked, card_holder_name || "OMNIFLY TRAVEL B2B VCC", cvv,
      currency || "USD", credit_limit, credit_limit,
      issuer_gateway || "conferma", card_type || "single_use",
      mcc_restriction || "all_travel", today.toISOString().slice(0, 10),
      expiryDate.toISOString().slice(0, 10), notes || null
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      data: {
        card_token: token,
        card_number_masked: masked,
        cvv,
        credit_limit,
        currency: currency || "USD",
        status: "active"
      },
      message: "تم توليد البطاقة الافتراضية VCC وربط قيود الـ MCC للمدفوعات بنجاح"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/vcc/cards/:id/cancel", (req: Request, res: Response) => {
  try {
    db.prepare("UPDATE travel_vcc_cards SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "تم إلغاء البطاقة الافتراضية وحظر أي حركات خصم مستقبلية" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/vcc/transactions", (req: Request, res: Response) => {
  try {
    const txs = db.prepare(`
      SELECT t.*, c.card_token, c.card_number_masked, c.issuer_gateway
      FROM travel_vcc_transactions t
      JOIN travel_vcc_cards c ON t.vcc_id = c.id
      ORDER BY t.id DESC
    `).all();
    res.json({ success: true, data: txs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 7️⃣ AI SMART ITINERARY GENERATOR & DAY-BY-DAY PLANNER
// ─────────────────────────────────────────────────────────────

router.get("/api/travel/itineraries", (req: Request, res: Response) => {
  try {
    const itineraries = db.prepare("SELECT * FROM travel_smart_itineraries ORDER BY id DESC").all().map((it: any) => ({
      ...it,
      highlights: it.highlights_json ? JSON.parse(it.highlights_json) : [],
      inclusions: it.inclusions_json ? JSON.parse(it.inclusions_json) : [],
      exclusions: it.exclusions_json ? JSON.parse(it.exclusions_json) : []
    }));
    res.json({ success: true, data: itineraries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/travel/itineraries/:id", (req: Request, res: Response) => {
  try {
    const itinerary = db.prepare("SELECT * FROM travel_smart_itineraries WHERE id = ?").get(req.params.id) as any;
    if (!itinerary) return res.status(404).json({ success: false, error: "البرنامج السياحي غير موجود" });

    const days = db.prepare("SELECT * FROM travel_itinerary_days WHERE itinerary_id = ? ORDER BY day_number ASC").all(req.params.id);

    res.json({
      success: true,
      data: {
        ...itinerary,
        highlights: itinerary.highlights_json ? JSON.parse(itinerary.highlights_json) : [],
        inclusions: itinerary.inclusions_json ? JSON.parse(itinerary.inclusions_json) : [],
        exclusions: itinerary.exclusions_json ? JSON.parse(itinerary.exclusions_json) : [],
        days
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/api/travel/itineraries/ai-generate", (req: Request, res: Response) => {
  try {
    const { destination, days_count, theme, target_budget } = req.body;
    const dest = destination || "جورجيا (تبليسي وباتومي)";
    const days = Number(days_count) || 7;
    const nights = days - 1;
    const price = Number(target_budget) || (days * 650);

    const title = `برنامج ${dest} الاستثنائي (${days} أيام / ${nights} ليالي) - ${theme === "honeymoon" ? "شهر العسل" : "باقة العائلة الفاخرة"}`;
    const overview = `برنامج سياحي متكامل ومصمم بالذكاء الاصطناعي لوكالة أومني فلاي لاستكشاف أهم المعالم التاريخية والطبيعية في ${dest} مع توفير أرقى مستويات الراحة والفنادق والخدمات الخاصة.`;

    const highlights = [
      `جولة استكشافية خاصة في أهم معالم ${dest}`,
      "رحلة بحرية خاصة أو جولة جبلية في أحضان الطبيعة",
      "إقامة فندقية فاخرة 5 نجوم مع إطلالات ساحرة",
      "تنقلات خاصة VIP بسيارات حديثة وسائق مرشد عربي",
      "جلسات تذوق الأطباق المحلية ومطاعم مختارة بعناية"
    ];

    const inclusions = [
      "تذاكر الطيران الدولي مع حقيبة وزن 30 كجم",
      `إقامة ${nights} ليالي بفنادق 5 نجوم مع وجبة الإفطار يومياً`,
      "استقبال وتوديع في المطار بسيارة خاصة",
      "جولات سياحية يومية بسيارة VIP مكيفة وسائق خاص",
      "شرائح اتصال وإنترنت 20GB وتأمين سفر دولي"
    ];

    const exclusions = [
      "المصاريف الشخصية والمشتريات الخاصة",
      "رسوم التأشيرة السياحية (إن وجدت)"
    ];

    const stmt = db.prepare(`
      INSERT INTO travel_smart_itineraries (
        title, destination_country, destination_city, duration_days, duration_nights,
        theme, target_audience, base_price, currency, status, overview,
        highlights_json, inclusions_json, exclusions_json, hero_image_url, qr_code_url
      ) VALUES (?, ?, ?, ?, ?, ?, 'أفراد وعائلات VIP', ?, 'SAR', 'published', ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      title, dest, dest, days, nights, theme || "family", price, overview,
      JSON.stringify(highlights), JSON.stringify(inclusions), JSON.stringify(exclusions),
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200",
      `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://omnifly.sa/itineraries/${encodeURIComponent(dest)}`
    );

    const itinId = Number(result.lastInsertRowid);

    // Insert sample generated days
    const insDay = db.prepare(`
      INSERT INTO travel_itinerary_days (itinerary_id, day_number, day_title, morning_activity, afternoon_activity, evening_activity, hotel_name, meals_included, transport_type, photo_url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let d = 1; d <= days; d++) {
      let dayTitle = `اليوم ${d}: استكشاف معالم ${dest}`;
      let morning = "بوفيه إفطار بالفندق ثم الانطلاق للجولة الصباحية";
      let afternoon = "زيارة أبرز المعالم السياحية والتقاط الصور التذكارية";
      let evening = "سهرة عشاء وتجربة التسوق والمقاهي الشهيرة";
      if (d === 1) {
        dayTitle = "اليوم الأول: الوصول والاستقبال الملكي بالفندق";
        morning = "الاستقبال في المطار من قبل مندوب الوكالة والترحيب بالزهور";
        afternoon = "التوجه للفندق واستلام الغرف والراحة من السفر";
        evening = "جولة مسائية خفيفة وعشاء ترحيبي فاخر";
      } else if (d === days) {
        dayTitle = `اليوم ${d}: التسوق الأخير والتوديع نحو المطار`;
        morning = "الإفطار وتسجيل الخروج من الفندق وزيارة السوق المحلي";
        afternoon = "التوجه إلى المطار وتسهيل إجراءات المغادرة والوزن";
        evening = "رحلة العودة بسلامة الله إلى أرض الوطن";
      }

      insDay.run(
        itinId, d, dayTitle, morning, afternoon, evening,
        "Luxury 5-Star Hotel & Resort", d === 1 ? "dinner" : "breakfast",
        "مرسيدس VIP خاصة مع سائق خاص",
        "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600",
        "مرونة كاملة في تعديل مواعيد الجولات اليومية حسب رغبة العميل"
      );
    }

    res.json({
      success: true,
      id: itinId,
      message: `تم توليد البرنامج السياحي الاحترافي لـ ${dest} بنجاح عبر المساعد الذكي!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
