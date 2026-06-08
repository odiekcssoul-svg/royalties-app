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
    'song', 'track', 'work title', 'song name', 'asset title',
    'content title', 'release title',
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
    // SoundOn exact first
    'final royalty',
    'royalty (usd)', 'royalty amount (usd)', 'royalty amount',
    'total royalty', 'net royalty', 'royalty',
    // DistroKid
    'earnings (usd)', 'earnings', 'you earned', 'your earnings',
    'paid (usd)',
    // Generic
    'net revenue', 'amount (usd)', 'amount',
    'net amount', 'total earnings', 'revenue', 'payment',
    'net', 'usd', 'gross revenue', 'total revenue', 'income',
    'net income', 'payout', 'net payout', 'settlement amount',
    'total amount', 'earning',
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
// Find the data header row (skip preamble / metadata lines)
// ============================================================
function scoreRow(row: string[]): number {
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

function findHeaderRow(rows: string[][]): number {
  let bestIdx = 0
  let bestScore = 0
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue
    const s = scoreRow(row)
    if (s > bestScore) { bestScore = s; bestIdx = i }
    if (s >= 3) break // confident enough
  }
  return bestIdx
}

// ============================================================
// Map headers to column indices — exact match wins over partial
// ============================================================
function mapHeaders(headerRow: string[]): Record<keyof RoyaltyRow, number | undefined> & { _trackArtistIdx?: number } {
  const map: Partial<Record<keyof RoyaltyRow, number>> & { _trackArtistIdx?: number } = {}

  // Pass 1: exact matches only
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
  headerRow.forEach((h, i) => {
    const key = (h ?? '').toString().toLowerCase().trim()
    if (!key) return
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
  row: string[],
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
      if (trackArtist) return trackArtist
    }
    return get('artist_name')
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

  // Normalize sale_period: SoundOn uses "2026-01-01~2026-01-31", extract YYYY-MM
  let salePeriod = get('sale_period') || 'Unknown'
  if (salePeriod.includes('~')) {
    salePeriod = salePeriod.split('~')[0].slice(0, 7) // "2026-01"
  } else if (salePeriod.length > 7) {
    salePeriod = salePeriod.slice(0, 7)
  }

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

  let bestRows: string[][] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false }) as string[][]
    if (raw.length > bestRows.length) bestRows = raw
  }

  if (bestRows.length < 2) return []

  const headerIdx = findHeaderRow(bestRows)
  const colMap    = mapHeaders(bestRows[headerIdx])

  if (import.meta.env.DEV) {
    console.log('[Parser] Excel headerIdx:', headerIdx)
    console.log('[Parser] Excel header:', bestRows[headerIdx])
    console.log('[Parser] Excel colMap:', colMap)
  }

  return bestRows
    .slice(headerIdx + 1)
    .map(row => parseRow(row, colMap))
    .filter((r): r is RoyaltyRow => r !== null)
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
