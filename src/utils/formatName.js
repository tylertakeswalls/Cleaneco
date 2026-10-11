export const formatName = (data) => {
  if (!data) return '';
  const firstName = data.first_name || data.firstName || '';
  const lastName = data.last_name || data.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  const clientType = data.clientType || data.user_clientType;
  const companyName = data.companyName || data.user_companyName;

  if ((clientType === 'commercial' || clientType === 'industrial') && companyName) {
    return `${fullName} (${companyName})`;
  }
  return fullName;
};
