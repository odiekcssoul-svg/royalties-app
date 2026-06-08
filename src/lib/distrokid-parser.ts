import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface RoyaltyRow {
  sale_period: string
  store: string
  country: string
  artist_name: string
  song_title: string
  album_name: string
  quantity: number
  earnings_usd: number
}

// ============================================================
// KEYWORD MAPPINGS — covers DistroKid, SoundOn, TuneCore,
// CD Baby, Ditto, ONErpm, UnitedMasters, Amuse, etc.
// Each field has a list of known column name fragments.
// Matching is case-insensitive and partial.
// ============================================================
const FIELD_KEYWORDS: Record<keyof RoyaltyRow, string[]> = {
  sale_period: [
    'reporting date', 'sale period', 'sale month', 'period', 'reporting period',
    'month', 'date', 'transaction date', 'report date', 'settlement date',
    'payment date', 'sales period', 'income period', 'billing period',
  ],
  store: [
    // SoundOn exact first
    'store name',
    'store', 'platform', 'service', 'dsp', 'channel',
    'retailer', 'music service', 'streaming service', 'outlet',
    'distributor', 'provider', 'source', 'vendor',
  ],
  country: [
    // SoundOn exact first
    'sales region',
    'country of sale', 'country', 'territory', 'region',
    'market', 'geo', 'location', 'sale country', 'sales country',
  ],
  artist_name: [
    'artist name', 'artist', 'performer', 'recording artist',
    'main artist', 'primary artist', 'act',
    'track artists',
  ],
  song_title: [
    // SoundOn exact first
    'track title',
    'song title', 'title', 'track name', 'recording title',
    'song', 'work title', 'song name', 'asset title',
    'content title', 'release title',
    // 'track' alone goes last — to avoid matching "Track Artists" or plain "Track" (album track col)
    'track',
  ],
  album_name: [
    'album title', 'album name', 'album', 'release', 'product title',
    'release name', 'ep/album',
  ],
  quantity: [
    // SoundOn exact first
    'units of sold', 'units sold',
    'quantity', 'streams', 'units',
    'plays', 'net units', 'total quantity', 'number of streams',
    'stream count', 'total streams', 'downloads', 'total plays',
    'streams/downloads',
  ],
  earnings_usd: [
    // Label/distributor reports (Global Sound Stars format)
    'collaborator share',
    // SoundOn exact first
    'final royalty',
    'royalty (usd)', 'royalty amount (usd)', 'royalty amount',
    'total royalty', 'net royalty',
    // DistroKid
    'earnings (usd)', 'earnings', 'you earned', 'your earnings',
    'paid (usd)',
    // Generic
    'net revenue', 'amount (usd)', 'amount',
    'net amount', 'total earnings', 'revenue', 'payment',
    'net', 'usd', 'gross revenue', 'total revenue', 'income',
    'net income', 'payout', 'net payout', 'settlement amount',
    'total amount', 'earning',
    // royalty last (to avoid matching "royalty basis" which is a rate, not an amount)
    'royalty',
  ],
}

