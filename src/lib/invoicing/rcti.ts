// src/lib/invoicing/rcti.ts
//
// A GST-registered grower signs an RCTI agreement on the Membership page
// (farmers.rcti_agreed/rcti_agreed_at/rcti_full_name) authorising The Green
// Guild to issue tax invoices on their behalf — but every invoice document
// used generic "tax invoice for supplies made by X" wording regardless,
// which reads as the grower's own invoice rather than one the platform is
// creating for them under that agreement. ATO requires an RCTI to actually
// be labelled as such to count as one. Centralised here so the exact
// wording is a one-line change, not a three-renderer hunt (buyer's own
// invoice, admin's ledger viewer, and the farmer's own copy all use this).

export function invoiceTitle(isTaxInvoice: boolean, rctiAgreed: boolean): string {
  if (!isTaxInvoice) return 'Invoice'
  return rctiAgreed ? 'Recipient Created Tax Invoice' : 'Tax Invoice'
}

export function invoiceFooterText(params: {
  isTaxInvoice: boolean
  rctiAgreed: boolean
  businessName: string
  rctiFullName?: string | null
  rctiAgreedAt?: string | null
}): string {
  const { isTaxInvoice, rctiAgreed, businessName, rctiFullName, rctiAgreedAt } = params
  const name = businessName || (isTaxInvoice ? 'this grower' : 'This supplier')

  if (!isTaxInvoice) {
    return `${name} is not registered for GST. No GST has been charged on this invoice.`
  }

  if (rctiAgreed) {
    const signedDate = rctiAgreedAt ? new Date(rctiAgreedAt).toLocaleDateString('en-AU') : null
    return `This is a Recipient Created Tax Invoice (RCTI). The Green Guild has created this tax invoice for the supply made by ${name}, under an RCTI agreement${rctiFullName ? ` signed by ${rctiFullName}` : ''}${signedDate ? ` on ${signedDate}` : ''}. GST of 10% applies to applicable items.`
  }

  // GST-registered but no RCTI agreement on file — shouldn't happen given
  // the Membership page blocks saving gst_registered=true without one, but
  // fall back to the honest generic wording rather than falsely claiming
  // an RCTI arrangement that isn't actually on record.
  return `This is a tax invoice for supplies made by ${name}. GST of 10% applies to applicable items.`
}
