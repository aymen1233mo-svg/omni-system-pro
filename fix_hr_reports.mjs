import fs from 'fs';
const path = 'artifacts/pos-system/src/pages/hr/reports.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace all instances of `statementData.something?.reduce` 
content = content.replace(/statementData\.overtime\?\.reduce/g, '((statementData.overtime as any[]) || []).reduce');

// Replace all instances of `(statementData.loans as any[]).`
content = content.replace(/\(statementData\.loans as any\[\]\)\./g, '((statementData.loans as any[]) || []).');

// Replace all instances of `(statementData.vouchers as any[]).`
content = content.replace(/\(statementData\.vouchers as any\[\]\)\./g, '((statementData.vouchers as any[]) || []).');

// To be safe, also replace `statementData.entitlements?.map` if there is any, let's just do a generic replace
content = content.replace(/\(statementData\.(\w+) as any\[\]\)/g, '((statementData.$1 as any[]) || [])');
content = content.replace(/statementData\.(\w+)\?\.(reduce|map|length)/g, '((statementData.$1 as any[]) || []).$2');


fs.writeFileSync(path, content, 'utf8');
