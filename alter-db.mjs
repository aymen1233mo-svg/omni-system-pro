import Database from 'better-sqlite3';
const db = new Database('./artifacts/api-server/omnisystem.db');
try {
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_right_text_1 TEXT DEFAULT 'معمل عبدالاسلام للخبز العربي'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_right_text_2 TEXT DEFAULT 'عدن/المعلا'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_right_text_3 TEXT DEFAULT '774106282'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_left_text_1 TEXT DEFAULT 'قيس'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_left_text_2 TEXT DEFAULT 'عدن/المعلا'").run();
  db.prepare("ALTER TABLE document_print_settings ADD COLUMN header_left_text_3 TEXT DEFAULT '771845734'").run();
} catch (e) {
  console.log("Columns may already exist:", e.message);
}
db.close();
