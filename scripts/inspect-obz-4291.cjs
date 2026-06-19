const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const root = path.resolve(__dirname, '..');
const wb = XLSX.readFile(path.join(root, '4291.xlsx'), { cellDates: false });
const rows = XLSX.utils.sheet_to_json(wb.Sheets['BASE OBZ'], { header: 1, blankrows: false, defval: '' });
console.log('rows', rows.length);
rows.slice(0, 25).forEach((row, idx) => {
  console.log(`ROW ${idx + 1}`, JSON.stringify(row));
});

const likelyHeader = rows.findIndex((row) => row.some((v) => String(v).toUpperCase().includes('PROGRAMA')) && row.some((v) => String(v).toUpperCase().includes('AÇÃO')));
console.log('likelyHeaderRow', likelyHeader + 1);
if (likelyHeader >= 0) {
  console.log('header', JSON.stringify(rows[likelyHeader]));
  console.log('firstData', JSON.stringify(rows[likelyHeader + 1]));
}
