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
