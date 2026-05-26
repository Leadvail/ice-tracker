const fs = require('fs');
const xml = fs.readFileSync('temp_docx/word/document.xml', 'utf8');

const tableRegex = /<w:tbl>(.*?)<\/w:tbl>/g;
let tableMatch;
let tables = [];
while ((tableMatch = tableRegex.exec(xml)) !== null) {
  tables.push(tableMatch[1]);
}

// We only care about the first table, which is the storyboard timeline
if (tables.length > 0) {
  const rowRegex = /<w:tr[^>]*>(.*?)<\/w:tr>/g;
  let rowMatch;
  let rows = [];
  while ((rowMatch = rowRegex.exec(tables[0])) !== null) {
    const rowXml = rowMatch[1];
    const cellRegex = /<w:tc[^>]*>(.*?)<\/w:tc>/g;
    let cellMatch;
    let cells = [];
    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const cellXml = cellMatch[1];
      const textRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
      let textMatch;
      let texts = [];
      while ((textMatch = textRegex.exec(cellXml)) !== null) {
        texts.push(textMatch[1]);
      }
      cells.push(texts.join(' '));
    }
    rows.push(cells);
  }
  fs.writeFileSync('storyboard_data.json', JSON.stringify(rows, null, 2));
}
