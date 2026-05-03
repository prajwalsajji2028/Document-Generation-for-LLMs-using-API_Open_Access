/**
 * Quick smoke test — sends requests to the running server and saves .docx files.
 * Run: node test_request.js
 */

const BASE = 'http://localhost:3000';

async function testHealth() {
  const res = await fetch(`${BASE}/v1/health`);
  const body = await res.json();
  console.log('✓ Health:', JSON.stringify(body));
}

async function testMarkdown() {
  const res = await fetch(`${BASE}/v1/documents/from-markdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      markdown: [
        '# Quarterly Report',
        '',
        'Revenue grew **15%** this quarter across all regions.',
        '',
        '## Key Metrics',
        '',
        '| Metric | Value |',
        '|--------|-------|',
        '| Revenue | $1.2M |',
        '| Users | 50,000 |',
        '| NPS | 72 |',
        '',
        '## Action Items',
        '',
        '- Expand to EU markets',
        '- Launch mobile app',
        '- Hire 10 engineers',
      ].join('\n'),
      style: { preset: 'executive' },
      metadata: { title: 'Q4 Report', author: 'Finance Team' },
    }),
  });

  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFile } = await import('node:fs/promises');
  await writeFile('test_markdown.docx', buf);
  console.log(`✓ Markdown → test_markdown.docx (${buf.length} bytes)`);
}

async function testGenerate() {
  const res = await fetch(`${BASE}/v1/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
        { type: 'page_break' },
        { type: 'heading', text: 'Appendix', level: 2 },
        { type: 'paragraph', text: 'This page intentionally left for detailed breakdowns.' },
      ],
      style: { preset: 'report' },
      metadata: { title: 'Sales Dashboard' },
    }),
  });

  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFile } = await import('node:fs/promises');
  await writeFile('test_generate.docx', buf);
  console.log(`✓ Generate → test_generate.docx (${buf.length} bytes)`);
}

async function main() {
  console.log('Testing DocxForge API at', BASE);
  console.log('─'.repeat(40));

  await testHealth();
  await testMarkdown();
  await testGenerate();

  console.log('─'.repeat(40));
  console.log('Done! Open the .docx files in Word to verify.');
}

main().catch(console.error);
