export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (!isNaN(date)) {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).format(date);
    }
  } catch (e) {
    console.error("Date formatting error:", e);
  }
  return dateString;
};

export const getStatusClass = (status) => {
  const statusClasses = {
    "Completed": "completed-text",
    "In Progress": "in-progress-text",
    "Cancelled": "cancelled-text"
  };
  return statusClasses[status] || "pending-text";
};

export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '₱0.00';
  const num = parseFloat(amount);
  return '₱' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export const formatOrderReference = (orderId) => {
  if (!orderId) return '';
  const str = String(orderId).trim();
  if (/^CLN-\d{4}-\d{4}$/i.test(str)) return str.toUpperCase();
  const digits = str.replace(/\D/g, '');
  if (digits.length >= 4) {
    const year = new Date().getFullYear();
    const last4 = digits.slice(-4);
    return `CLN-${year}-${last4}`;
  }
  return str;
};

export const formatPHP = (amount, isNegative = false) => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'PHP 0.00';
  const num = Math.abs(parseFloat(amount));
  const formatted = 'PHP ' + num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return (isNegative || parseFloat(amount) < 0) ? `-${formatted}` : formatted;
};

export const formatPhoneNumber = (value) => {
  if (!value) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.substring(2);
  else if (digits.startsWith('0')) digits = digits.substring(1);

  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(+63) ${digits}`;
  if (digits.length <= 6) return `(+63) ${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `(+63) ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const toISODateKey = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [m, d, y] = trimmed.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  try {
    const parsed = new Date(dateVal);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  } catch (e) {
    // ignore invalid dates
  }
  return '';
};

export const resolveOrderSchedule = (order = {}) => {
  const inspDateRaw = order.confirmed_date || order.date || null;
  const inspSlotRaw =
    (order.confirmed_date ? order.confirmed_time_slot : '') ||
    order.confirmed_time_slot ||
    order.time_slot ||
    '';
  const inspectedDateFormatted = inspDateRaw ? formatDate(inspDateRaw) : 'N/A';

  // 1. Completed Orders
  if (order.status === 'Completed') {
    const hasExec = Boolean(order.service_execution_date);
    const activeDate = order.service_execution_date || inspDateRaw;
    const activeSlot = hasExec ? (order.service_execution_time_slot || '') : inspSlotRaw;
    const formattedDate = formatDate(activeDate);
    const isoKey = toISODateKey(activeDate);

    return {
      phase: 'completed',
      label: 'Executed',
      shortPhaseTag: 'Exec',
      badgeBg: '#dcfce7',
      badgeColor: '#166534',
      badgeBorder: '#bbf7d0',
      activeDate,
      activeSlot,
      formattedDate,
      inspectedDateFormatted,
      filterDateKey: isoKey,
      calendarDateKey: isoKey,
      pdfText: `${formattedDate}${activeSlot ? ` (${activeSlot})` : ''} [Executed]`
    };
  }

  // 2. Cancelled Orders
  if (order.status === 'Cancelled') {
    const hadExec = Boolean(order.service_execution_date);
    const activeDate = order.service_execution_date || inspDateRaw;
    const activeSlot = hadExec ? (order.service_execution_time_slot || '') : inspSlotRaw;
    const formattedDate = formatDate(activeDate);
    const label = hadExec ? 'Exec. Cancelled' : 'Insp. Cancelled';
    const isoKey = toISODateKey(activeDate);

    return {
      phase: 'cancelled',
      label,
      shortPhaseTag: hadExec ? 'Exec' : 'Insp',
      badgeBg: '#fee2e2',
      badgeColor: '#991b1b',
      badgeBorder: '#fecaca',
      activeDate,
      activeSlot,
      formattedDate,
      inspectedDateFormatted,
      filterDateKey: isoKey,
      calendarDateKey: isoKey,
      pdfText: `${formattedDate} [${label}]`
    };
  }

  // 3. Service Execution Scheduled
  if (order.service_execution_date) {
    const activeDate = order.service_execution_date;
    const activeSlot = order.service_execution_time_slot || '';
    const formattedDate = formatDate(activeDate);
    const isoKey = toISODateKey(activeDate);

    return {
      phase: 'execution',
      label: 'Service Execution',
      shortPhaseTag: 'Exec',
      badgeBg: '#dcfce7',
      badgeColor: '#15803d',
      badgeBorder: '#86efac',
      activeDate,
      activeSlot,
      formattedDate,
      inspectedDateFormatted,
      filterDateKey: isoKey,
      calendarDateKey: isoKey,
      pdfText: `${formattedDate}${activeSlot ? ` (${activeSlot})` : ''} [Execution]`
    };
  }

  // 4. Inspection Completed -> Quotation Phase / Awaiting Client Execution Schedule
  const isPostInspection = Boolean(
    order.has_final_price ||
    ['Pending Client Approval', 'Clarification Requested', 'Approved'].includes(order.quotation_status)
  );

  if (isPostInspection) {
    let label = 'Quotation Pending';
    let badgeBg = '#e0e7ff';
    let badgeColor = '#3730a3';
    let badgeBorder = '#c7d2fe';

    if (order.quotation_status === 'Approved') {
      label = 'Awaiting Exec. Date';
      badgeBg = '#e0f2fe';
      badgeColor = '#0369a1';
      badgeBorder = '#bae6fd';
    } else if (order.quotation_status === 'Clarification Requested') {
      label = 'Clarification Req.';
      badgeBg = '#fef3c7';
      badgeColor = '#b45309';
      badgeBorder = '#fde68a';
    }

    return {
      phase: 'awaiting_execution',
      label,
      shortPhaseTag: 'Quote',
      badgeBg,
      badgeColor,
      badgeBorder,
      activeDate: null,
      activeSlot: '',
      formattedDate: 'Awaiting Schedule',
      inspectedDateFormatted,
      filterDateKey: '',
      calendarDateKey: toISODateKey(inspDateRaw),
      pdfText: `Awaiting Schedule [${label} - Insp: ${inspectedDateFormatted}]`
    };
  }

  // 5. Unpaid / Pending Reservation (Client Preferred Inspection Date)
  if (order.status === 'Pending') {
    const activeDate = order.date || order.confirmed_date || null;
    const activeSlot = order.time_slot || order.confirmed_time_slot || '';
    const formattedDate = formatDate(activeDate);
    const isoKey = toISODateKey(activeDate);

    return {
      phase: 'pref_inspection',
      label: 'Pref. Inspection',
      shortPhaseTag: 'Pref. Insp',
      badgeBg: '#fef9c3',
      badgeColor: '#854d0e',
      badgeBorder: '#fde047',
      activeDate,
      activeSlot,
      formattedDate,
      inspectedDateFormatted,
      filterDateKey: isoKey,
      calendarDateKey: isoKey,
      pdfText: `${formattedDate}${activeSlot ? ` (${activeSlot})` : ''} [Pref. Insp]`
    };
  }

  // 6. Active / Confirmed Site Inspection (In Progress, pre-quotation)
  const activeDate = inspDateRaw;
  const activeSlot = inspSlotRaw;
  const formattedDate = formatDate(activeDate);
  const isoKey = toISODateKey(activeDate);

  return {
    phase: 'inspection',
    label: 'Site Inspection',
    shortPhaseTag: 'Insp',
    badgeBg: '#eff6ff',
    badgeColor: '#2563eb',
    badgeBorder: '#bfdbfe',
    activeDate,
    activeSlot,
    formattedDate,
    inspectedDateFormatted,
    filterDateKey: isoKey,
    calendarDateKey: isoKey,
    pdfText: `${formattedDate}${activeSlot ? ` (${activeSlot})` : ''} [Inspection]`
  };
};


/**
 * Splits a single or paired truck_team string (e.g. "Truck Team 1 & Truck Team 2")
 * into deduplicated individual truck names.
 */
export const parseAssignedTrucks = (truckTeamStr) => {
  if (!truckTeamStr || typeof truckTeamStr !== 'string') return [];
  const seen = new Set();
  const result = [];
  for (const part of truckTeamStr.split(/[,&]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
};

export const isWholeDayExecution = (slot, totalTrips) =>
  (Number(totalTrips) || 1) >= 5 || String(slot || '').trim().toLowerCase() === 'whole day';

export const executionSlotsOverlap = (slotA, tripsA, slotB, tripsB) => {
  if (isWholeDayExecution(slotA, tripsA) || isWholeDayExecution(slotB, tripsB)) {
    return true;
  }
  if (!slotA || !slotB) return false;
  return String(slotA).trim().toLowerCase() === String(slotB).trim().toLowerCase();
};

/**
 * Builds a lowercase truckName -> { orderId, slot } map of trucks already assigned
 * to OTHER non-cancelled orders in an overlapping service execution timeframe.
 */
export const getBookedTruckMapForOrder = (targetOrder, allOrders = [], overrideTrips = null) => {
  const booked = {};
  if (!targetOrder || !targetOrder.service_execution_date) return booked;

  const targetDateKey = toISODateKey(targetOrder.service_execution_date);
  if (!targetDateKey) return booked;

  const targetSlot = targetOrder.service_execution_time_slot || '';
  const targetTrips = overrideTrips != null ? Number(overrideTrips) : (Number(targetOrder.total_trips) || 1);

  for (const other of allOrders) {
    if (!other || other.status === 'Cancelled' || !other.service_execution_date || !other.truck_team) continue;

    const sameOrder =
      (targetOrder.order_id && other.order_id && String(targetOrder.order_id) === String(other.order_id)) ||
      (targetOrder.id && other.id && String(targetOrder.id) === String(other.id));
    if (sameOrder) continue;

    if (toISODateKey(other.service_execution_date) !== targetDateKey) continue;

    if (!executionSlotsOverlap(targetSlot, targetTrips, other.service_execution_time_slot, other.total_trips)) {
      continue;
    }

    const otherSlotLabel = isWholeDayExecution(other.service_execution_time_slot, other.total_trips)
      ? 'Whole Day'
      : (other.service_execution_time_slot || 'Scheduled');

    for (const tName of parseAssignedTrucks(other.truck_team)) {
      const key = tName.toLowerCase();
      if (!booked[key]) {
        booked[key] = {
          truckName: tName,
          orderId: other.order_id || other.id,
          slot: otherSlotLabel
        };
      }
    }
  }

  return booked;
};

/**
 * Loads a PDF Blob into a hidden iframe and triggers the browser's native
 * Print / Save-as-PDF preview dialog (matching the client-side PDF preview flow).
 */
export const previewPdfBlob = (blobData, fileName = 'Report.pdf') => {
  const blob = blobData instanceof Blob && blobData.type === 'application/pdf'
    ? blobData
    : new Blob([blobData], { type: 'application/pdf' });
  const blobUrl = window.URL.createObjectURL(blob);

  const existingFrame = document.getElementById('cleaneco-pdf-print-frame');
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'cleaneco-pdf-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.src = blobUrl;

  const originalTitle = document.title;
  const cleanTitle = String(fileName || 'Report').replace(/\.pdf$/i, '');

  iframe.onload = () => {
    setTimeout(() => {
      try {
        document.title = cleanTitle;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        window.open(blobUrl, '_blank');
      } finally {
        setTimeout(() => {
          document.title = originalTitle;
        }, 1500);
      }
    }, 350);
  };

  document.body.appendChild(iframe);
};
