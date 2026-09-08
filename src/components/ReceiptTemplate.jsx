import React from 'react';
import { formatDate } from '../utils/helpers';

const ReceiptTemplate = ({ receiptOrder }) => {
  if (!receiptOrder) return null;

  return (
    <div id="print-receipt" style={{ padding: '40pt', fontFamily: '"Times New Roman", Times, serif', color: 'black', fontSize: '11pt' }}>
      <div style={{ textAlign: 'left', marginBottom: '20pt', fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <img src="/header.png" alt="Cleaneco Header" style={{ width: '100%', maxWidth: '800px', marginBottom: '15pt' }} />
        <div style={{ color: '#808080', margin: 0, fontSize: '11pt', fontWeight: 'bold' }}>CLEANECO WASTE MANAGEMENT SERVICES</div>
        <div style={{ height: '6pt' }}></div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Blk 12 Lot 2 and 4 Royal Salute Street, Addas Greenfields, Brgy. Mambog IV, Bacoor City, Cavite</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Tel. Nos.: (046) 477-0354 • 09173044157</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>E-mail: cleaneco@cwms.com.ph</div>
        <div style={{ color: '#008000', margin: 0, fontSize: '9pt', fontWeight: 'bold' }}>Website: www.cwms.com.ph</div>
      </div>

      <div style={{ margin: '20pt 0 15pt 0', lineHeight: '1.0' }}>
        <div style={{ marginBottom: '10pt' }}>Date: {new Date().toLocaleDateString('en-US')}</div>
        <div style={{ fontWeight: 'bold' }}>ATTENTION: {receiptOrder.first_name || sessionStorage.getItem('userName')} {receiptOrder.last_name || ''}</div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', margin: '20pt 0' }}>OFFICIAL RECEIPT</div>

      <div style={{ lineHeight: '1.0' }}>
        <div style={{ marginBottom: '5pt' }}>This receipt confirms the completion and payment for Order ID: <strong>{receiptOrder.order_id}</strong>.</div>
        <div style={{ marginBottom: '5pt' }}>Service provided: {receiptOrder.service_name || receiptOrder.service_type}</div>
        <div style={{ marginBottom: '15pt' }}>Service date: {formatDate(receiptOrder.date)} at {receiptOrder.time_slot}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10pt', marginBottom: '30pt' }}>
        <thead>
          <tr>
            <th style={{ padding: '8pt', border: '1px solid #ccc', textAlign: 'left', fontWeight: 'bold', color: '#a0a0a0' }}>Description</th>
            <th style={{ padding: '8pt', border: '1px solid #ccc', textAlign: 'left', fontWeight: 'bold', color: '#a0a0a0' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '8pt', border: '1px solid #ccc' }}>Base Service Fee</td>
            <td style={{ padding: '8pt', border: '1px solid #ccc' }}>PHP {parseFloat(receiptOrder.price || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style={{ padding: '8pt', border: '1px solid #ccc' }}>Service Tax (10%)</td>
            <td style={{ padding: '8pt', border: '1px solid #ccc' }}>PHP {parseFloat(receiptOrder.tax_amount || (parseFloat(receiptOrder.price || 0) * 0.1)).toFixed(2)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style={{ padding: '8pt', border: '1px solid #ccc', fontWeight: 'bold' }}>Total Paid</td>
            <td style={{ padding: '8pt', border: '1px solid #ccc', fontWeight: 'bold' }}>PHP {(parseFloat(receiptOrder.price || 0) + parseFloat(receiptOrder.tax_amount || (parseFloat(receiptOrder.price || 0) * 0.1))).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: '30pt', textAlign: 'left', lineHeight: '1.0' }}>
        <div style={{ fontStyle: 'italic', marginBottom: '20pt' }}>Thank you very much!</div>
        <div style={{ marginBottom: '25pt' }}>Very truly yours,</div>
        <div style={{ marginBottom: '3pt' }}>Jayperson Bonavente</div>
        <div>Operation Head</div>
      </div>
    </div>
  );
};

export default ReceiptTemplate;
