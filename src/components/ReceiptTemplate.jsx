import { formatOrderReference } from '../utils/helpers';
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
    <div id="print-receipt" style={{ padding: '16pt 36pt', fontFamily: '"Times New Roman", Times, serif', color: 'black', fontSize: '10.5pt' }}>
      <div style={{ textAlign: 'left', marginBottom: '10pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <img src="/header.png" alt="Cleaneco Header" style={{ width: '100%', maxWidth: '800px', marginBottom: '8pt' }} />
        <div style={{ color: '#808080', margin: 0, fontSize: '10.5pt', fontWeight: 'bold' }}>CLEANECO WASTE MANAGEMENT SERVICES</div>
        <div style={{ height: '3pt' }}></div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Tel. Nos.: (046) 477-0354 • 09173044157</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>E-mail: cleaneco@cwms.com.ph</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Website: www.cwms.com.ph</div>
      </div>

      <div style={{ margin: '10pt 0 8pt 0', lineHeight: '1.25' }}>
        <div style={{ marginBottom: '6pt' }}>Date: {new Date().toLocaleDateString('en-US')}</div>
        <div style={{ fontWeight: 'bold' }}>ISSUED TO: {receiptOrder.first_name || sessionStorage.getItem('userName')} {receiptOrder.last_name || ''}</div>
        {receiptOrder.address && <div>{receiptOrder.address}</div>}
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12.5pt', margin: '10pt 0', textTransform: 'uppercase' }}>OFFICIAL RECEIPT</div>

      <div style={{ lineHeight: '1.25', marginBottom: '10pt', fontSize: '10pt' }}>
        <div style={{ marginBottom: '3pt' }}>Thank you for choosing Cleaneco Waste Management Services! This receipt confirms the completion and payment for Order ID: <strong>{formatOrderReference(receiptOrder.order_id)}</strong> <span style={{ fontSize: '8.5pt', color: '#666' }}>({receiptOrder.order_id})</span>.</div>
        <div>Service: {serviceDisplay}</div>
        <div>
          Execution Date: {formatDate(receiptOrder.service_execution_date || receiptOrder.date)}{receiptOrder.service_execution_time_slot || receiptOrder.time_slot ? ` (${receiptOrder.service_execution_time_slot || receiptOrder.time_slot})` : ''}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6pt', marginBottom: '10pt', fontSize: '10pt' }}>
        <thead>
          <tr>
            <th style={{ padding: '6pt 8pt', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Description</th>
            <th style={{ padding: '6pt 8pt', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f0f0f0', width: '155px', whiteSpace: 'nowrap' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {serviceBreakdowns.map((section, sIdx) => (
            <React.Fragment key={section.serviceId || sIdx}>
              <tr>
                {serviceBreakdowns.length > 1 ? (
                  <>
                    <td style={{ padding: '6pt 8pt', border: '1px solid #000', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#f8fafc' }}>
                      {section.serviceName}
                      {section.baseRate > 0 && (
                        <span style={{ fontWeight: 'normal', fontSize: '9pt', color: '#555', marginLeft: '6pt' }}>
                          (Base Unit Rate: {formatPHP(section.baseRate)})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6pt 8pt', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f8fafc', whiteSpace: 'nowrap' }}>
                      {formatPHP(section.subtotal)}
                    </td>
                  </>
                ) : (
                  <td colSpan="2" style={{ padding: '6pt 8pt', border: '1px solid #000', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#f8fafc' }}>
                    {section.serviceName}
                    {section.baseRate > 0 && (
                      <span style={{ fontWeight: 'normal', fontSize: '9pt', color: '#555', marginLeft: '6pt' }}>
                        (Base Unit Rate: {formatPHP(section.baseRate)})
                      </span>
                    )}
                  </td>
                )}
              </tr>
              {section.items.map((item, iIdx) => (
                <tr key={item.key || iIdx}>
                  <td style={{ padding: '5pt 8pt 5pt 18pt', border: '1px solid #000' }}>
                    <div>
                      <strong>{item.label}:</strong> {item.displayValue}
                    </div>
                    {item.formulaNote && (
                      <div style={{ fontSize: '8.5pt', color: '#555', marginTop: '1.5pt' }}>
                        {item.formulaNote}
                      </div>
                    )}
                    {item.justification && (
                      <div style={{ fontSize: '9pt', fontStyle: 'italic', marginTop: '1.5pt' }}>
                        Note: {item.justification}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '5pt 8pt', border: '1px solid #000', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatPHP(item.amount)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12pt', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <table style={{ minWidth: '260px', width: 'auto', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3pt 10pt', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Subtotal:</td>
              <td style={{ padding: '3pt 6pt', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(originalPrice)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td style={{ padding: '3pt 10pt', textAlign: 'right', fontWeight: 'bold', color: 'red', whiteSpace: 'nowrap' }}>Less Discount:</td>
                <td style={{ padding: '3pt 6pt', textAlign: 'right', color: 'red', whiteSpace: 'nowrap' }}>{formatPHP(discountAmount, true)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '3pt 10pt', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Quotation Total:</td>
              <td style={{ padding: '3pt 6pt', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(basePrice)}</td>
            </tr>
            <tr>
              <td style={{ padding: '3pt 10pt', textAlign: 'right', fontWeight: 'bold', color: '#666', whiteSpace: 'nowrap' }}>Service Tax (10%):</td>
              <td style={{ padding: '3pt 6pt', textAlign: 'right', color: '#666', whiteSpace: 'nowrap' }}>{formatPHP(taxAmount)}</td>
            </tr>
            <tr>
              <td style={{ padding: '3pt 10pt', textAlign: 'right', fontWeight: 'bold', color: 'red', whiteSpace: 'nowrap' }}>Less Reservation Paid:</td>
              <td style={{ padding: '3pt 6pt', textAlign: 'right', color: 'red', whiteSpace: 'nowrap' }}>{formatPHP(reservationPaid, true)}</td>
            </tr>
            <tr>
              <td style={{ padding: '4pt 10pt', textAlign: 'right', fontWeight: 'bold', fontSize: '10.5pt', borderTop: '1.5px solid #000', whiteSpace: 'nowrap' }}>Total Paid:</td>
              <td style={{ padding: '4pt 6pt', textAlign: 'right', fontWeight: 'bold', fontSize: '10.5pt', borderTop: '1.5px solid #000', whiteSpace: 'nowrap' }}>{formatPHP(totalPaid)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReceiptTemplate;
