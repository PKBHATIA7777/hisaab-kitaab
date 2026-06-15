/**
 * API path constants — single source of truth.
 * All apiFetch calls should use these instead of hardcoded strings.
 */
const API = Object.freeze({
  AUTH: {
    ME: '/auth/me',
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    GOOGLE: '/auth/google',
    PROFILE: '/auth/profile',
    CHECK_IDENTIFIER: '/auth/check-identifier',
    LOGIN_OTP_REQUEST: '/auth/login/otp-request',
    LOGIN_OTP_VERIFY: '/auth/login/otp-verify',
    REGISTER_OTP: '/auth/register/request-otp',
    REGISTER_VERIFY: '/auth/register/verify-otp',
    REGISTER_COMPLETE: '/auth/register/complete',
    FORGOT_OTP: '/auth/forgot/request-otp',
    FORGOT_RESET: '/auth/forgot/reset',
    DEVICES: '/auth/devices',
  },
  CHAPTERS: {
    LIST: '/chapters',
    BY_ID: (id) => `/chapters/${id}`,
    MEMBERS: (id) => `/chapters/${id}/members`,
    MEMBER: (id, memberId) => `/chapters/${id}/members/${memberId}`,
    EVENTS: (id) => `/chapters/${id}/events`,
    SETTLEMENTS_MARK: (id) => `/chapters/${id}/settlements/mark`,
    SETTLEMENTS_HISTORY: (id) => `/chapters/${id}/settlements/history`,
    EXPORT: (id) => `/chapters/${id}/export`,
    PERSONAL_STATUS: '/chapters/personal/status',
    CREATE_PERSONAL: '/chapters/create-personal',
  },
  EXPENSES: {
    CREATE: '/expenses',
    BY_ID: (id) => `/expenses/${id}`,
    BY_CHAPTER: (id) => `/expenses/chapter/${id}`,
    SUMMARY: (id) => `/expenses/chapter/${id}/summary`,
    SETTLEMENTS: (id) => `/expenses/chapter/${id}/settlements`,
    BULK_ASSIGN: '/expenses/bulk-assign-event',
  },
  CATEGORIES: {
    LIST: '/categories',
    MONTHLY: '/categories/monthly',
    BY_ID: (id) => `/categories/${id}`,
  },
  FRIENDS: {
    LIST: '/friends',
    BY_ID: (id) => `/friends/${id}`,
    SETTLEMENTS: (id) => `/friends/${id}/settlements`,
  },
});

window.API = API;
