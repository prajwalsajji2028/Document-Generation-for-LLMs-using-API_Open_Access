/**
 * Debug script — renders a document and validates it can be opened.
 */
import { renderDocument } from './src/renderer/index.js';
import { writeFile } from 'node:fs/promises';

const buffer = await renderDocument({
  content: [
    { type: 'heading', text: 'Sales Dashboard', level: 1 },
    { type: 'paragraph', text: 'Summary of Q4 performance across all regions.' },
    {
      type: 'table',
      headers: ['Region', 'Revenue', 'Growth'],
      rows: [
        ['North America', '$520K', '+12%'],
        ['Europe', '$380K', '+18%'],
        ['Asia Pacific', '$310K', '+25%'],
      ],
      style: 'striped',
    },
    { type: 'heading', text: 'Action Items', level: 2 },
    {
      type: 'list',
      items: [
        'Increase APAC marketing spend by 20%',
        'Open Berlin office in Q1',
        'Launch localized pricing for EU',
      ],
      ordered: true,
    },
  ],
  style: { preset: 'report' },
  metadata: { title: 'Sales Dashboard' },
});

await writeFile('debug_direct.docx', buffer);
console.log(`Written debug_direct.docx (${buffer.length} bytes)`);
console.log('PK magic:', buffer[0] === 0x50 && buffer[1] === 0x4b ? 'YES' : 'NO');

// Also test the HTTP path to compare
const res = await fetch('http://localhost:3000/v1/documents/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: [
      { type: 'heading', text: 'Test', level: 1 },
      { type: 'paragraph', text: 'Hello world.' },
    ],
  }),
});

const httpBuf = Buffer.from(await res.arrayBuffer());
await writeFile('debug_http.docx', httpBuf);
console.log(`Written debug_http.docx (${httpBuf.length} bytes)`);
console.log('PK magic:', httpBuf[0] === 0x50 && httpBuf[1] === 0x4b ? 'YES' : 'NO');
console.log('Content-Type:', res.headers.get('content-type'));

// Check if the buffers are different in any structural way
console.log('\nDirect buffer type:', typeof buffer, buffer.constructor.name);
console.log('HTTP buffer type:', typeof httpBuf, httpBuf.constructor.name);
