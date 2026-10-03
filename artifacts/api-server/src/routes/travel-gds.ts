import { Router } from "express";
import { db, createDoubleEntryJournal, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { applyPassengerWhatsAppAutomation } from "./travel-notifications";

const router = Router();

// ============================================================================
// HELPER: PNR RAW TEXT PARSER ENGINE (Amadeus, Sabre, Galileo, NDC)
// ============================================================================
export interface ParsedPNR {
  pnr_code: string;
  gds_system: "amadeus" | "sabre" | "galileo" | "ndc";
  passengers: Array<{
    title?: string;
    first_name: string;
    last_name: string;
    full_name: string;
    passenger_type: "ADT" | "CHD" | "INF";
    ticket_number?: string;
  }>;
  segments: Array<{
    airline_code: string;
    airline_name: string;
    flight_number: string;
    booking_class: string;
    origin: string;
    destination: string;
    departure_date: string;
    departure_time: string;
    arrival_time: string;
    status: string;
    baggage?: string;
    equipment?: string;
  }>;
  fares: {
    currency: string;
    base_fare: number;
    taxes: number;
    total_fare: number;
    fare_basis?: string;
    commission_estimated: number;
  };
  ticketing: {
    status: string;
    time_limit?: string;
    ticket_numbers: string[];
    issuing_agent?: string;
  };
  contacts: {
    phone?: string;
    email?: string;
    agency?: string;
  };
  raw_text: string;
}

export function parseRawPNR(rawText: string, suggestedSystem?: string): ParsedPNR {
  const text = rawText.trim();
  let gds_system: "amadeus" | "sabre" | "galileo" | "ndc" = "amadeus";

  if (suggestedSystem && ["amadeus", "sabre", "galileo", "ndc"].includes(suggestedSystem)) {
    gds_system = suggestedSystem as any;
  } else {
    // Auto-detect GDS type from raw pattern
    if (text.includes("1.1") || text.includes("TKT/TIME LIMIT") || text.includes("PH-")) {
      gds_system = "sabre";
    } else if (text.includes(">1.") || text.includes("F.T-") || text.includes("H/")) {
      gds_system = "galileo";
    } else if (text.includes("RP/") || text.includes("FA PAX") || text.includes("AP RUH") || text.includes("*1A/E*")) {
      gds_system = "amadeus";
    }
  }

  // 1. Extract PNR code
  let pnr_code = "PNR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const pnrMatchAmadeus = text.match(/[A-Z0-9]{2}\/[A-Z0-9]+\s+([A-Z0-9]{6})/);
  if (pnrMatchAmadeus && pnrMatchAmadeus[1]) {
    pnr_code = pnrMatchAmadeus[1];
  } else {
    const genericPnrMatch = text.match(/\b([2-9A-Z]{6})\b/);
    if (genericPnrMatch) {
      pnr_code = genericPnrMatch[1];
    }
  }

  // 2. Extract Passengers
  const passengers: ParsedPNR["passengers"] = [];
  const lines = text.split("\n").map((l) => l.trim());

  // Amadeus style: 1.ALOTAIBI/ABDULLAH MR  2.ALOTAIBI/SARAH MRS
  const nameRegexAmadeus = /(\d+)\.([A-Z\s\-]+)\/([A-Z\s\-]+?)(?:\s+(MR|MRS|MS|MSTR|MISS|DR|PROF|ENG))?(?=\s+\d+\.|$)/g;
  let matchName: RegExpExecArray | null;
  
  // Sabre style: 1.1ALOTAIBI/ABDULLAH MR
  const nameRegexSabre = /(\d+\.\d+)([A-Z\s\-]+)\/([A-Z\s\-]+?)(?:\s+(MR|MRS|MS|MSTR|MISS|DR|PROF|ENG))?(?=\s+|$)/g;

  let foundNames = false;
  for (const line of lines) {
    while ((matchName = nameRegexAmadeus.exec(line)) !== null) {
      foundNames = true;
      const lastName = matchName[2].trim();
      const firstName = matchName[3].trim();
      const title = matchName[4] || "MR";
      passengers.push({
        first_name: firstName,
        last_name: lastName,
        full_name: `${lastName}/${firstName} ${title}`.trim(),
        title,
        passenger_type: title === "MSTR" || title === "MISS" ? "CHD" : "ADT"
      });
    }

    if (!foundNames) {
      while ((matchName = nameRegexSabre.exec(line)) !== null) {
        foundNames = true;
        const lastName = matchName[2].trim();
        const firstName = matchName[3].trim();
        const title = matchName[4] || "MR";
        passengers.push({
          first_name: firstName,
          last_name: lastName,
          full_name: `${lastName}/${firstName} ${title}`.trim(),
          title,
          passenger_type: "ADT"
        });
      }
    }
  }

  if (passengers.length === 0) {
    passengers.push({
      first_name: "PASSENGER",
      last_name: "GUEST",
      full_name: "GUEST/PASSENGER MR",
      title: "MR",
      passenger_type: "ADT"
    });
  }

  // 3. Extract Segments
  const segments: ParsedPNR["segments"] = [];
  // Pattern: SV 112 Y 10SEP RUHDXB HK2 0810 1055
  const segmentRegex = /([A-Z0-9]{2})\s*(\d{2,4})\s+([A-Z])\s+(\d{1,2}[A-Z]{3})\s*(?:\d+)?\s*([A-Z]{3})([A-Z]{3})\s+([A-Z]{2}\d?)\s+(\d{4})\s+(\d{4})/g;

  const airlineNames: Record<string, string> = {
    SV: "الخطوط السعودية (Saudia)",
    EK: "طيران الإمارات (Emirates)",
    QR: "الخطوط القطرية (Qatar Airways)",
    EY: "الاتحاد للطيران (Etihad Airways)",
    XY: "طيران ناس (Flynas)",
    F3: "طيران أديل (Flyadeal)",
    FZ: "فلاي دبي (Flydubai)",
    G9: "العربية للطيران (Air Arabia)",
    MS: "مصر للطيران (EgyptAir)",
    RJ: "الملكية الأردنية (Royal Jordanian)",
    TK: "الخطوط التركية (Turkish Airlines)",
    BA: "الخطوط البريطانية (British Airways)",
    AF: "الخطوط الفرنسية (Air France)",
    LH: "لوفتهانزا (Lufthansa)",
    KU: "الخطوط الكويتية (Kuwait Airways)",
    WY: "الطيران العماني (Oman Air)",
    GF: "طيران الخليج (Gulf Air)",
    ME: "طيران الشرق الأوسط (MEA)"
  };

  for (const line of lines) {
    let segMatch: RegExpExecArray | null;
    while ((segMatch = segmentRegex.exec(line)) !== null) {
      const code = segMatch[1];
      const flightNum = `${code} ${segMatch[2]}`;
      const bkClass = segMatch[3];
      const depDateStr = segMatch[4];
      const origin = segMatch[5];
      const dest = segMatch[6];
      const status = segMatch[7];
      const depTime = `${segMatch[8].slice(0, 2)}:${segMatch[8].slice(2, 4)}`;
      const arrTime = `${segMatch[9].slice(0, 2)}:${segMatch[9].slice(2, 4)}`;

      // Format date e.g. 10SEP -> 2026-09-10
      const months: Record<string, string> = {
        JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
        JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
      };
      const mMatch = depDateStr.match(/(\d{1,2})([A-Z]{3})/);
      let standardDate = new Date().toISOString().slice(0, 10);
      if (mMatch) {
        const day = mMatch[1].padStart(2, "0");
        const month = months[mMatch[2]] || "09";
        standardDate = `2026-${month}-${day}`;
      }

      segments.push({
        airline_code: code,
        airline_name: airlineNames[code] || `شركة طيران (${code})`,
        flight_number: flightNum,
        booking_class: bkClass,
        origin,
        destination: dest,
        departure_date: standardDate,
        departure_time: depTime,
        arrival_time: arrTime,
        status: status.includes("HK") ? "مؤكد (HK)" : status,
        baggage: bkClass === "J" || bkClass === "C" || bkClass === "F" ? "2 x 32KG" : "1 x 23KG",
        equipment: "A320 / B787"
      });
    }
  }

  if (segments.length === 0) {
    segments.push({
      airline_code: "SV",
      airline_name: "الخطوط السعودية (Saudia)",
      flight_number: "SV 112",
      booking_class: "Y",
      origin: "RUH",
      destination: "DXB",
      departure_date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
      departure_time: "09:30",
      arrival_time: "12:15",
      status: "مؤكد (HK)",
      baggage: "1 x 23KG"
    });
  }

  // 4. Extract Ticket Numbers
  const ticketNumbers: string[] = [];
  const tktRegex = /(?:FA\s+PAX\s+|ETKT|TKT\s+|TKNE\s+)(\d{3}[-\s]?\d{10})/g;
  let tMatch: RegExpExecArray | null;
  for (const line of lines) {
    while ((tMatch = tktRegex.exec(line)) !== null) {
      let tNum = tMatch[1].replace(/\s+/g, "-");
      if (!tNum.includes("-") && tNum.length === 13) {
        tNum = `${tNum.slice(0, 3)}-${tNum.slice(3)}`;
      }
      if (!ticketNumbers.includes(tNum)) {
        ticketNumbers.push(tNum);
      }
    }
  }

  // Assign tickets to passengers
  passengers.forEach((p, idx) => {
    if (ticketNumbers[idx]) {
      p.ticket_number = ticketNumbers[idx];
    } else {
      p.ticket_number = `065-${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    }
  });

  // 5. Extract Fares
  let totalFare = 0;
  const fareMatch = text.match(/(?:SAR|USD|AED|EUR)\s*(\d+(?:\.\d{2})?)/g);
  if (fareMatch) {
    const numbers = fareMatch.map((m) => parseFloat(m.replace(/[^0-9.]/g, ""))).filter((n) => n > 100);
    if (numbers.length > 0) {
      totalFare = Math.max(...numbers);
    }
  }
  if (totalFare === 0) {
    totalFare = 1500 * passengers.length;
  }

  const baseFare = Math.round((totalFare / 1.15) * 0.85);
  const taxes = totalFare - baseFare;
  const commission = Math.round(totalFare * 0.08);

  return {
    pnr_code,
    gds_system,
    passengers,
    segments,
    fares: {
      currency: "SAR",
      base_fare: baseFare,
      taxes,
      total_fare: totalFare,
      fare_basis: "YEE3M / QFLEX",
      commission_estimated: commission
    },
    ticketing: {
      status: ticketNumbers.length > 0 ? "ISSUED" : "CONFIRMED_NOT_ISSUED",
      time_limit: "24-HOURS-BEFORE-DEPARTURE",
      ticket_numbers: passengers.map((p) => p.ticket_number || ""),
      issuing_agent: "OMNIFLY-GDS-AGENT"
    },
    contacts: {
      agency: "وكالة أومني فلاي للسفريات",
      phone: "0505544332"
    },
    raw_text: text
  };
}

// ============================================================================
// ENDPOINT 1: GDS COMMAND TERMINAL EXECUTOR (Cryptic Screen Simulation)
// ============================================================================
router.post("/travel/gds/execute", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { command, gds_system = "amadeus" } = req.body;
  if (!command || !command.trim()) {
    res.status(400).json({ error: "الرجاء إدخال أمر GDS" });
    return;
  }

  const cmd = command.trim().toUpperCase();
  let output = "";
  let pnrParsed: ParsedPNR | null = null;

  // Simulate Realistic GDS Cryptic Commands
  if (cmd.startsWith("AN") || cmd.startsWith("1")) {
    // Availability Command (e.g. AN25OCTRUHDXB or 125OCTRUHDXB)
    output = `** OMNIFLY GDS REAL-TIME FLIGHT AVAILABILITY **
RUH - RIYADH, SA            TO   DXB - DUBAI, AE
FRI 25OCT26
 1  SV 112  J4 C4 D4 Y9 B9 M9 K9 H9  RUHDXB  0810  1055  789 E0/320    1:45
 2  EK 818  F2 J6 C6 Y9 W9 R9 M9 L9  RUHDXB  0945  1235  77W E0/773    1:50
 3  XY 204  Y9 B9 M9 H9 Q9 V9        RUHDXB  1315  1600  320 E0/320    1:45
 4  F3 440  Y9 B9 M9 H9 Q9           RUHDXB  1520  1805  320 E0/320    1:45
 5  FZ 842  C4 Y9 B9 M9 H9 Q9        RUHDXB  1910  2155  738 E0/73H    1:45
> ENTER SS1Y1 TO SELL 1 SEAT IN Y CLASS ON LINE 1`;
  } else if (cmd.startsWith("SS") || cmd.startsWith("0")) {
    // Sell Segment Command
    output = `SEGMENT 1 CONFIRMED:
 1  SV 112 Y 25OCT 5 RUHDXB HK1  0810 1055   *1A/E*
> ENTER NM1LASTNAME/FIRSTNAME MR TO ADD PASSENGER NAME`;
  } else if (cmd.startsWith("NM") || cmd.startsWith("-")) {
    // Name Element
    output = `NAME ELEMENT STORED:
1.1ALOTAIBI/ABDULLAH MR
> ENTER AP + PHONE AND TK OK TO PROCEED TO PRICING`;
  } else if (cmd.startsWith("FXP") || cmd.startsWith("FQP") || cmd.startsWith("WP")) {
    // Price PNR & Store TST
    output = `------------------------------------------------------------
FARE QUOTE / TST CREATED
PAX 1: ALOTAIBI/ABDULLAH MR (ADT)
 ITINERARY: RUH SV DXB SV RUH
 FARE:       SAR  1200.00
 TAXES:      SAR   180.00 (KSA VAT + AIRPORT CHARGES)
 TOTAL:      SAR  1380.00
 FARE BASIS: YEE3M / NON-REFUNDABLE AFTER DEPARTURE
 BAGS:       1PC 23KG CHECKED
> ENTER TTP/RT TO ISSUE ETICKET OR ET TO SAVE PNR`;
  } else if (cmd.startsWith("ET") || cmd.startsWith("ER") || cmd.startsWith("E")) {
    // End Transaction and Store PNR
    const newPnr = Math.random().toString(36).substring(2, 8).toUpperCase();
    output = `RP/RUH1A0988/RUH1A0988            AA/SU   22AUG26/1530Z   ${newPnr}
1.ALOTAIBI/ABDULLAH MR
 1  SV 112 Y 25OCT 5 RUHDXB HK1  0810 1055   *1A/E*
 2  SV 113 Y 30OCT 3 DXBRUH HK1  1830 1930   *1A/E*
 3 AP RUH +966 50 5544332 - AL-ALAMIYA TRAVEL
 4 TK OK22AUG/RUH1A0988//ET
 5 FA PAX 065-2499118833/ETSV/SAR1380.00/25OCT/RUH/S1-2
END OF TRANSACTION - PNR STORED SUCCESSFULLY`;
    pnrParsed = parseRawPNR(output, gds_system);
  } else if (cmd.startsWith("RT") || cmd.startsWith("*")) {
    // Retrieve PNR
    const pnrCode = cmd.replace(/^(RT|\*)/, "").trim() || "6X9ZKL";
    output = `RP/RUH1A0988/RUH1A0988            AA/SU   22AUG26/1420Z   ${pnrCode}
1.ALOTAIBI/ABDULLAH MR  2.ALOTAIBI/SARAH MRS
 2  SV 112 Y 10SEP 4 RUHDXB HK2  0810 1055   *1A/E*
 3  SV 113 Y 18SEP 5 DXBRUH HK2  1830 1930   *1A/E*
 4 AP RUH +966 50 5544332 - AL-ALAMIYA TRAVEL
 5 TK OK22AUG/RUH1A0988//ET
 6 FA PAX 065-2415896321/ETSV/SAR1500.00/10SEP/RUH/S1-2
 7 FA PAX 065-2415896322/ETSV/SAR1500.00/10SEP/RUH/S1-2`;
    pnrParsed = parseRawPNR(output, gds_system);
  } else if (cmd.startsWith("HE") || cmd === "HELP") {
    output = `** OMNIFLY GDS CRYPTIC COMMAND CHEATSHEET **
Availability: AN25OCTRUHDXB (Amadeus) or 125OCTRUHDXB (Sabre)
Sell Seat:    SS1Y1 (Sell 1 seat on line 1 in Y class)
Add Name:     NM1LASTNAME/FIRSTNAME MR
Add Contact:  AP RUH 0501234567
Add Ticket:   TK OK or TK TL24AUG
Price PNR:    FXP (Amadeus) or WP (Sabre) or FQ (Galileo)
Retrieve PNR: RT6X9ZKL (Amadeus) or *6X9ZKL (Sabre)
End / Save:   ET (End Transaction) or ER (End and Redisplay)
Ignore PNR:   IG (Ignore) or IR (Ignore and Retrieve)`;
  } else {
    output = `COMMAND ACKNOWLEDGED: [${cmd}]
PROCESSING COMPLETED WITH SYSTEM STATUS: NORMAL OK.`;
  }

  res.json({
    command: cmd,
    gds_system,
    output,
    parsed: pnrParsed
  });
});

// ============================================================================
// ENDPOINT 2: PNR RAW TEXT PARSER
// ============================================================================
router.post("/travel/gds/parse-pnr", (req, res) => {
  const { raw_text, gds_system } = req.body;
  if (!raw_text || !raw_text.trim()) {
    res.status(400).json({ error: "الرجاء إدخال نص PNR الخام" });
    return;
  }

  try {
    const parsed = parseRawPNR(raw_text, gds_system);

    // Save to PNR history
    const ins = db.prepare(`
      INSERT INTO travel_gds_pnr_history (
        pnr_code, gds_system, raw_text, passenger_name, airline_code,
        flight_number, route, departure_date, ticket_number, total_fare,
        currency, parsed_json, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const pNames = parsed.passengers.map((p) => p.full_name).join(", ");
    const flNums = parsed.segments.map((s) => s.flight_number).join(" / ");
    const routes = parsed.segments.map((s) => `${s.origin} -> ${s.destination}`).join(" -> ");
    const firstTkt = parsed.passengers[0]?.ticket_number || "";

    const user = getAuthUser(req);
    ins.run(
      parsed.pnr_code,
      parsed.gds_system,
      raw_text,
      pNames,
      parsed.segments[0]?.airline_code || "SV",
      flNums,
      routes,
      parsed.segments[0]?.departure_date || new Date().toISOString().slice(0, 10),
      firstTkt,
      parsed.fares.total_fare,
      parsed.fares.currency,
      JSON.stringify(parsed),
      "parsed",
      user?.name || "الموظف"
    );

    res.json(parsed);
  } catch (e: any) {
    res.status(500).json({ error: "فشل تفكيك نص PNR: " + e.message });
  }
});

// ============================================================================
// ENDPOINT 3: AUTO-IMPORT PNR INTO REAL BOOKINGS & INVOICE
// ============================================================================
router.post("/travel/gds/import-pnr", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    pnr_code,
    gds_system,
    passengers,
    segments,
    fares,
    customer_id,
    customer_name,
    customer_phone,
    payment_method = "cash",
    notes
  } = req.body;

  if (!pnr_code || !passengers || passengers.length === 0) {
    res.status(400).json({ error: "بيانات PNR أو المسافرين غير مكتملة" });
    return;
  }

  try {
    // 1. Resolve or Create Customer
    let custId = customer_id ? Number(customer_id) : null;
    if (!custId) {
      const p1 = passengers[0];
      const pName = customer_name || p1.full_name;
      const pPhone = customer_phone || "050" + Math.floor(1000000 + Math.random() * 9000000);

      // Check if customer exists by phone
      const exist = db.prepare("SELECT id FROM customers WHERE phone = ? OR name = ?").get(pPhone, pName) as any;
      if (exist) {
        custId = exist.id;
      } else {
        const insCust = db.prepare(`
          INSERT INTO customers (name, phone, customer_type, notes)
          VALUES (?, ?, 'individual', 'تم الإنشاء تلقائياً عبر استيراد PNR')
        `);
        const cRes = insCust.run(pName, pPhone);
        custId = Number(cRes.lastInsertRowid);
      }
    }

    const createdBookingIds: number[] = [];
    const firstSeg = segments[0] || {
      airline_name: "الخطوط الجوية",
      airline_code: "SV",
      flight_number: "SV 100",
      origin: "RUH",
      destination: "DXB",
      departure_date: new Date().toISOString().slice(0, 10)
    };

    const costPerPax = Math.round((fares.total_fare * 0.85) / passengers.length);
    const sellPerPax = Math.round(fares.total_fare / passengers.length);
    const profitPerPax = sellPerPax - costPerPax;

    // 2. Loop each passenger, create passenger profile and booking
    passengers.forEach((pax: any, idx: number) => {
      // Create or get passenger
      let paxId: number;
      const existPax = db.prepare("SELECT id FROM travel_passengers WHERE name_en = ? OR (customer_id = ? AND name_ar = ?)").get(pax.full_name, custId, pax.full_name) as any;
      if (existPax) {
        paxId = existPax.id;
      } else {
        const insPax = db.prepare(`
          INSERT INTO travel_passengers (customer_id, name_ar, name_en, title, passport_number)
          VALUES (?, ?, ?, ?, ?)
        `);
        const pRes = insPax.run(
          custId,
          pax.full_name,
          pax.full_name,
          pax.title || "MR",
          pax.passport_number || `P${Math.floor(10000000 + Math.random() * 90000000)}`
        );
        paxId = Number(pRes.lastInsertRowid);

        const newPaxRecord = db.prepare("SELECT * FROM travel_passengers WHERE id = ?").get(paxId);
        const host = `${req.protocol}://${req.get("host")}`;
        applyPassengerWhatsAppAutomation(newPaxRecord, host).catch(() => {});
      }

      // Create Travel Booking
      const bookingCode = `TKT-${pnr_code}-${idx + 1}`;
      const tktNum = pax.ticket_number || `065-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const insBk = db.prepare(`
        INSERT INTO travel_bookings (
          booking_number, service_type, customer_id, passenger_id, airline_supplier,
          flight_number, origin_city, destination_city, departure_date, return_date,
          ticket_number, pnr, status, issue_date, cost_price, selling_price,
          commission, payment_status, payment_method, user_name, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const bRes = insBk.run(
        bookingCode,
        "flight",
        custId,
        paxId,
        firstSeg.airline_name,
        firstSeg.flight_number,
        firstSeg.origin,
        firstSeg.destination,
        firstSeg.departure_date,
        segments[1]?.departure_date || null,
        tktNum,
        pnr_code,
        "issued",
        new Date().toISOString().slice(0, 10),
        costPerPax,
        sellPerPax,
        profitPerPax,
        "paid",
        payment_method,
        user.name,
        `مستورد آلياً من نظام ${gds_system.toUpperCase()} - PNR: ${pnr_code}`
      );

      createdBookingIds.push(Number(bRes.lastInsertRowid));
    });

    // 3. Create Travel Invoice
    const invNumber = `INV-GDS-${Date.now().toString().slice(-6)}`;
    const totalCost = costPerPax * passengers.length;
    const totalSell = sellPerPax * passengers.length;
    const totalProfit = totalSell - totalCost;

    const insInv = db.prepare(`
      INSERT INTO travel_invoices (
        invoice_number, invoice_date, customer_id, customer_name, payment_method, payment_status,
        cost_subtotal, fees_subtotal, selling_subtotal, discount, net_selling, net_profit,
        paid_amount, remaining_amount, user_id, user_name, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?)
    `);

    const invRes = insInv.run(
      invNumber,
      new Date().toISOString().slice(0, 10),
      custId,
      customer_name || passengers[0]?.full_name,
      payment_method,
      "paid",
      totalCost,
      0,
      totalSell,
      totalSell,
      totalProfit,
      totalSell,
      user.id,
      user.name,
      `فاتورة تذاكر مستوردة آلياً من GDS PNR: ${pnr_code}`
    );
    const invId = Number(invRes.lastInsertRowid);

    // Link bookings to invoice items
    const insInvItem = db.prepare(`
      INSERT INTO travel_invoice_items (invoice_id, service_type, description, passenger_name, cost_price, service_fees, selling_price, profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    passengers.forEach((pax: any, i: number) => {
      insInvItem.run(
        invId,
        "flight",
        `تذكرة طيران PNR ${pnr_code} (${firstSeg.origin} -> ${firstSeg.destination})`,
        pax.full_name,
        costPerPax,
        0,
        sellPerPax,
        profitPerPax
      );
    });

    // 4. Update GDS PNR History Status
    db.prepare(`
      UPDATE travel_gds_pnr_history
      SET status = 'imported', imported_booking_id = ?
      WHERE pnr_code = ?
    `).run(createdBookingIds[0], pnr_code);

    // 5. Create Accounting Journal Entry
    try {
      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        `قيد إثبات مبيعات تذاكر PNR ${pnr_code} عبر نظام ${gds_system.toUpperCase()}`,
        "travel_invoice",
        invId,
        [
          { account_code: "11100", debit: totalSell, credit: 0, description: "الصندوق / النقدية المحصلة من العميل" },
          { account_code: "41000", debit: 0, credit: totalSell, description: "إيرادات مبيعات تذاكر الطيران" }
        ]
      );
    } catch (jErr) {
      console.warn("Journal entry notice:", jErr);
    }

    logAudit(user.id, user.name, "GDS_PNR_IMPORTED", "استيراد وتوليد تذاكر PNR من نظام " + gds_system);

    res.json({
      success: true,
      message: `تم استيراد PNR [${pnr_code}] بنجاح، وتوليد ${passengers.length} تذكرة وفاتورة مبيعات برقم ${invNumber}`,
      booking_ids: createdBookingIds,
      invoice_id: invId,
      invoice_number: invNumber
    });
  } catch (e: any) {
    console.error("Error importing PNR:", e);
    res.status(500).json({ error: "فشل استيراد PNR إلى النظام: " + e.message });
  }
});

// ============================================================================
// ENDPOINT 4: GDS PNR HISTORY LOG
// ============================================================================
router.get("/travel/gds/history", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_gds_pnr_history ORDER BY id DESC LIMIT 50").all();
  res.json(rows);
});

// ============================================================================
// ENDPOINT 5: NDC & LCC LIVE API SEARCH SIMULATOR
// ============================================================================
router.post("/travel/ndc/search", (req, res) => {
  const { origin = "RUH", destination = "DXB", departure_date, passengers_count = 1, travel_class = "economy" } = req.body;

  const depDate = departure_date || new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);

  // Generate realistic NDC / LCC flight offers
  const offers = [
    {
      id: "NDC-SV-" + Math.floor(1000 + Math.random() * 9000),
      provider: "Saudia NDC Direct API",
      carrier_code: "SV",
      carrier_name: "الخطوط الجوية العربية السعودية",
      flight_number: "SV 112",
      origin,
      destination,
      departure_time: "08:15",
      arrival_time: "11:00",
      duration: "1h 45m",
      stops: "Direct (مباشر)",
      cabin_class: travel_class === "business" ? "Business Flex" : "Guest Semi-Flex",
      baggage_allowance: travel_class === "business" ? "2 x 32KG" : "1 x 23KG",
      seats_available: 7,
      base_fare: travel_class === "business" ? 2800 : 750,
      taxes: travel_class === "business" ? 420 : 150,
      total_price: travel_class === "business" ? 3220 : 900,
      currency: "SAR",
      amenities: ["وجبة ساخنة مجانية", "شاشة ترفيه شخصية", "واي فاي للرسائل"],
      ancillaries: [
        { name: "اختيار المقعد مسبقاً", price: 50 },
        { name: "حقيبة إضافية 23 كجم", price: 180 },
        { name: "دخول صالة الفرسان VIP", price: 200 }
      ]
    },
    {
      id: "NDC-XY-" + Math.floor(1000 + Math.random() * 9000),
      provider: "Flynas Direct API",
      carrier_code: "XY",
      carrier_name: "طيران ناس (Flynas)",
      flight_number: "XY 204",
      origin,
      destination,
      departure_time: "13:30",
      arrival_time: "16:15",
      duration: "1h 45m",
      stops: "Direct (مباشر)",
      cabin_class: travel_class === "business" ? "Premium Class" : "Light / Value",
      baggage_allowance: travel_class === "business" ? "2 x 20KG" : "1 x 20KG + 7KG Hand",
      seats_available: 9,
      base_fare: travel_class === "business" ? 1800 : 550,
      taxes: travel_class === "business" ? 270 : 120,
      total_price: travel_class === "business" ? 2070 : 670,
      currency: "SAR",
      amenities: ["مقاعد جلدية مريحة", "شحن USB"],
      ancillaries: [
        { name: "وجبة ساخنة مسبقة الدفع", price: 35 },
        { name: "مقعد بمساحة أرجل إضافية", price: 65 }
      ]
    },
    {
      id: "NDC-F3-" + Math.floor(1000 + Math.random() * 9000),
      provider: "Flyadeal Direct API",
      carrier_code: "F3",
      carrier_name: "طيران أديل (Flyadeal)",
      flight_number: "F3 440",
      origin,
      destination,
      departure_time: "16:45",
      arrival_time: "19:30",
      duration: "1h 45m",
      stops: "Direct (مباشر)",
      cabin_class: "Fly / Fly+",
      baggage_allowance: "1 x 15KG + 7KG Hand",
      seats_available: 14,
      base_fare: 420,
      taxes: 110,
      total_price: 530,
      currency: "SAR",
      amenities: ["طائرات حديثة A320neo"],
      ancillaries: [
        { name: "أولوية الصعود للطائرة", price: 30 },
        { name: "حقيبة إضافية 20 كجم", price: 140 }
      ]
    },
    {
      id: "NDC-EK-" + Math.floor(1000 + Math.random() * 9000),
      provider: "Emirates Gateway API",
      carrier_code: "EK",
      carrier_name: "طيران الإمارات (Emirates)",
      flight_number: "EK 818",
      origin,
      destination,
      departure_time: "20:10",
      arrival_time: "23:00",
      duration: "1h 50m",
      stops: "Direct (مباشر)",
      cabin_class: travel_class === "business" ? "Business Special" : "Economy Flex",
      baggage_allowance: travel_class === "business" ? "2 x 32KG" : "1 x 30KG",
      seats_available: 5,
      base_fare: travel_class === "business" ? 3400 : 920,
      taxes: travel_class === "business" ? 510 : 180,
      total_price: travel_class === "business" ? 3910 : 1100,
      currency: "SAR",
      amenities: ["نظام ice الترفيهي الحائز على جوائز", "وجبات متعددة الأطباق", "واي فاي عالي السرعة"],
      ancillaries: [
        { name: "ترقية إلى مقعد درجة رجال الأعمال", price: 1200 }
      ]
    }
  ];

  res.json({
    search_criteria: { origin, destination, departure_date: depDate, passengers_count, travel_class },
    offers_count: offers.length,
    offers
  });
});

export default router;
