import React from 'react';
import { formatDate, formatPHP } from '../utils/helpers';

const BillingTemplate = ({ billingOrder }) => {
  if (!billingOrder) return null;

  const basePrice = billingOrder.final_price || billingOrder.price || 0;
  const originalPrice = billingOrder.price || billingOrder.base_estimate || 0;
  const discountAmount = billingOrder.discount_amount || 0;
  const taxAmount = basePrice * 0.1;
  const reservationPaid = 1100;
  const remainingBalance = Math.max(0, (basePrice * 1.1) - reservationPaid);

  return (
    <div id="print-billing" style={{ padding: '40pt', fontFamily: '"Times New Roman", Times, serif', color: 'black', fontSize: '12pt' }}>
      <div style={{ textAlign: 'left', marginBottom: '20pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <img src="/header.png" alt="Cleaneco Header" style={{ width: '100%', maxWidth: '800px', marginBottom: '15pt' }} />
        <div style={{ color: '#808080', margin: 0, fontSize: '11pt', fontWeight: 'bold' }}>CLEANECO WASTE MANAGEMENT SERVICES</div>
        <div style={{ height: '6pt' }}></div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Tel. Nos.: (046) 477-0354 • 09173044157</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>E-mail: cleaneco@cwms.com.ph</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Website: www.cwms.com.ph</div>
      </div>

      <div style={{ margin: '20pt 0 15pt 0', lineHeight: '1.2' }}>
        <div style={{ marginBottom: '10pt' }}>Date: {new Date().toLocaleDateString('en-US')}</div>
        <div style={{ fontWeight: 'bold' }}>ATTENTION: {billingOrder.first_name || sessionStorage.getItem('userName')} {billingOrder.last_name || ''}</div>
        <div>{billingOrder.address}</div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '20pt 0', textTransform: 'uppercase' }}>FINAL BILLING REPORT</div>

      <div style={{ lineHeight: '1.2', marginBottom: '20pt' }}>
        <div>Order Reference: <strong>{billingOrder.order_id}</strong></div>
        <div>Service: {billingOrder.service_type || billingOrder.service_name}</div>
        <div>Execution Date: {billingOrder.service_execution_date ? formatDate(billingOrder.service_execution_date) : formatDate(billingOrder.confirmed_date)}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10pt', marginBottom: '20pt' }}>
        <thead>
          <tr>
            <th style={{ padding: '8pt', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>Description</th>
            <th style={{ padding: '8pt', border: '1px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f0f0f0', width: '150px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {billingOrder.estimate_inputs && Object.keys(billingOrder.estimate_inputs).length > 0 ? (
            Object.entries(billingOrder.estimate_inputs).map(([serviceId, inputs], sIdx) => (
              <React.Fragment key={sIdx}>
                <tr>
                  <td colSpan="2" style={{ padding: '8pt', border: '1px solid #000', fontWeight: 'bold', fontStyle: 'italic' }}>
                    Service Configuration (ID: {serviceId})
                  </td>
                </tr>
                {Object.entries(inputs).map(([key, value], iIdx) => {
                  const label = key === 'numTanks' ? 'Number of Septic Tanks' : key === 'capacityType' ? 'Capacity / Type' : key === 'accessibility' ? 'Site Accessibility' : key;
                  let displayValue = value;
                  if (key === 'capacityType') displayValue = value === '1' ? 'Standard (1 Trip)' : 'Large (2+ Trips)';
                  if (key === 'accessibility') displayValue = String(value || 'easy').charAt(0).toUpperCase() + String(value || 'easy').slice(1);
                  const justification = billingOrder.justifications?.[serviceId]?.[key];
                  return (
                    <tr key={iIdx}>
                      <td style={{ padding: '8pt 8pt 8pt 20pt', border: '1px solid #000' }}>
                        <strong>{label}:</strong> {displayValue}
                        {justification && <div style={{ fontSize: '10pt', fontStyle: 'italic', marginTop: '2pt' }}>Note: {justification}</div>}
                      </td>
                      <td style={{ padding: '8pt', border: '1px solid #000', textAlign: 'right' }}>-</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))
          ) : (
            <tr>
              <td style={{ padding: '8pt', border: '1px solid #000' }}>{billingOrder.service_type || billingOrder.service_name} (Base Estimate)</td>
              <td style={{ padding: '8pt', border: '1px solid #000', textAlign: 'right' }}>{formatPHP(billingOrder.base_estimate || 0)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30pt' }}>
        <table style={{ width: '50%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold' }}>Subtotal:</td>
              <td style={{ padding: '5pt 10pt', textAlign: 'right' }}>{formatPHP(originalPrice)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold', color: 'red' }}>Less Discount:</td>
                <td style={{ padding: '5pt 10pt', textAlign: 'right', color: 'red' }}>{formatPHP(discountAmount, true)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold' }}>Quotation Total:</td>
              <td style={{ padding: '5pt 10pt', textAlign: 'right' }}>{formatPHP(basePrice)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold', color: '#666' }}>Service Tax (10%):</td>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', color: '#666' }}>{formatPHP(taxAmount)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold', color: 'red' }}>Less Reservation Paid:</td>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', color: 'red' }}>{formatPHP(reservationPaid, true)}</td>
            </tr>
            <tr>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold', fontSize: '14pt', borderTop: '2px solid #000' }}>Remaining Balance:</td>
              <td style={{ padding: '5pt 10pt', textAlign: 'right', fontWeight: 'bold', fontSize: '14pt', borderTop: '2px solid #000' }}>{formatPHP(remainingBalance)}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default BillingTemplate;