// ============================================================
// Country code → full name
// ============================================================
const COUNTRY_CODES: Record<string, string> = {
  AF: 'Afganistán', AL: 'Albania', DZ: 'Argelia', AD: 'Andorra',
  AO: 'Angola', AG: 'Antigua y Barbuda', AR: 'Argentina', AM: 'Armenia',
  AU: 'Australia', AT: 'Austria', AZ: 'Azerbaiyán', BS: 'Bahamas',
  BH: 'Baréin', BD: 'Bangladés', BB: 'Barbados', BY: 'Bielorrusia',
  BE: 'Bélgica', BZ: 'Belice', BJ: 'Benín', BT: 'Bután',
  BO: 'Bolivia', BA: 'Bosnia y Herzegovina', BW: 'Botsuana', BR: 'Brasil',
  BN: 'Brunéi', BG: 'Bulgaria', BF: 'Burkina Faso', BI: 'Burundi',
  CV: 'Cabo Verde', KH: 'Camboya', CM: 'Camerún', CA: 'Canadá',
  CF: 'Rep. Centroafricana', TD: 'Chad', CL: 'Chile', CN: 'China',
  CO: 'Colombia', KM: 'Comoras', CG: 'Congo', CR: 'Costa Rica',
  HR: 'Croacia', CU: 'Cuba', CY: 'Chipre', CZ: 'República Checa',
  DK: 'Dinamarca', DJ: 'Yibuti', DM: 'Dominica', DO: 'Rep. Dominicana',
  EC: 'Ecuador', EG: 'Egipto', SV: 'El Salvador', GQ: 'Guinea Ecuatorial',
  ER: 'Eritrea', EE: 'Estonia', SZ: 'Suazilandia', ET: 'Etiopía',
  FJ: 'Fiyi', FI: 'Finlandia', FR: 'Francia', GA: 'Gabón',
  GM: 'Gambia', GE: 'Georgia', DE: 'Alemania', GH: 'Ghana',
  GR: 'Grecia', GD: 'Granada', GT: 'Guatemala', GN: 'Guinea',
  GW: 'Guinea-Bisáu', GY: 'Guyana', HT: 'Haití', HN: 'Honduras',
  HU: 'Hungría', IS: 'Islandia', IN: 'India', ID: 'Indonesia',
  IR: 'Irán', IQ: 'Irak', IE: 'Irlanda', IL: 'Israel',
  IT: 'Italia', JM: 'Jamaica', JP: 'Japón', JO: 'Jordania',
  KZ: 'Kazajistán', KE: 'Kenia', KI: 'Kiribati', KP: 'Corea del Norte',
  KR: 'Corea del Sur', KW: 'Kuwait', KG: 'Kirguistán', LA: 'Laos',
  LV: 'Letonia', LB: 'Líbano', LS: 'Lesoto', LR: 'Liberia',
  LY: 'Libia', LI: 'Liechtenstein', LT: 'Lituania', LU: 'Luxemburgo',
  MG: 'Madagascar', MW: 'Malaui', MY: 'Malasia', MV: 'Maldivas',
  ML: 'Malí', MT: 'Malta', MH: 'Islas Marshall', MR: 'Mauritania',
  MU: 'Mauricio', MX: 'México', FM: 'Micronesia', MD: 'Moldavia',
  MC: 'Mónaco', MN: 'Mongolia', ME: 'Montenegro', MA: 'Marruecos',
  MZ: 'Mozambique', MM: 'Myanmar', NA: 'Namibia', NR: 'Nauru',
  NP: 'Nepal', NL: 'Países Bajos', NZ: 'Nueva Zelanda', NI: 'Nicaragua',
  NE: 'Níger', NG: 'Nigeria', MK: 'Macedonia del Norte', NO: 'Noruega',
  OM: 'Omán', PK: 'Pakistán', PW: 'Palaos', PA: 'Panamá',
  PG: 'Papúa Nueva Guinea', PY: 'Paraguay', PE: 'Perú', PH: 'Filipinas',
  PL: 'Polonia', PT: 'Portugal', QA: 'Catar', RO: 'Rumanía',
  RU: 'Rusia', RW: 'Ruanda', KN: 'San Cristóbal y Nieves', LC: 'Santa Lucía',
  VC: 'San Vicente y las Granadinas', WS: 'Samoa', SM: 'San Marino',
  ST: 'Santo Tomé y Príncipe', SA: 'Arabia Saudita', SN: 'Senegal',
  RS: 'Serbia', SC: 'Seychelles', SL: 'Sierra Leona', SG: 'Singapur',
  SK: 'Eslovaquia', SI: 'Eslovenia', SB: 'Islas Salomón', SO: 'Somalia',
  ZA: 'Sudáfrica', SS: 'Sudán del Sur', ES: 'España', LK: 'Sri Lanka',
  SD: 'Sudán', SR: 'Surinam', SE: 'Suecia', CH: 'Suiza',
  SY: 'Siria', TW: 'Taiwán', TJ: 'Tayikistán', TZ: 'Tanzania',
  TH: 'Tailandia', TL: 'Timor-Leste', TG: 'Togo', TO: 'Tonga',
  TT: 'Trinidad y Tobago', TN: 'Túnez', TR: 'Turquía', TM: 'Turkmenistán',
  TV: 'Tuvalu', UG: 'Uganda', UA: 'Ucrania', AE: 'Emiratos Árabes Unidos',
  GB: 'Reino Unido', US: 'Estados Unidos', UY: 'Uruguay', UZ: 'Uzbekistán',
  VU: 'Vanuatu', VE: 'Venezuela', VN: 'Vietnam', YE: 'Yemen',
  ZM: 'Zambia', ZW: 'Zimbabue', XK: 'Kosovo', PS: 'Palestina',
  // Common extras
  HK: 'Hong Kong', MO: 'Macao',
  EU: 'Europa', ROW: 'Resto del mundo',
}

export function expandCountryCode(code: string): string {
  if (!code) return 'Unknown'
  const upper = code.trim().toUpperCase()
  return COUNTRY_CODES[upper] ?? code
}

// ============================================================
// Normalize artist name
// "Track Artists" in label reports contains ALL collaborators
// separated by "|" (e.g. "Yasir|kelly cc"). Each row already
// represents a single collaborator's payout, so we take only
// the first name before "|" as the canonical artist name.
// ============================================================
export function normalizeArtistName(raw: string): string {
  if (!raw) return ''
  // Split on "|" and take the first non-empty segment
  const parts = raw.split('|').map(s => s.trim()).filter(Boolean)
  return parts[0] ?? raw.trim()
}

