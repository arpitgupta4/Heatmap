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
    securityId:  row['Security Id'] || row['Name'] || '',
    name:        row['Sector Name'] || row['Name'] || row['Security Id'] || '',
    industry:    row['Industry New Name'] || row['Industry'] || '',
    group:       row['Igroup Name'] || row['Group'] || '',
    subgroup:    row['ISubgroup Name'] || row['Subgroup'] || '',
    dailyChange: parseNumber(
      row['%Change'] || row['Daily Chang'] || row['Daily Change'] ||
      row['% Change'] || row['Daily %change'] || ''
    ),
    change: parseNumber(row['Daily Change'] || row['Change'] || 0),
    ltp:    parseNumber(row['LTP'] || row['Close'] || row['Last Price'] || 0),
  };
}

module.exports = { normalizeRadarRow, normalizeStockRow };
