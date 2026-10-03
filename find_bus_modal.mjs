import fs from 'fs';
const content = fs.readFileSync('artifacts/pos-system/src/pages/travel-bus-tickets.tsx', 'utf-8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('<DialogContent'));
const endIndex = lines.findIndex((l, idx) => idx > startIndex && l.includes('</DialogContent>'));

console.log("Start:", startIndex, "End:", endIndex);