// ============================================================
// Normalize sale_period to "YYYY-MM" format
// Handles:
//   - "Jan-26" / "Feb-25" (TuneOrchard / Global Sound Stars format)
//   - "2026-01-01~2026-01-31" (SoundOn range format)
//   - "2026-01-15" (full date)
//   - "2026-01" (already correct)
// ============================================================
const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

export function normalizeSalePeriod(raw: string): string {
  if (!raw || raw === 'Unknown') return 'Unknown'
  const s = raw.trim()

  // "Jan-26" or "Jan-2026" format (TuneOrchard / Global Sound Stars)
  const monYearMatch = s.match(/^([A-Za-z]{3})[-\s](\d{2,4})$/)
  if (monYearMatch) {
    const mon = MONTH_ABBR[monYearMatch[1].toLowerCase()]
    if (mon) {
      const yr = monYearMatch[2].length === 2 ? `20${monYearMatch[2]}` : monYearMatch[2]
      return `${yr}-${mon}`
    }
  }

  // SoundOn range "2026-01-01~2026-01-31"
  if (s.includes('~')) {
    return s.split('~')[0].slice(0, 7)
  }

  // Full date "2026-01-15" → "2026-01"
  if (s.length > 7 && /^\d{4}-\d{2}/.test(s)) {
    return s.slice(0, 7)
  }

  return s
}

// ============================================================
// Find the data header row (skip preamble / metadata lines)
// ============================================================
function scoreRow(row: (string | number)[]): number {
  let score = 0
  for (const cell of row) {
    const key = (cell ?? '').toString().toLowerCase().trim()
    if (!key) continue
    for (const keywords of Object.values(FIELD_KEYWORDS)) {
      for (const kw of keywords) {
        if (key === kw || key.includes(kw) || kw.includes(key)) {
          score++
          break
        }
      }
    }
  }
  return score
}

function findHeaderRow(rows: (string | number)[][]): number {
  // First pass: look for a row that contains clear header markers
  // These are unambiguous column names that only appear in the real header row
  const STRONG_HEADER_MARKERS = [
    'statement period', 'transaction type', 'collaborator share',
    'isrc', 'display upc', 'track artists',
  ]
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i]
    if (!row || row.length < 3) continue
    const cells = row.map(c => (c ?? '').toString().toLowerCase().trim())
    const hits = STRONG_HEADER_MARKERS.filter(m => cells.includes(m))
    if (hits.length >= 2) return i  // found 2+ strong markers → this is the header
  }

  // Fallback: pick the row with the highest keyword score
  let bestIdx = 0
  let bestScore = 0
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue
    const s = scoreRow(row)
    if (s > bestScore) {
      bestScore = s
      bestIdx = i
    }
  }
  return bestIdx
}

// ============================================================
// Map headers to column indices — exact match wins over partial
// ============================================================
function mapHeaders(headerRow: (string | number)[]): Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number } {
  const map: Partial<Record<keyof RoyaltyRow, number>> & { _trackArtistIdx?: number } = {}

  // Pass 0: priority overrides — these exact headers always win
  const PRIORITY_EXACT: Partial<Record<keyof RoyaltyRow, string[]>> = {
    earnings_usd: ['collaborator share', 'final royalty', 'earnings (usd)', 'royalty amount (usd)', 'royalty amount'],
    quantity:     ['units of sold', 'units sold', 'quantity'],
    artist_name:  ['track artists', 'artist name'],
    // TuneOrchard: "Track" column is the song title, "Track Artists" is the artist
    song_title:   ['track title', 'track', 'song title'],
    store:        ['store name', 'store'],
    country:      ['sales region', 'country of sale', 'country'],
    sale_period:  ['reporting date', 'sale period', 'statement period', 'period'],
  }
  for (const [field, priorityKeys] of Object.entries(PRIORITY_EXACT) as [keyof RoyaltyRow, string[]][]) {
    for (const pk of priorityKeys) {
      const idx = headerRow.findIndex(h => (h ?? '').toString().toLowerCase().trim() === pk)
      if (idx !== -1) {
        // Special case: "track" alone should NOT map to the "track artists" column
        if (field === 'song_title' && pk === 'track') {
          const colName = (headerRow[idx] ?? '').toString().toLowerCase().trim()
          if (colName === 'track artists') continue
        }
        map[field] = idx
        break
      }
    }
  }

  // Pass 1: exact matches for remaining unmapped fields
  headerRow.forEach((h, i) => {
    const key = (h ?? '').toString().toLowerCase().trim()
    if (!key) return
    for (const [field, keywords] of Object.entries(FIELD_KEYWORDS) as [keyof RoyaltyRow, string[]][]) {
      if (map[field] !== undefined) continue
      if (keywords.includes(key)) {
        map[field] = i
        break
      }
    }
  })

  // Pass 2: partial/fuzzy matches for fields still unmapped
  // Columns that look like rates/percentages — never map these as earnings
  const RATE_COLUMN_EXCLUSIONS = [
    'royalty basis', 'tax %', 'tax rate', 'rate', 'basis',
    'share %', 'percentage', 'transaction type', 'transaction type description',
    'currency', 'isrc', 'upc', 'project code', 'product code', 'label',
  ]

  headerRow.forEach((h, i) => {
    const key = (h ?? '').toString().toLowerCase().trim()
    if (!key) return
    // Skip columns that are clearly rates, not amounts
    if (RATE_COLUMN_EXCLUSIONS.some(exc => key === exc || key.includes(exc))) return
    for (const [field, keywords] of Object.entries(FIELD_KEYWORDS) as [keyof RoyaltyRow, string[]][]) {
      if (map[field] !== undefined) continue
      // Sort keywords by length descending so longer/more specific matches win
      const sorted = [...keywords].sort((a, b) => b.length - a.length)
      for (const kw of sorted) {
        if (key.includes(kw) || kw.includes(key)) {
          map[field] = i
          break
        }
      }
    }
  })

  // ── Label/distributor report detection ──────────────────────────────────────
  // When both "Artist" and "Track Artists" columns exist, "Artist" typically
  // contains the label/distributor name (not the real artist). In that case,
  // store the "Track Artists" index separately so parseRow can prefer it.
  let genericArtistIdx: number | undefined
  let trackArtistIdx: number | undefined

  headerRow.forEach((h, i) => {
    const key = (h ?? '').toString().toLowerCase().trim()
    if (key === 'artist') genericArtistIdx = i
    if (key === 'track artists') trackArtistIdx = i
  })

  if (genericArtistIdx !== undefined && trackArtistIdx !== undefined) {
    // Keep the "Artist" col index as a fallback but prefer "Track Artists"
    map._trackArtistIdx = trackArtistIdx
  }

  return map as Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number }
}

