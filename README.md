<div align="center">
  <img src="https://hisaab-kitaab-q9e1.vercel.app/icons/icon-512x512.png" alt="Hisaab-Kitaab Logo" width="120" />
  <h1>Hisaab-Kitaab</h1>
  <p><em>Split Expenses, Settle Debts. Seamlessly.</em></p>

  [![Live Demo](https://img.shields.io/badge/Live-Demo-7C3AED?style=for-the-badge&logo=vercel)](https://hisaab-kitaab.onrender.com/)
  [![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](#)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](#)
  [![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](#)
</div>

---

## 📖 About
**Hisaab-Kitaab** is a modern, mobile-first web application designed to help friends, flatmates, and families track shared expenses and settle debts fairly and effortlessly. 

Built with a focus on **performance**, **security**, and **user experience**, Hisaab-Kitaab features a highly dynamic, vanilla UI paired with a robust Node.js backend. It operates fully as a **Progressive Web App (PWA)**, meaning you can install it directly to your home screen—no app store required.

---

## ✨ Key Features

- **📊 Smart Debt Splitting**: Automatically calculates the most efficient way to settle group debts (minimizes transactions).
- **📱 Progressive Web App (PWA)**: Installable on iOS, Android, and Desktop with offline fallback capabilities.
- **🔐 Secure Authentication**: Includes Google OAuth, email OTP verification, robust rate-limiting, and hardened CSRF/XSS protection.
- **⚡ Lightning Fast UI**: Built without heavy JavaScript frameworks. Utilizes highly optimized Vanilla JS, dynamic CSS variables, and modern web standards.
- **📈 Advanced Observability**: Fully integrated with **Sentry** for real-time error tracking and **Web Vitals** for client-side performance monitoring.
- **📱 Responsive & Accessible**: Meticulously designed for all device sizes (from narrow mobile screens to ultra-wide displays) with full ARIA accessibility support.

---

## 🛠 Tech Stack

### Frontend (Client)
- **HTML5 & CSS3**: Custom design system using pure CSS tokens and utility classes.
- **Vanilla JavaScript**: Modular ES6 modules. No React/Vue/Angular overhead.
- **PWA Capabilities**: Service Workers (`sw.js`) and Web Manifest.

### Backend (Server)
- **Node.js & Express.js**: High-performance RESTful API.
- **PostgreSQL**: Relational database managing users, chapters, and settlements.
- **Authentication**: JWT (JSON Web Tokens), `bcrypt`, and Google Auth Library.
- **Testing**: `Jest` and `Supertest` for comprehensive integration testing.
- **Observability**: Pino for structured logging, Sentry for error/tracing, and `express-rate-limit`.

---

## 📁 Architecture Overview

```text
hisaab-kitaab/
├── client/                 # Frontend application
│   ├── css/                # Utility-first CSS, tokens, and page-specific styles
│   ├── js/                 # Modular Vanilla JS (core, components, pages, pwa)
│   ├── icons/              # PWA icons and SVG assets
│   ├── index.html          # Entry point & PWA shell
│   └── sw.js               # Service Worker for offline caching
│
└── server/                 # Backend Node.js API
    ├── config/             # Database connection and environment config
    ├── controllers/        # Business logic for routes
    ├── middleware/         # Auth, CSRF, logging, and rate limiting
    ├── routes/             # Express API route definitions
    ├── utils/              # Helper functions (email, logger, validation)
    ├── __tests__/          # Jest integration tests
    └── server.js           # API entry point & configuration
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) (Local instance or cloud like Neon/Supabase)

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/hisaab-kitaab.git
cd hisaab-kitaab
```

### 2. Setup the Backend
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

### 3. Environment Variables
Create a `.env` file in the `server` directory and configure the following variables:
```env
# Server Configuration
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:5500

# Database
DATABASE_URL=postgres://user:password@localhost:5432/hisaab_kitaab

# Authentication
JWT_SECRET=your_super_secret_jwt_key
CSRF_SECRET=your_csrf_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id

# Email (Resend or Mailjet)
RESEND_API_KEY=your_resend_api_key

# Observability
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info
```

### 4. Run Migrations
Setup your PostgreSQL database schema:
```bash
npm run migrate up
```

### 5. Start the Application
Start the backend server:
```bash
npm run dev
```

For the frontend, simply serve the `client/` directory using any static server (like VS Code Live Server or Python's `http.server`):
```bash
npx serve client -p 5500
```
> The application will be running at `http://localhost:5500`

---

## 🧪 Testing

The backend includes comprehensive integration tests utilizing **Jest** and **Supertest**.

To run the test suite:
```bash
cd server
npm test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

---

## 🛡️ Security Measures
- **HTTP-Only Cookies**: JWTs are strictly managed in secure, HTTP-only cookies to prevent XSS.
- **CSRF Protection**: Stateful CSRF tokens strictly enforce origin security.
- **Content Security Policy (CSP)**: Powered by `helmet` to strictly limit execution sources.
- **Rate Limiting**: IP and User-based rate limiting to prevent brute-force and DDoS attempts.

---

## 📄 License
This project is proprietary and intended as a portfolio showcase.

---
*Built with ❤️ for hassle-free group expenses.*
