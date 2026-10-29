import React from 'react';
import { formatDate, formatPHP } from '../utils/helpers';
import { buildOrderServiceBreakdowns } from '../utils/pricing';

const BillingTemplate = ({ billingOrder, services = [] }) => {
  if (!billingOrder) return null;

  const serviceBreakdowns = buildOrderServiceBreakdowns(billingOrder, services);
  const computedSubtotal = serviceBreakdowns.reduce((sum, b) => sum + b.subtotal, 0);

  const discountAmount = parseFloat(billingOrder.discount_amount) || 0;
  const basePrice = parseFloat(billingOrder.final_price) || parseFloat(billingOrder.price) || computedSubtotal || 0;
  const originalPrice = (parseFloat(billingOrder.price) && billingOrder.has_final_price)
    ? parseFloat(billingOrder.price)
    : (computedSubtotal || (basePrice + discountAmount));
  const taxAmount = basePrice * 0.1;
  const reservationPaid = 1100;
  const remainingBalance = Math.max(0, (basePrice * 1.1) - reservationPaid);

  const serviceDisplay = (Array.isArray(billingOrder.service_names) && billingOrder.service_names.length > 0)
    ? billingOrder.service_names.join(', ')
    : (billingOrder.service_type || billingOrder.service_name);

  return (
    <div id="print-billing" style={{ padding: '24pt 36pt', fontFamily: '"Times New Roman", Times, serif', color: 'black', fontSize: '11.5pt' }}>
      <div style={{ textAlign: 'left', marginBottom: '14pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <img src="/header.png" alt="Cleaneco Header" style={{ width: '100%', maxWidth: '800px', marginBottom: '12pt' }} />
        <div style={{ color: '#808080', margin: 0, fontSize: '11pt', fontWeight: 'bold' }}>CLEANECO WASTE MANAGEMENT SERVICES</div>
        <div style={{ height: '4pt' }}></div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Tel. Nos.: (046) 477-0354 • 09173044157</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>E-mail: cleaneco@cwms.com.ph</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Website: www.cwms.com.ph</div>
      </div>

      <div style={{ margin: '14pt 0 12pt 0', lineHeight: '1.25' }}>
        <div style={{ marginBottom: '8pt' }}>Date: {new Date().toLocaleDateString('en-US')}</div>
        <div style={{ fontWeight: 'bold' }}>ATTENTION: {billingOrder.first_name || sessionStorage.getItem('userName')} {billingOrder.last_name || ''}</div>
        <div>{billingOrder.address}</div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '14pt 0', textTransform: 'uppercase' }}>FINAL BILLING REPORT</div>

      <div style={{ lineHeight: '1.25', marginBottom: '14pt' }}>
        <div>Order Reference: <strong>{billingOrder.order_id}</strong></div>
        <div>Service: {serviceDisplay}</div>
        <div>Execution Date: {billingOrder.service_execution_date ? formatDate(billingOrder.service_execution_date) : formatDate(billingOrder.confirmed_date || billingOrder.date)}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8pt', marginBottom: '16pt' }}>
        <thead>
          <tr>
            <th style={{ padding: '8pt', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Description</th>
            <th style={{ padding: '8pt', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f0f0f0', width: '165px', whiteSpace: 'nowrap' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {serviceBreakdowns.map((section, sIdx) => (
            <React.Fragment key={section.serviceId || sIdx}>
              <tr>
                {serviceBreakdowns.length > 1 ? (
                  <>
                    <td style={{ padding: '8pt', border: '1px solid #000', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#f8fafc' }}>
                      {section.serviceName}
                      {section.baseRate > 0 && (
                        <span style={{ fontWeight: 'normal', fontSize: '9.5pt', color: '#555', marginLeft: '6pt' }}>
                          (Base Unit Rate: {formatPHP(section.baseRate)})
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8pt', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f8fafc', whiteSpace: 'nowrap' }}>
                      {formatPHP(section.subtotal)}
                    </td>
                  </>
                ) : (
                  <td colSpan="2" style={{ padding: '8pt', border: '1px solid #000', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#f8fafc' }}>
                    {section.serviceName}
                    {section.baseRate > 0 && (
                      <span style={{ fontWeight: 'normal', fontSize: '9.5pt', color: '#555', marginLeft: '6pt' }}>
                        (Base Unit Rate: {formatPHP(section.baseRate)})
                      </span>
                    )}
                  </td>
                )}
              </tr>
              {section.items.map((item, iIdx) => (
                <tr key={item.key || iIdx}>
                  <td style={{ padding: '7pt 8pt 7pt 20pt', border: '1px solid #000' }}>
                    <div>
                      <strong>{item.label}:</strong> {item.displayValue}
                    </div>
                    {item.formulaNote && (
                      <div style={{ fontSize: '9.5pt', color: '#555', marginTop: '2pt' }}>
                        {item.formulaNote}
                      </div>
                    )}
                    {item.justification && (
                      <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2pt' }}>
                        Note: {item.justification}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '7pt 8pt', border: '1px solid #000', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatPHP(item.amount)}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20pt', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <table style={{ minWidth: '320px', width: 'auto', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '5pt 12pt', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Subtotal:</td>
              <td style={{ padding: '5pt 8pt', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(originalPrice)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td style={{ padding: '5pt 12pt', textAlign: 'right', fontWeight: 'bold', color: 'red', whiteSpace: 'nowrap' }}>Less Discount:</td>
                <td style={{ padding: '5pt 8pt', textAlign: 'right', color: 'red', whiteSpace: 'nowrap' }}>{formatPHP(discountAmount, true)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '5pt 12pt', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Quotation Total:</td>
              <td style={{ padding: '5pt 8pt', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatPHP(basePrice)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5pt 12pt', textAlign: 'right', fontWeight: 'bold', color: '#666', whiteSpace: 'nowrap' }}>Service Tax (10%):</td>
              <td style={{ padding: '5pt 8pt', textAlign: 'right', color: '#666', whiteSpace: 'nowrap' }}>{formatPHP(taxAmount)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5pt 12pt', textAlign: 'right', fontWeight: 'bold', color: 'red', whiteSpace: 'nowrap' }}>Less Reservation Paid:</td>
              <td style={{ padding: '5pt 8pt', textAlign: 'right', color: 'red', whiteSpace: 'nowrap' }}>{formatPHP(reservationPaid, true)}</td>
            </tr>
            <tr>
              <td style={{ padding: '6pt 12pt', textAlign: 'right', fontWeight: 'bold', fontSize: '13.5pt', borderTop: '2px solid #000', whiteSpace: 'nowrap' }}>Remaining Balance:</td>
              <td style={{ padding: '6pt 8pt', textAlign: 'right', fontWeight: 'bold', fontSize: '13.5pt', borderTop: '2px solid #000', whiteSpace: 'nowrap' }}>{formatPHP(remainingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default BillingTemplate;
