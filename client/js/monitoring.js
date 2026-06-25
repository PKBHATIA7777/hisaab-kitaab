/* client/js/monitoring.js */
// Client-Side Performance and Error Monitoring
(function() {
  // 1. Initialize Sentry if loaded
  if (typeof Sentry !== 'undefined') {
    Sentry.init({
      // Replace with your actual DSN when deploying
      dsn: "", 
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: true,
        }),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // Capture 10% of transactions
      // Session Replay
      replaysSessionSampleRate: 0.01, // 1% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% of sessions with an error
    });
  }

  // 2. Report Core Web Vitals
  if (typeof webVitals !== 'undefined') {
    function sendToAnalytics(metric) {
      // Log to console in dev; in production, send to API or Sentry
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.debug(`[Web Vitals] ${metric.name}:`, Math.round(metric.value));
      } else if (typeof Sentry !== 'undefined') {
        // Alternatively, Sentry BrowserTracing automatically captures Web Vitals.
      }
    }
    webVitals.onCLS(sendToAnalytics);
    webVitals.onINP(sendToAnalytics);
    webVitals.onLCP(sendToAnalytics);
    webVitals.onFCP(sendToAnalytics);
    webVitals.onTTFB(sendToAnalytics);
  }
})();
