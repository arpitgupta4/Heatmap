// ─── Row Normalization ─────────────────────────────────────────────────────────
const { parseNumber } = require('./csv');

function normalizeRadarRow(row) {
  return {
    symbol:    (row['Symbol']    || '').trim(),
    high:      parseNumber(row['High']       || 0),
    prevClose: parseNumber(row['Prev Close'] || 0),
    ltp:       parseNumber(row['LTP']        || 0),
    change:    parseNumber(row['Change']     || 0),
    pctChange: parseNumber(row['%Change']    || 0),
    marketCap: parseNumber(row['MarketCap']  || 0),
  };
}

function normalizeStockRow(row) {
  return {
    securityId:  row['Security Id'] || '',
    // 'Theme' is the new column name; 'Parent Theme' is the old name (kept for backward compat)
    parentTheme: row['Theme'] || row['Parent Theme'] || '',
    // 'Sector' is the new column name; 'Sector Name' is the old name (kept for backward compat)
    sectorName:  row['Sector'] || row['Sector Name'] || '',
    industry:    row['Industry'] || '',
    // 'Daily Change' = absolute Δ (col E), '%Change' = percentage Δ (col F)
    dailyChange: parseNumber(row['%Change'] || row['% Change'] || ''),
    change:      parseNumber(row['Daily Change'] || row['Change'] || 0),
    ltp:         parseNumber(row['LTP'] || row['Close'] || row['Last Price'] || 0),
  };
}

module.exports = { normalizeRadarRow, normalizeStockRow };
