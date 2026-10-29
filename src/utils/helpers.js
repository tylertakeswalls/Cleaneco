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
  if (amount === undefined || amount === null || isNaN(amount)) return '₱0';
  const num = parseFloat(amount);
  return '₱' + num.toLocaleString('en-US', {
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });
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
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8',
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
