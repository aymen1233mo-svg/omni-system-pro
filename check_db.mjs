import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "artifacts/api-server/data/pos.db");
const db = new DatabaseSync(dbPath);

try {
  const products = db.prepare("SELECT COUNT(*) as count FROM products").get();
  const categories = db.prepare("SELECT COUNT(*) as count FROM categories").get();
  const users = db.prepare("SELECT id, username, name, role FROM users").all();
  console.log(JSON.stringify({ products, categories, users }));
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
