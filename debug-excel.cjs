const XLSX = require('./node_modules/xlsx');
const fs = require('fs');
const path = require('path');

// Find the Excel file in common download locations
function findExcel(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && (e.name.includes('ENERO') || e.name.includes('Global Sound'))) {
        return path.join(dir, e.name);
      }
    }
  } catch (e) {}
  return null;
}

const searchDirs = [
  process.env.USERPROFILE + '\\Downloads',
  process.env.USERPROFILE + '\\Desktop',
  process.env.USERPROFILE + '\\Music',
  'C:\\temp',
];

let filePath = null;
for (const dir of searchDirs) {
  filePath = findExcel(dir);
  if (filePath) break;
}

if (!filePath) {
  console.log('❌ Excel file not found. Checked:', searchDirs);
  console.log('Please place ENERO-2026-Global Sound Stars.xlsx in one of these dirs');
  process.exit(1);
}

console.log('✅ Found:', filePath);

const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer', raw: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('\n=== FIRST 10 ROWS ===');
rows.slice(0, 10).forEach((row, i) => {
  console.log(`Row ${i}:`, JSON.stringify(row).substring(0, 200));
});

// Find the header row (one with "Statement Period")
let headerIdx = -1;
for (let i = 0; i < Math.min(rows.length, 20); i++) {
  const row = rows[i];
  const cells = row.map(c => String(c).toLowerCase().trim());
  if (cells.includes('statement period') || cells.includes('collaborator share')) {
    headerIdx = i;
    break;
  }
}

console.log('\n=== HEADER ROW INDEX:', headerIdx, '===');
if (headerIdx >= 0) {
  const header = rows[headerIdx];
  console.log('Headers:', header);
  
  // Find key column indices
  const cols = {};
  header.forEach((h, i) => {
    const k = String(h).toLowerCase().trim();
    cols[k] = i;
  });
  
  console.log('\n=== KEY COLUMN INDICES ===');
  ['statement period', 'quantity', 'transaction type', 'transaction type description', 'royalty basis', 'tax %', 'collaborator share', 'currency'].forEach(name => {
    console.log(`  "${name}" → col ${cols[name] !== undefined ? cols[name] : 'NOT FOUND'}`);
  });
  
  // Sum collaborator share for non-FS rows
  const txTypeIdx = cols['transaction type'];
  const shareIdx = cols['collaborator share'];
  let totalShare = 0;
  let totalAll = 0;
  let fsCount = 0;
  
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const share = parseFloat(String(row[shareIdx] || '0'));
    if (!isNaN(share)) {
      totalAll += share;
      if (String(row[txTypeIdx]).trim().toUpperCase() === 'FS') {
        fsCount++;
      } else {
        totalShare += share;
      }
    }
  }
  
  console.log('\n=== TOTALS ===');
  console.log('Sum of ALL Collaborator Share:', totalAll.toFixed(5));
  console.log('Sum excluding FS rows:', totalShare.toFixed(5));
  console.log('FS row count:', fsCount);
  console.log('Expected (from header):', '318.19807882');
}
