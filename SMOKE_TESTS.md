# 🧪 Hisaab-Kitaab: End-to-End Smoke Test Checklist

Use this QA checklist to verify the critical path of the application before any major deployment to production.

---

## 1. Authentication & Session Flow
- [ ] **Sign Up with Email**: User can register, receive an OTP, and successfully verify their account.
- [ ] **Log In with Email/Password**: Registered users can log in.
- [ ] **Google OAuth**: Users can sign in or register via the Google OAuth popup/redirect.
- [ ] **Forgot Password**: Requesting a reset sends an OTP; verifying it allows setting a new password.
- [ ] **Logout**: Clicking logout clears the HTTP-only session cookie and redirects to the login page.
- [ ] **Session Persistence**: Closing and reopening the browser keeps the user logged in if the session hasn't expired.
- [ ] **Protected Routes**: Attempting to visit `/dashboard.html` without logging in redirects to `/login.html`.

## 2. PWA & Offline Capabilities
- [ ] **Install Prompt**: Browsing the site on Chrome (Android/Desktop) or Safari (iOS) shows an "Install App" or "Add to Home Screen" prompt.
- [ ] **Standalone Mode**: Opening the installed PWA hides the browser UI address bar.
- [ ] **Offline Fallback**: Turning off Wi-Fi and reloading shows the custom `offline.html` page instead of the generic browser dinosaur.

## 3. Chapters (Groups)
- [ ] **Create Chapter**: User can create a new chapter (e.g., "Goa Trip").
- [ ] **View Chapters**: The dashboard displays a list of the user's active chapters.
- [ ] **Add Members**: User can invite or add members to a specific chapter by email or name.
- [ ] **Delete/Leave Chapter**: User can delete a chapter (if they created it) or leave it (if invited).

## 4. Expenses & Splitting
- [ ] **Add Expense**: User can add an expense, inputting total amount, paid-by user, and description.
- [ ] **Split Logic (Equal)**: The expense correctly splits equally among selected members.
- [ ] **Split Logic (Unequal/Custom)**: The expense correctly splits according to exact amounts or percentages.
- [ ] **Activity Feed**: Added expenses immediately appear in the chapter's activity/ledger feed.
- [ ] **Edit/Delete Expense**: Creator of the expense can edit or delete it, updating the ledger.

## 5. Settlement & Debt Calculation
- [ ] **Debt Simplification**: The algorithm correctly computes "Who owes Whom" using the minimum number of transactions.
- [ ] **Settle Up**: Users can click "Settle Up" to record a cash transfer, which accurately updates the remaining balances.
- [ ] **Export**: The "Export to Excel/CSV" button successfully generates and downloads a ledger report.

## 6. Security & Infrastructure
- [ ] **Rate Limiting (OTP)**: Requesting >5 OTPs to the same email within 15 minutes blocks the request with a `429 Too Many Requests`.
- [ ] **Rate Limiting (Global/Write)**: Rapidly spamming the "Add Expense" button triggers the write rate limiter.
- [ ] **CSRF Verification**: Manually intercepting a POST request and stripping the `X-CSRF-Token` header results in a `403 Forbidden`.
- [ ] **Sentry Monitoring**: Throwing a deliberate error in the console or triggering a 500 API response logs successfully to the Sentry dashboard.

## 7. Responsive UI & Cross-Browser
- [ ] **Mobile Layout (iOS Safari & Chrome Android)**: Tap targets are large enough, bottom navigation is visible, and the 100dvh layout doesn't hide under the address bar.
- [ ] **Desktop/Ultra-wide Layout**: The UI centers elegantly and does not stretch unreadably on 1440p+ displays.
- [ ] **Samsung Internet / Brave**: The layout doesn't break, and fallback notices appear if tracking shields block Google OAuth.