// ============================================================
// Parse a data row
// ============================================================
function parseRow(
  row: (string | number)[],
  colMap: Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number }
): RoyaltyRow | null {
  const get = (field: keyof RoyaltyRow): string => {
    const idx = colMap[field]
    if (idx === undefined) return ''
    return (row[idx] ?? '').toString().trim()
  }

  // If the report has both "Artist" and "Track Artists" columns, prefer
  // "Track Artists" — in label/distributor reports the "Artist" column
  // holds the label name, not the actual artist.
  const getArtist = (): string => {
    if (colMap._trackArtistIdx !== undefined) {
      const trackArtist = (row[colMap._trackArtistIdx] ?? '').toString().trim()
      if (trackArtist) return normalizeArtistName(trackArtist)
    }
    return normalizeArtistName(get('artist_name'))
  }

  const rawEarnings = get('earnings_usd')
    .replace(/[$€£¥,\s]/g, '')
    .replace(/\(([^)]+)\)/, '-$1')

  const rawQty = get('quantity').replace(/[,\s]/g, '')

  const earnings = parseFloat(rawEarnings)
  const quantity = parseInt(rawQty, 10)

  if (isNaN(earnings) && isNaN(quantity)) return null

  // Skip repeated header rows — match exact header values only
  const earningsRaw = get('earnings_usd').toLowerCase()
  const headerWords = ['earnings', 'amount', 'revenue', 'usd', 'income', 'final royalty', 'royalty']
  if (headerWords.includes(earningsRaw)) return null

  const nonEmpty = row.filter(c => c && c.toString().trim()).length
  if (nonEmpty < 2) return null

  const rawCountry = get('country')

  // Normalize sale_period to YYYY-MM
  const salePeriod = normalizeSalePeriod(get('sale_period') || 'Unknown')

  return {
    sale_period:  salePeriod,
    store:        get('store')        || 'Unknown',
    country:      expandCountryCode(rawCountry),
    artist_name:  getArtist()         || 'Unknown',
    song_title:   get('song_title')   || 'Unknown',
    album_name:   get('album_name')   || '',
    quantity:     isNaN(quantity)  ? 0 : quantity,
    earnings_usd: isNaN(earnings)  ? 0 : earnings,
  }
}

