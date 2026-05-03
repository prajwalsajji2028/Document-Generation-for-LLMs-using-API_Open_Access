# DocxForge

**API-first document generation service** — converts AI model output (JSON or Markdown) into professionally formatted `.docx` files.

> 🔗 **Hosted API**: [https://api.docxforge.dev](https://api.docxforge.dev) *(coming soon)*

---

## 30-Second Quickstart (Docker)

```bash
# Clone and start
git clone https://github.com/your-org/docxforge.git
cd docxforge
docker-compose up --build -d

# Verify it's running
curl http://localhost:3000/v1/health
# → {"status":"ok","version":"1.0.0","queue_depth":0}
```

The API is now live at `http://localhost:3000`.  
Default API keys: `dev-key-1`, `dev-key-2` (set via `DOCXFORGE_API_KEYS`).

---

## Quick Examples

### Convert Markdown → .docx

```bash
curl -X POST http://localhost:3000/v1/documents/from-markdown \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-1" \
  -d '{
    "markdown": "# Quarterly Report\n\nRevenue grew **15%** this quarter.\n\n## Key Metrics\n\n| Metric | Value |\n|--------|-------|\n| Revenue | $1.2M |\n| Users | 50,000 |\n| NPS | 72 |\n\n## Next Steps\n\n- Expand to EU markets\n- Launch mobile app\n- Hire 10 engineers",
    "style": { "preset": "executive" },
    "metadata": { "title": "Q4 Report", "author": "Finance Team" }
  }' \
  -o report.docx
```

### Generate with Table + Heading (JSON Blocks)

```bash
curl -X POST http://localhost:3000/v1/documents/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-1" \
  -d '{
    "content": [
      { "type": "heading", "text": "Sales Dashboard", "level": 1 },
      { "type": "paragraph", "text": "Summary of Q4 performance across all regions." },
      {
        "type": "table",
        "headers": ["Region", "Revenue", "Growth"],
        "rows": [
          ["North America", "$520K", "+12%"],
          ["Europe", "$380K", "+18%"],
          ["Asia Pacific", "$310K", "+25%"]
        ],
        "style": "striped"
      },
      { "type": "heading", "text": "Action Items", "level": 2 },
      {
        "type": "list",
        "items": [
          "Increase APAC marketing spend by 20%",
          "Open Berlin office in Q1",
          "Launch localized pricing for EU"
        ],
        "ordered": true
      }
    ],
    "style": { "preset": "report" },
    "metadata": { "title": "Sales Dashboard" }
  }' \
  -o dashboard.docx
```

### Async Generation

```bash
# Enqueue job
curl -X POST http://localhost:3000/v1/documents/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-1" \
  -d '{
    "content": [{ "type": "paragraph", "text": "Large document..." }],
    "async": true,
    "webhook_url": "https://your-app.com/webhook"
  }'
# → {"job_id":"abc-123","status":"queued"}

# Poll job status
curl http://localhost:3000/v1/jobs/abc-123 \
  -H "X-API-Key: dev-key-1"
# → {"job_id":"abc-123","status":"done","progress":100,"download_url":"/v1/jobs/abc-123/download"}

# Download result
curl http://localhost:3000/v1/jobs/abc-123/download \
  -H "X-API-Key: dev-key-1" \
  -o result.docx
```

---

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/documents/generate` | Generate .docx from JSON blocks |
| `POST` | `/v1/documents/from-markdown` | Generate .docx from Markdown |
| `GET` | `/v1/jobs/:id` | Check async job status |
| `GET` | `/v1/jobs/:id/download` | Download completed .docx |
| `GET` | `/v1/health` | Service health check |

### Authentication

All requests require an `X-API-Key` header. Configure allowed keys via the `DOCXFORGE_API_KEYS` environment variable (comma-separated).

```
X-API-Key: your-api-key-here
```

> **Dev mode**: If `DOCXFORGE_API_KEYS` is unset, auth is disabled.

---

## Block Types

### `heading`

```json
{ "type": "heading", "text": "Chapter Title", "level": 1 }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | ✅ | Heading text |
| `level` | `1\|2\|3\|4` | No (default: `1`) | Heading depth |

### `paragraph`

```json
{ "type": "paragraph", "text": "Body text here.", "align": "justify" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | ✅ | Paragraph text. Supports `**bold**` and `*italic*` inline Markdown. |
| `align` | `left\|center\|right\|justify` | No (default: `left`) | Text alignment |

### `table`

```json
{
  "type": "table",
  "headers": ["Name", "Score"],
  "rows": [["Alice", "95"], ["Bob", "87"]],
  "style": "striped"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `headers` | `string[]` | ✅ | Column header labels |
| `rows` | `string[][]` | ✅ | 2D array of cell values |
| `style` | `striped\|bordered\|minimal` | No (default: `striped`) | Table visual style |

### `image`

```json
{ "type": "image", "src": "https://example.com/chart.png", "width_pct": 60, "caption": "Figure 1" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `src` | `string` | ✅ | Image source: HTTP(S) URL, base64 data URI, or file path |
| `width_pct` | `number` | No (default: `80`) | Width as percentage of page (1–100) |
| `caption` | `string` | No | Caption text below the image |

### `list`

```json
{ "type": "list", "items": ["First", "Second", "Third"], "ordered": true, "indent_level": 0 }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | `string[]` | ✅ | List item texts (min 1) |
| `ordered` | `boolean` | No (default: `false`) | Numbered list if true |
| `indent_level` | `0\|1\|2` | No (default: `0`) | Nesting depth |

### `page_break`

```json
{ "type": "page_break" }
```

Inserts a page break. No additional fields.

---

## StyleConfig

Optional styling overrides passed in the `style` field.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `preset` | `minimal\|executive\|report\|academic` | `minimal` | Base design preset |
| `font_family` | `string` | *(from preset)* | Override font family |
| `font_size` | `number` | *(from preset)* | Body font size in points |
| `line_spacing` | `number` | *(from preset)* | Line spacing multiplier (1.0–3.0) |
| `accent_color` | `string` | *(from preset)* | Hex color for headings & table headers (e.g. `#3730A3`) |

### Design Presets

| Preset | Font | Size | Spacing | Accent | Best For |
|--------|------|------|---------|--------|----------|
| `minimal` | Arial | 11pt | 1.15× | Black | Technical docs, memos |
| `executive` | Calibri | 11pt | 1.25× | `#374151` (slate) | Business reports |
| `report` | Georgia | 11pt | 1.50× | `#3730A3` (indigo) | Formal reports |
| `academic` | Times New Roman | 12pt | 2.00× | Black | Research papers |

---

## PageConfig

Optional page geometry overrides (all values in DXA — twentieths of a point).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `integer` | `11906` | Page width (A4) |
| `height` | `integer` | `16838` | Page height (A4) |
| `margin_top` | `integer` | `1440` | Top margin (1 inch) |
| `margin_right` | `integer` | `1440` | Right margin (1 inch) |
| `margin_bottom` | `integer` | `1440` | Bottom margin (1 inch) |
| `margin_left` | `integer` | `1440` | Left margin (1 inch) |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `DOCXFORGE_API_KEYS` | *(empty = auth disabled)* | Comma-separated valid API keys |
| `RATE_LIMIT_MAX` | `100` | Max requests per window per key |
| `RATE_LIMIT_WINDOW` | `1 minute` | Rate limit time window |
| `RESULT_TTL_SECONDS` | `3600` | How long async results are stored |
| `WORKER_CONCURRENCY` | `5` | Parallel jobs per worker |
| `LOG_LEVEL` | `info` | Pino log level |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |

---

## Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start Redis (required for async jobs)
docker run -d -p 6379:6379 redis:7-alpine

# Start the API server (with file watching)
npm run dev

# Start the background worker (separate terminal)
npm run worker

# Run tests
npm test
```

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│   Client     │────▶│  Fastify API  │────▶│  Renderer │──▶ .docx Buffer
│  (curl/SDK)  │     │              │     │  (docx.js)│
└─────────────┘     └──────┬───────┘     └───────────┘
                           │ async=true
                           ▼
                    ┌──────────────┐     ┌───────────┐
                    │   BullMQ     │────▶│  Worker    │──▶ Redis (result)
                    │   (Redis)    │     │           │
                    └──────────────┘     └───────────┘
```

---

## License

MIT
