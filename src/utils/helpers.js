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

