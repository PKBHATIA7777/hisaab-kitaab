window.formatCurrency = function(amount, locale = 'en-IN', currency = 'INR') {
  return `₹${parseFloat(amount).toLocaleString(locale)}`;
};
window.formatDate = function(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};