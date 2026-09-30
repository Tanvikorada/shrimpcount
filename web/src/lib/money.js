export const money = (n) => (Number.isFinite(n) ? `₹${Math.round(n).toLocaleString('en-IN')}` : '–')
export const orderTotal = (o) => (Number(o.plQuantity) / 1000) * Number(o.pricePer1000)
export const orderPaid = (o) => (o.payments || []).reduce((a, p) => a + Number(p.amount || 0), 0)
export const orderBalance = (o) => {
  const t = orderTotal(o)
  return Number.isFinite(t) ? t - orderPaid(o) : NaN
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const below100 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`)
const below1000 = (n) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${below100(n % 100)}`

/** 520000 -> "Rupees Five Lakh Twenty Thousand Only" (Indian grouping). Whole rupees; empty for zero or a non-number. */
export function rupeesInWords(amount) {
  const n = Math.round(Number(amount))
  if (!Number.isFinite(n) || n <= 0) return ''
  const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3
  const words = [
    crore && `${below1000(crore)} Crore`,
    lakh && `${below100(lakh)} Lakh`,
    thousand && `${below100(thousand)} Thousand`,
    rest && below1000(rest),
  ].filter(Boolean).join(' ')
  return `Rupees ${words} Only`
}
