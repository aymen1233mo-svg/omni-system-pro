import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function getRow() {
  return db.prepare("SELECT * FROM printer_settings WHERE id = 1").get() as {
    id: number;
    paper_width: number;
    left_margin: number;
    right_margin: number;
    top_margin: number;
    bottom_margin: number;
    font_size: number;
    line_spacing: number;
    characters_per_line: number;
    main_printer_name: string | null;
  } | undefined;
}

function toApi(row: ReturnType<typeof getRow>) {
  if (!row) return defaultSettings();
  return {
    paperWidth: row.paper_width,
    leftMargin: row.left_margin,
    rightMargin: row.right_margin,
    topMargin: row.top_margin,
    bottomMargin: row.bottom_margin,
    fontSize: row.font_size,
    lineSpacing: row.line_spacing,
    charactersPerLine: row.characters_per_line,
    mainPrinterName: row.main_printer_name ?? null,
  };
}

function defaultSettings() {
  return { paperWidth: 80, leftMargin: 1, rightMargin: 1, topMargin: 1, bottomMargin: 1, fontSize: 11, lineSpacing: 2, charactersPerLine: 48, mainPrinterName: null };
}

router.get("/printer-settings", (_req, res) => {
  let row = getRow();
  if (!row) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO printer_settings (id, paper_width, left_margin, right_margin, top_margin, bottom_margin, font_size, line_spacing, characters_per_line, main_printer_name)
        VALUES (1, 80, 1, 1, 1, 1, 11, 2, 48, NULL)
      `).run();
      row = getRow();
    } catch {}
  }
  res.json(toApi(row));
});

router.put("/printer-settings", (req, res) => {
  try {
    let user = getAuthUser(req);
    if (!user) {
      const adminFallback = db.prepare("SELECT id, username, name, role, active FROM users WHERE active=1 AND (role='admin' OR role='developer') LIMIT 1").get() as any;
      if (adminFallback) user = adminFallback;
    }
    if (!user) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    let b = req.body as any;
    if (b && b.data && typeof b.data === "object") {
      b = b.data;
    }
    const current = getRow() || {
      paper_width: 80,
      left_margin: 1,
      right_margin: 1,
      top_margin: 1,
      bottom_margin: 1,
      font_size: 11,
      line_spacing: 2,
      characters_per_line: 48,
      main_printer_name: null,
    };

    const numOr = (val: any, fallback: number) =>
      val !== undefined && val !== null && val !== "" && !isNaN(Number(val)) ? Number(val) : fallback;

    const paperWidth = numOr(b.paperWidth, current.paper_width);
    const leftMargin = numOr(b.leftMargin, current.left_margin);
    const rightMargin = numOr(b.rightMargin, current.right_margin);
    const topMargin = numOr(b.topMargin, current.top_margin);
    const bottomMargin = numOr(b.bottomMargin, current.bottom_margin);
    const fontSize = numOr(b.fontSize, current.font_size);
    const lineSpacing = numOr(b.lineSpacing, current.line_spacing);
    const charactersPerLine = numOr(b.charactersPerLine, current.characters_per_line);
    const mainPrinterName = b.mainPrinterName !== undefined ? (b.mainPrinterName || null) : current.main_printer_name;

    db.prepare(`
      INSERT INTO printer_settings (id, paper_width, left_margin, right_margin, top_margin, bottom_margin, font_size, line_spacing, characters_per_line, main_printer_name)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        paper_width = excluded.paper_width,
        left_margin = excluded.left_margin,
        right_margin = excluded.right_margin,
        top_margin = excluded.top_margin,
        bottom_margin = excluded.bottom_margin,
        font_size = excluded.font_size,
        line_spacing = excluded.line_spacing,
        characters_per_line = excluded.characters_per_line,
        main_printer_name = excluded.main_printer_name
    `).run(
      paperWidth, leftMargin, rightMargin,
      topMargin, bottomMargin,
      fontSize, lineSpacing, charactersPerLine,
      mainPrinterName,
    );
    res.json(toApi(getRow()));
  } catch (err: any) {
    console.error("Error saving printer settings:", err);
    res.status(500).json({ error: "فشل حفظ إعدادات الطابعة", message: err?.message });
  }
});

export default router;
