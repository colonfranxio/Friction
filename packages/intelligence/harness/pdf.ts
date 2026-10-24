/** Minimal text-only PDF (Helvetica, ASCII) so the harness can test the PDF path with no extra dependency. */
export function textToPdf(text: string): Buffer {
  const lines = text
    .replace(/[—–]/g, '-')
    .replace(/[·•]/g, '*')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e\n]/g, '')
    .split('\n')
    .flatMap((l) => l.match(/.{1,90}(\s|$)|.{90}/g) ?? ['']);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 50) pages.push(lines.slice(i, i + 50));

  const esc = (s: string) => s.replace(/[\\()]/g, '\\$&');
  const objs: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids: string[] = [];
  for (const page of pages) {
    const stream = `BT /F1 10 Tf 14 TL 50 780 Td ${page.map((l) => `(${esc(l.trimEnd())}) '`).join(' ')} ET`;
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objs.length} 0 R >>`);
    kids.push(`${objs.length} 0 R`);
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
