import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

// ============================================================================
// ATB THERMAL TICKET & BOARDING PASS PRINTING API
// ============================================================================

// 1. Get print templates
router.get("/travel/atb/templates", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_atb_print_templates ORDER BY id ASC").all();
  res.json(rows);
});

// 2. Save / Update ATB print template
router.post("/travel/atb/templates", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    template_name, layout_format = "atb_standard_2part", header_text, barcode_symbology = "PDF417",
    show_magnetic_stripe_sim = 1, show_baggage_stub = 1, show_seat_gate_box = 1,
    show_fare_breakdown = 1, disclaimer_text, is_default = 0
  } = req.body;

  if (!template_name) {
    res.status(400).json({ error: "اسم القالب مطلوب" });
    return;
  }

  const ins = db.prepare(`
    INSERT INTO travel_atb_print_templates (
      template_name, layout_format, header_text, barcode_symbology,
      show_magnetic_stripe_sim, show_baggage_stub, show_seat_gate_box,
      show_fare_breakdown, disclaimer_text, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const r = ins.run(
    template_name, layout_format, header_text || "BOARDING PASS", barcode_symbology,
    show_magnetic_stripe_sim ? 1 : 0, show_baggage_stub ? 1 : 0,
    show_seat_gate_box ? 1 : 0, show_fare_breakdown ? 1 : 0,
    disclaimer_text || null, is_default ? 1 : 0
  );

  const tpl = db.prepare("SELECT * FROM travel_atb_print_templates WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(tpl);
});

// 3. Get complete printable data for a specific booking / boarding pass
router.get("/travel/atb/render-data/:bookingId", (req, res) => {
  const booking = db.prepare(`
    SELECT b.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number, p.nationality,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.id = ?
  `).get(req.params.bookingId) as any;

  if (!booking) {
    res.status(404).json({ error: "بيانات الحجز غير موجودة" });
    return;
  }

  // Generate realistic IATA ATB Boarding Pass data
  const passData = {
    airline_name: booking.airline_supplier || "الخطوط السعودية (Saudia)",
    airline_code: booking.airline_supplier.includes("Saudia") || booking.airline_supplier.includes("سعودية") ? "SV" : "EK",
    passenger_name: (booking.passenger_name_en || booking.passenger_name_ar || "ALOTAIBI/ABDULLAH MR").toUpperCase(),
    eticket_number: booking.ticket_number || "065-2415896321",
    pnr: booking.pnr || "PNR-X78Y90",
    flight_number: booking.flight_number || "SV 112",
    booking_class: "Y",
    origin_code: booking.origin_city?.match(/\((.*?)\)/)?.[1] || "RUH",
    origin_name: booking.origin_city || "الرياض - King Khalid Intl",
    destination_code: booking.destination_city?.match(/\((.*?)\)/)?.[1] || "DXB",
    destination_name: booking.destination_city || "دبي - Dubai Intl",
    departure_date: booking.departure_date || "2026-09-10",
    boarding_time: "07:30",
    departure_time: "08:15",
    gate: "14B",
    seat: "12A",
    group: "GROUP 2",
    sequence_number: "048",
    frequent_flyer_number: "SV-88992211 (Alfursan Gold)",
    baggage_allowance: "1 PC / 23 KG",
    barcode_string: `M1${(booking.passenger_name_en || "ALOTAIBI/ABDULLAH MR").toUpperCase().padEnd(20)}E${booking.pnr || "6X9ZKL"} RUHDXB SV 0112 253Y012A0048 100`,
    disclaimer: "Gate closes 15 minutes before departure. Please be present at boarding gate with valid passport."
  };

  res.json(passData);
});

export default router;