// ============================================================
// Mixed row parser — uses textRow for strings/dates, numRow for
// earnings and quantity to preserve full numeric precision.
// ============================================================
function parseRowMixed(
  textRow: string[],
  numRow: (string | number)[],
  colMap: Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number }
): RoyaltyRow | null {
  // Text fields come from the formatted row (raw:false)
  const getText = (field: keyof RoyaltyRow): string => {
    const idx = colMap[field]
    if (idx === undefined) return ''
    return (textRow[idx] ?? '').toString().trim()
  }
  // Numeric fields come from the raw row (raw:true) for full precision
  const getNum = (field: keyof RoyaltyRow): number => {
    const idx = colMap[field]
    if (idx === undefined) return NaN
    const v = numRow[idx]
    if (typeof v === 'number') return v
    const parsed = parseFloat(String(v ?? '').replace(/[$€£¥,\s]/g, '').replace(/\(([^)]+)\)/, '-$1'))
    return parsed
  }

  const earnings = getNum('earnings_usd')
  const quantity = (() => {
    const idx = colMap['quantity']
    if (idx === undefined) return NaN
    const v = numRow[idx]
    if (typeof v === 'number') return Math.round(v)
    return parseInt(String(v ?? '').replace(/[,\s]/g, ''), 10)
  })()

  if (isNaN(earnings) && isNaN(quantity)) return null

  // Skip repeated header rows
  const earningsText = getText('earnings_usd').toLowerCase()
  const headerWords = ['earnings', 'amount', 'revenue', 'usd', 'income', 'final royalty', 'royalty']
  if (headerWords.includes(earningsText)) return null

  const nonEmpty = textRow.filter(c => c && c.toString().trim()).length
  if (nonEmpty < 2) return null

  const getArtist = (): string => {
    if (colMap._trackArtistIdx !== undefined) {
      const ta = (textRow[colMap._trackArtistIdx] ?? '').toString().trim()
      if (ta) return normalizeArtistName(ta)
    }
    return normalizeArtistName(getText('artist_name'))
  }

  const salePeriod = normalizeSalePeriod(getText('sale_period') || 'Unknown')

  return {
    sale_period:  salePeriod,
    store:        getText('store')     || 'Unknown',
    country:      expandCountryCode(getText('country')),
    artist_name:  getArtist()          || 'Unknown',
    song_title:   getText('song_title')|| 'Unknown',
    album_name:   getText('album_name')|| '',
    quantity:     isNaN(quantity)  ? 0 : quantity,
    earnings_usd: isNaN(earnings)  ? 0 : earnings,
  }
}

function toRawFraudRowMixed(
  textRow: string[],
  numRow: (string | number)[],
  colMap: Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number },
  txCols: { codeIdx: number; descIdx: number }
): RawFraudRow | null {
  const getText = (field: keyof RoyaltyRow) => {
    const idx = colMap[field]
    return idx !== undefined ? (textRow[idx] ?? '').toString().trim() : ''
  }
  const txCode = txCols.codeIdx >= 0 ? (textRow[txCols.codeIdx] ?? '').toString().trim() : ''
  const txDesc = txCols.descIdx >= 0 ? (textRow[txCols.descIdx] ?? '').toString().trim() : ''

  const qtyRaw = numRow[colMap['quantity'] ?? -1]
  const earnRaw = numRow[colMap['earnings_usd'] ?? -1]
  const qty  = typeof qtyRaw  === 'number' ? Math.round(qtyRaw)  : parseInt(String(qtyRaw  ?? '').replace(/[,\s]/g, ''), 10)
  const earn = typeof earnRaw === 'number' ? earnRaw : parseFloat(String(earnRaw ?? '').replace(/[$€£¥,\s]/g, '').replace(/\(([^)]+)\)/, '-$1'))

  if (isNaN(qty) && isNaN(earn)) return null

  const getArtist = () => {
    if (colMap._trackArtistIdx !== undefined) {
      const ta = (textRow[colMap._trackArtistIdx] ?? '').toString().trim()
      if (ta) return normalizeArtistName(ta)
    }
    return normalizeArtistName(getText('artist_name'))
  }

  let salePeriod = normalizeSalePeriod(getText('sale_period') || 'Unknown')

  return {
    isFraud:      isFraudulentTransaction(txCode, txDesc),
    song_title:   getText('song_title')  || 'Unknown',
    artist_name:  getArtist()            || 'Unknown',
    store:        getText('store')       || 'Unknown',
    country:      expandCountryCode(getText('country')),
    sale_period:  salePeriod,
    quantity:     isNaN(qty)  ? 0 : qty,
    earnings_usd: isNaN(earn) ? 0 : earn,
  }
}

// ============================================================
// Main export
// ============================================================
export async function parseDistroKidFile(file: File): Promise<RoyaltyRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['xlsx', 'xls'].includes(ext)) return parseExcel(file)
  return parseDelimited(file)
}

// ============================================================
// Delimited (CSV, TSV, TXT, and anything else)
// ============================================================
async function parseDelimited(file: File): Promise<RoyaltyRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? ''
      const sample = text.slice(0, 3000)

      const tabCount   = (sample.match(/\t/g)  ?? []).length
      const commaCount = (sample.match(/,/g)   ?? []).length
      const pipeCount  = (sample.match(/\|/g)  ?? []).length
      const semiCount  = (sample.match(/;/g)   ?? []).length

      const max = Math.max(tabCount, commaCount, pipeCount, semiCount)
      let delimiter = ','
      if (tabCount   === max) delimiter = '\t'
      else if (pipeCount  === max) delimiter = '|'
      else if (semiCount  === max) delimiter = ';'

      Papa.parse(text, {
        delimiter,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows = results.data as string[][]
            if (rows.length < 2) { resolve([]); return }

            const headerIdx = findHeaderRow(rows)
            const colMap    = mapHeaders(rows[headerIdx])

            if (import.meta.env.DEV) {
              console.log('[Parser] delimiter:', JSON.stringify(delimiter))
              console.log('[Parser] headerIdx:', headerIdx)
              console.log('[Parser] header:', rows[headerIdx])
              console.log('[Parser] colMap:', colMap)
            }

            const parsed = rows
              .slice(headerIdx + 1)
              .map(row => parseRow(row, colMap))
              .filter((r): r is RoyaltyRow => r !== null)

            resolve(parsed)
          } catch (err) { reject(err) }
        },
        error: reject,
      })
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file, 'utf-8')
  })
}

