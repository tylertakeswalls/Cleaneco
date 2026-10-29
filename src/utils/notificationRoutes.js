/**
 * Determines the target route when clicking a notification
 * Handles both newly structured notifications and existing legacy records.
 * 
 * @param {Object} notif - Notification document from database
 * @param {boolean} isAdmin - True if current context is Admin portal
 * @returns {string} Target URL path to navigate to
 */
export function getNotificationRoute(notif, isAdmin = false) {
  if (!notif) return isAdmin ? '/admin' : '/';

  // 1. Explicit link stored directly on notification
  if (notif.link) {
    return notif.link;
  }

  const msg = (notif.message || '').toLowerCase();
  const details = (notif.details || '').toLowerCase();

  // 2. Chat & Inquiries
  if (
    msg.includes('message') || 
    msg.includes('cleaneco support') || 
    details.includes('conversation id') ||
    msg.includes('inquiry')
  ) {
    if (isAdmin) {
      return notif.order_id 
        ? `/admin/messages?orderId=${encodeURIComponent(notif.order_id)}` 
        : '/admin/messages';
    }
    return notif.order_id 
      ? `/messages?orderId=${encodeURIComponent(notif.order_id)}` 
      : '/messages';
  }

  // 3. User Registration (Admin only)
  if (isAdmin && (msg.includes('registration') || msg.includes('registered') || msg.includes('new client') || msg.includes('client profile'))) {
    return '/admin/users';
  }

  // 4. Orders, Quotations, Clarifications, Bookings, Reschedules, Payments
  if (
    notif.order_id || 
    msg.includes('clarification') ||
    msg.includes('quotation') ||
    msg.includes('order') || 
    msg.includes('booking') || 
    msg.includes('reschedule') || 
    msg.includes('cancellation') || 
    msg.includes('payment')
  ) {
    if (isAdmin) {
      return notif.order_id 
        ? `/admin/orders?orderId=${encodeURIComponent(notif.order_id)}` 
        : '/admin/orders';
    }
    return notif.order_id 
      ? `/orders?orderId=${encodeURIComponent(notif.order_id)}` 
      : '/orders';
  }

  // 5. Terms, Account & Welcome Notifications
  if (!isAdmin && (msg.includes('terms and conditions') || details.includes('resources section'))) {
    return '/resources';
  }
  if (msg.includes('password')) {
    return isAdmin ? '/admin/profile' : '/client/profile';
  }
  if (!isAdmin && msg.includes('welcome to cleaneco')) {
    return '/order';
  }

  // Default fallbacks
  return isAdmin ? '/admin/orders' : '/orders';
}

/**
 * Returns icon, badge color, and category for visual affordance in the tray
 */
export function getNotificationMeta(notif) {
  const msg = (notif?.message || '').toLowerCase();
  const details = (notif?.details || '').toLowerCase();

  if (msg.includes('clarification')) {
    return {
      icon: 'fas fa-question-circle',
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
      badgeText: 'Clarification'
    };
  }

  if (msg.includes('message') || msg.includes('cleaneco support') || details.includes('conversation id')) {
    return {
      icon: 'fas fa-comment-dots',
      iconBg: '#E8F5E9',
      iconColor: '#0D8D1E',
      badgeText: 'Message'
    };
  }

  if (msg.includes('registration') || msg.includes('registered') || msg.includes('new client')) {
    return {
      icon: 'fas fa-user-plus',
      iconBg: '#EDE9FE',
      iconColor: '#7C3AED',
      badgeText: 'Account'
    };
  }

  if (msg.includes('payment') || msg.includes('cheque')) {
    return {
      icon: 'fas fa-money-bill-wave',
      iconBg: '#ECFDF5',
      iconColor: '#059669',
      badgeText: 'Payment'
    };
  }

  return {
    icon: 'fas fa-clipboard-list',
    iconBg: '#E0F2FE',
    iconColor: '#0284C7',
    badgeText: 'Order'
  };
}
