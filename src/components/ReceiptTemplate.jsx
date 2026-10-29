import React from 'react';
import { formatDate, formatPHP } from '../utils/helpers';
import { buildOrderServiceBreakdowns } from '../utils/pricing';

const ReceiptTemplate = ({ receiptOrder, services = [] }) => {
  if (!receiptOrder) return null;

  const serviceBreakdowns = buildOrderServiceBreakdowns(receiptOrder, services);
  const computedSubtotal = serviceBreakdowns.reduce((sum, b) => sum + b.subtotal, 0);

  const discountAmount = parseFloat(receiptOrder.discount_amount) || 0;
  const basePrice = parseFloat(receiptOrder.final_price) || parseFloat(receiptOrder.price) || computedSubtotal || 0;
  const originalPrice = (parseFloat(receiptOrder.price) && receiptOrder.has_final_price)
    ? parseFloat(receiptOrder.price)
    : (computedSubtotal || (basePrice + discountAmount));
  const taxAmount = basePrice * 0.1;
  const reservationPaid = 1100;
  const totalPaid = Math.max(0, (basePrice * 1.1) - reservationPaid);

  const serviceDisplay = (Array.isArray(receiptOrder.service_names) && receiptOrder.service_names.length > 0)
    ? receiptOrder.service_names.join(', ')
    : (receiptOrder.service_name || receiptOrder.service_type);

  return (
    <div id="print-receipt" style={{ padding: '24pt 36pt', fontFamily: '"Times New Roman", Times, serif', color: 'black', fontSize: '11pt' }}>
      <div style={{ textAlign: 'left', marginBottom: '14pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <img src="/header.png" alt="Cleaneco Header" style={{ width: '100%', maxWidth: '800px', marginBottom: '12pt' }} />
        <div style={{ color: '#808080', margin: 0, fontSize: '11pt', fontWeight: 'bold' }}>CLEANECO WASTE MANAGEMENT SERVICES</div>
        <div style={{ height: '4pt' }}></div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Tel. Nos.: (046) 477-0354 • 09173044157</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>E-mail: cleaneco@cwms.com.ph</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Website: www.cwms.com.ph</div>
      </div>

      <div style={{ margin: '14pt 0 12pt 0', lineHeight: '1.2' }}>
        <div style={{ marginBottom: '8pt' }}>Date: {new Date().toLocaleDateString('en-US')}</div>
        <div style={{ fontWeight: 'bold' }}>ATTENTION: {receiptOrder.first_name || sessionStorage.getItem('userName')} {receiptOrder.last_name || ''}</div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '14pt 0' }}>OFFICIAL RECEIPT</div>

      <div style={{ lineHeight: '1.25' }}>
        <div style={{ marginBottom: '4pt' }}>This receipt confirms the completion and payment for Order ID: <strong>{receiptOrder.order_id}</strong>.</div>
        <div style={{ marginBottom: '4pt' }}>Service provided: {serviceDisplay}</div>
        <div style={{ marginBottom: '12pt' }}>
          Service date: {formatDate(receiptOrder.service_execution_date || receiptOrder.date)} at {receiptOrder.service_execution_time_slot || receiptOrder.time_slot}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8pt', marginBottom: '20pt' }}>
        <thead>
          <tr>
            <th style={{ padding: '7pt 8pt', border: '1px solid #ccc', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#333' }}>Description</th>
            <th style={{ padding: '7pt 8pt', border: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#333', width: '165px', whiteSpace: 'nowrap' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {serviceBreakdowns.map((section, sIdx) => (
            <React.Fragment key={section.serviceId || sIdx}>
              <tr>
                {serviceBreakdowns.length > 1 ? (
                  <>
                    <td style={{ padding: '7pt 8pt', border: '1px solid #ccc', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#f8fafc' }}>
                      {section.serviceName}
                      {section.baseRate > 0 && (
                        <span style={{ fontWeight: 'normal', fontSize: '9.5pt', color: '#666', marginLeft: '6pt' }}>
                          (Base Unit Rate: {formatPHP(section.baseRate)})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '7pt 8pt', border: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f8fafc', whiteSpace: 'nowrap' }}>
                      {formatPHP(section.subtotal)}
                    </td>
                  </>
                ) : (
                  <td colSpan="2" style={{ padding: '7pt 8pt', border: '1px solid #ccc', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#f8fafc' }}>
                    {section.serviceName}
                    {section.baseRate > 0 && (
                      <span style={{ fontWeight: 'normal', fontSize: '9.5pt', color: '#666', marginLeft: '6pt' }}>
                        (Base Unit Rate: {formatPHP(section.baseRate)})
                      </span>
                    )}
                  </td>
                )}
              </tr>
              {section.items.map((item, iIdx) => (
                <tr key={item.key || iIdx}>
                  <td style={{ padding: '6pt 8pt 6pt 18pt', border: '1px solid #ccc' }}>
                    <div>
                      <strong>{item.label}:</strong> {item.displayValue}
                    </div>
                    {item.formulaNote && (
                      <div style={{ fontSize: '9pt', color: '#666', marginTop: '2pt' }}>
                        {item.formulaNote}
                      </div>
                    )}
                    {item.justification && (
                      <div style={{ fontSize: '9.5pt', fontStyle: 'italic', color: '#444', marginTop: '2pt' }}>
                        Note: {item.justification}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatPHP(item.amount)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
          <tr>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', fontWeight: 'bold', textAlign: 'right' }}>Subtotal</td>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(originalPrice)}</td>
          </tr>
          {discountAmount > 0 && (
            <tr>
              <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', color: '#d9534f', fontWeight: 'bold', textAlign: 'right' }}>Less Discount</td>
              <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', color: '#d9534f', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(discountAmount, true)}</td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', fontWeight: 'bold', textAlign: 'right' }}>Quotation Total</td>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(basePrice)}</td>
          </tr>
          <tr>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', color: '#555' }}>Service Tax (10%)</td>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', whiteSpace: 'nowrap', color: '#555' }}>{formatPHP(taxAmount)}</td>
          </tr>
          <tr>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', color: '#d9534f' }}>Less Reservation Paid</td>
            <td style={{ padding: '6pt 8pt', border: '1px solid #ccc', textAlign: 'right', whiteSpace: 'nowrap', color: '#d9534f' }}>{formatPHP(reservationPaid, true)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style={{ padding: '8pt', border: '1px solid #ccc', fontWeight: 'bold', textAlign: 'right' }}>Total Paid</td>
            <td style={{ padding: '8pt', border: '1px solid #ccc', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(totalPaid)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: '20pt', textAlign: 'left', lineHeight: '1.15', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div style={{ fontStyle: 'italic', marginBottom: '18pt' }}>Thank you very much!</div>
        <div style={{ marginBottom: '22pt' }}>Very truly yours,</div>
        <div style={{ marginBottom: '3pt', fontWeight: 'bold' }}>Jayperson Bonavente</div>
        <div>Operation Head</div>
      </div>
    </div>
  );
};

export default ReceiptTemplate;