// ============================================================
// Excel
// ============================================================
async function parseExcel(file: File): Promise<RoyaltyRow[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  // Read twice:
  // - raw:false → formatted strings for text/date columns (sale_period, country, store, etc.)
  // - raw:true  → exact numeric values for earnings and quantity (avoids decimal truncation)
  let textRows: string[][] = []
  let numRows:  (string | number)[][] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const t = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false }) as string[][]
    const n = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', raw: true }) as (string | number)[][]
    if (t.length > textRows.length) { textRows = t; numRows = n }
  }

  if (textRows.length < 2) return []

  const headerIdx = findHeaderRow(textRows)
  const colMap    = mapHeaders(textRows[headerIdx])

  if (import.meta.env.DEV) {
    console.log('[Parser] Excel headerIdx:', headerIdx)
    console.log('[Parser] Excel header:', textRows[headerIdx])
    console.log('[Parser] Excel colMap:', colMap)
    console.warn('[Parser] earnings_usd mapped to col:', colMap.earnings_usd, '→', textRows[headerIdx]?.[colMap.earnings_usd ?? -1])
    console.warn('[Parser] quantity mapped to col:', colMap.quantity, '→', textRows[headerIdx]?.[colMap.quantity ?? -1])
  }

  return textRows
    .slice(headerIdx + 1)
    .map((row, i) => parseRowMixed(row, numRows[headerIdx + 1 + i] ?? row, colMap))
    .filter((r): r is RoyaltyRow => r !== null)
}

// ============================================================
// Fraud detection
// ============================================================

export interface FraudRow {
  song_title:  string
  artist_name: string
  store:       string
  country:     string
  sale_period: string
  quantity:    number
  earnings_usd: number
}

export interface FraudReport {
  fraudStreams:   number
  totalStreams:   number
  fraudPct:       number        // 0–100
  fraudEarnings:  number
  isAlert:        boolean       // true when fraudPct > FRAUD_ALERT_THRESHOLD
  bySong:         Array<{ name: string; streams: number; earnings: number }>
  byCountry:      Array<{ name: string; streams: number }>
  byStore:        Array<{ name: string; streams: number }>
  rows:           FraudRow[]
}

const FRAUD_ALERT_THRESHOLD = 5   // percent

/** Parse the raw file again keeping ALL rows (including fraudulent) to build the fraud report. */
export async function detectFraudulentStreams(file: File): Promise<FraudReport> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const allRows = ['xlsx', 'xls'].includes(ext)
    ? await parseFraudExcel(file)
    : await parseFraudDelimited(file)

  const fraudRows  = allRows.filter(r => r.isFraud)
  const totalStreams = allRows.reduce((s, r) => s + r.quantity, 0)
  const fraudStreams = fraudRows.reduce((s, r) => s + r.quantity, 0)
  const fraudEarnings = fraudRows.reduce((s, r) => s + r.earnings_usd, 0)
  const fraudPct = totalStreams > 0 ? (fraudStreams / totalStreams) * 100 : 0

  // aggregate helpers
  const agg = <K extends keyof FraudRow>(rows: typeof fraudRows, key: K) => {
    const map: Record<string, { streams: number; earnings: number }> = {}
    rows.forEach(r => {
      const k = String(r[key] ?? 'Unknown')
      if (!map[k]) map[k] = { streams: 0, earnings: 0 }
      map[k].streams  += r.quantity
      map[k].earnings += r.earnings_usd
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.streams - a.streams)
  }

  return {
    fraudStreams,
    totalStreams,
    fraudPct,
    fraudEarnings,
    isAlert: fraudPct > FRAUD_ALERT_THRESHOLD,
    bySong:    agg(fraudRows, 'song_title'),
    byCountry: agg(fraudRows, 'country'),
    byStore:   agg(fraudRows, 'store'),
    rows: fraudRows.map(({ isFraud: _f, ...r }) => r),
  }
}

// ── Internal extended row type ─────────────────────────────
interface RawFraudRow extends FraudRow { isFraud: boolean }

function isFraudulentTransaction(code: string, desc: string): boolean {
  // Code column: "FS" = Fraudulent Streams
  if (code.trim().toUpperCase() === 'FS') return true
  // Description column fallback
  if (desc.toLowerCase().includes('fraudulent')) return true
  return false
}

async function parseFraudDelimited(file: File): Promise<RawFraudRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? ''
      const sample = text.slice(0, 3000)
      const tabCount   = (sample.match(/\t/g)  ?? []).length
      const commaCount = (sample.match(/,/g)   ?? []).length
      const pipeCount  = (sample.match(/\|/g)  ?? []).length
      const semiCount  = (sample.match(/;/g)   ?? []).length
      const max = Math.max(tabCount, commaCount, pipeCount, semiCount)
      let delimiter = ','
      if (tabCount  === max) delimiter = '\t'
      else if (pipeCount === max) delimiter = '|'
      else if (semiCount === max) delimiter = ';'

      Papa.parse(text, {
        delimiter,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows = results.data as string[][]
            if (rows.length < 2) { resolve([]); return }
            const headerIdx = findHeaderRow(rows)
            const colMap    = mapHeaders(rows[headerIdx])
            const txCols    = findTransactionTypeCol(rows[headerIdx])
            resolve(
              rows.slice(headerIdx + 1).map(r => toRawFraudRow(r, colMap, txCols)).filter(Boolean) as RawFraudRow[]
            )
          } catch (err) { reject(err) }
        },
        error: reject,
      })
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file, 'utf-8')
  })
}

async function parseFraudExcel(file: File): Promise<RawFraudRow[]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  let textRows: string[][] = []
  let numRows:  (string | number)[][] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const t = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false }) as string[][]
    const n = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', raw: true }) as (string | number)[][]
    if (t.length > textRows.length) { textRows = t; numRows = n }
  }
  if (textRows.length < 2) return []
  const headerIdx = findHeaderRow(textRows)
  const colMap    = mapHeaders(textRows[headerIdx])
  const txCols    = findTransactionTypeCol(textRows[headerIdx])

  if (import.meta.env.DEV) {
    console.log('[FraudParser] Excel headerIdx:', headerIdx)
    console.log('[FraudParser] Excel header:', textRows[headerIdx])
    console.log('[FraudParser] txCols:', txCols)
  }

  return textRows.slice(headerIdx + 1).map((row, i) => {
    const numRow = numRows[headerIdx + 1 + i] ?? row
    return toRawFraudRowMixed(row, numRow, colMap, txCols)
  }).filter(Boolean) as RawFraudRow[]
}

function findTransactionTypeCol(headerRow: (string | number)[]): { codeIdx: number; descIdx: number } {
  let codeIdx = -1
  let descIdx = -1
  headerRow.forEach((h, i) => {
    const key = (h ?? '').toString().toLowerCase().trim()
    // "Transaction Type" (the short code col: FS, S, AS, etc.)
    if (key === 'transaction type') codeIdx = i
    // "Transaction Type Description" (the human-readable col)
    if (key === 'transaction type description' || key === 'transaction_type_description') descIdx = i
    // Also catch partial matches as fallback
    if (codeIdx === -1 && key.includes('transaction') && !key.includes('description')) codeIdx = i
    if (descIdx === -1 && key.includes('description') && key.includes('type')) descIdx = i
  })
  return { codeIdx, descIdx }
}

function toRawFraudRow(
  row: (string | number)[],
  colMap: Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number },
  txCols: { codeIdx: number; descIdx: number }
): RawFraudRow | null {
  const get = (field: keyof RoyaltyRow) => {
    const idx = colMap[field]
    return idx !== undefined ? (row[idx] ?? '').toString().trim() : ''
  }
  const txCode = txCols.codeIdx >= 0 ? (row[txCols.codeIdx] ?? '').toString().trim() : ''
  const txDesc = txCols.descIdx >= 0 ? (row[txCols.descIdx] ?? '').toString().trim() : ''

  const rawQty  = get('quantity').replace(/[,\s]/g, '')
  const rawEarn = get('earnings_usd').replace(/[$€£¥,\s]/g, '').replace(/\(([^)]+)\)/, '-$1')
  const qty     = parseInt(rawQty, 10)
  const earn    = parseFloat(rawEarn)

  if (isNaN(qty) && isNaN(earn)) return null

  const getArtist = () => {
    if (colMap._trackArtistIdx !== undefined) {
      const ta = (row[colMap._trackArtistIdx] ?? '').toString().trim()
      if (ta) return normalizeArtistName(ta)
    }
    return normalizeArtistName(get('artist_name'))
  }

  const salePeriod = normalizeSalePeriod(get('sale_period') || 'Unknown')

  return {
    isFraud:     isFraudulentTransaction(txCode, txDesc),
    song_title:  get('song_title')  || 'Unknown',
    artist_name: getArtist()        || 'Unknown',
    store:       get('store')       || 'Unknown',
    country:     expandCountryCode(get('country')),
    sale_period: salePeriod,
    quantity:    isNaN(qty)  ? 0 : qty,
    earnings_usd: isNaN(earn) ? 0 : earn,
  }
}

// ============================================================
// Report Summary — official total extraction
// ============================================================

export interface ReportSummary {
  officialReportTotal: number | null
  currency: string
  sheet: string
  cell: string
  detailRowsTotal: number
  difference: number
  differencePercent: number
  source: string
  status: 'Official total found' | 'No official total — using sum of detail rows'
}

/** Labels that indicate an official summary total in the metadata rows */
const OFFICIAL_TOTAL_LABELS = [
  'earned this report',
  'total earnings',
  'report total',
  'total revenue',
  'total royalties',
  'earnings summary',
  'net earnings',
  'total earned',
  'total payout',
  'net payout',
]

function extractOfficialTotal(
  wb: ReturnType<typeof XLSX.read>
): { value: number; sheet: string; cell: string; source: string } | null {
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    // Get raw rows (numeric precision) and text rows side by side
    const textRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false }) as string[][]
    const numRows  = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', raw: true }) as (string | number)[][]

    for (let r = 0; r < Math.min(textRows.length, 40); r++) {
      const row = textRows[r]
      for (let c = 0; c < row.length; c++) {
        const cellText = (row[c] ?? '').toString().toLowerCase().trim()
        if (OFFICIAL_TOTAL_LABELS.some(label => cellText === label || cellText.includes(label))) {
          // Value is usually in the next column of the same row
          for (let vc = c + 1; vc < Math.min(row.length, c + 4); vc++) {
            const rawVal = numRows[r]?.[vc]
            const numVal = typeof rawVal === 'number'
              ? rawVal
              : parseFloat(String(rawVal ?? '').replace(/[$€£¥,\s]/g, ''))
            if (!isNaN(numVal) && numVal > 0) {
              // Convert cell address to A1 notation
              const colLetter = XLSX.utils.encode_col(vc)
              const cellAddr  = `${colLetter}${r + 1}`
              return {
                value: numVal,
                sheet: sheetName,
                cell: cellAddr,
                source: row[c].toString().trim(),
              }
            }
          }
        }
      }
    }
  }
  return null
}

export interface ParseResultWithSummary {
  rows: RoyaltyRow[]
  summary: ReportSummary
}

/** Full parse — returns rows + official total summary */
export async function parseDistroKidFileWithSummary(
  file: File
): Promise<ParseResultWithSummary> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  let rows: RoyaltyRow[]
  let officialTotalInfo: { value: number; sheet: string; cell: string; source: string } | null = null
  let currency = 'USD'

  if (['xlsx', 'xls'].includes(ext)) {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

    // Extract official total from metadata
    officialTotalInfo = extractOfficialTotal(wb)

    // Try to detect currency
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName]
      const textRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false }) as string[][]
      for (const row of textRows.slice(0, 20)) {
        for (const cell of row) {
          const v = (cell ?? '').toString().trim().toUpperCase()
          if (['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(v)) { currency = v; break }
        }
      }
    }

    rows = await parseExcel(file)
  } else {
    rows = await parseDelimited(file)
  }

  const detailRowsTotal = rows.reduce((sum, r) => sum + r.earnings_usd, 0)

  if (officialTotalInfo) {
    const diff    = officialTotalInfo.value - detailRowsTotal
    const diffPct = officialTotalInfo.value > 0
      ? Math.abs(diff / officialTotalInfo.value) * 100
      : 0
    return {
      rows,
      summary: {
        officialReportTotal: officialTotalInfo.value,
        currency,
        sheet: officialTotalInfo.sheet,
        cell: officialTotalInfo.cell,
        detailRowsTotal: Math.round(detailRowsTotal * 1e8) / 1e8,
        difference: Math.round(diff * 1e8) / 1e8,
        differencePercent: Math.round(diffPct * 100) / 100,
        source: officialTotalInfo.source,
        status: 'Official total found',
      },
    }
  }

  return {
    rows,
    summary: {
      officialReportTotal: null,
      currency,
      sheet: '',
      cell: '',
      detailRowsTotal: Math.round(detailRowsTotal * 1e8) / 1e8,
      difference: 0,
      differencePercent: 0,
      source: '',
      status: 'No official total — using sum of detail rows',
    },
  }
}

// ============================================================
// Summary helpers
// ============================================================
export function summarizeByField<K extends keyof RoyaltyRow>(
  rows: RoyaltyRow[],
  field: K
): Array<{ name: string; earnings: number; streams: number }> {
  const map: Record<string, { earnings: number; streams: number }> = {}
  rows.forEach(r => {
    const key = String(r[field] || 'Unknown')
    if (!map[key]) map[key] = { earnings: 0, streams: 0 }
    map[key].earnings += r.earnings_usd
    map[key].streams  += r.quantity
  })
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.earnings - a.earnings)
}
