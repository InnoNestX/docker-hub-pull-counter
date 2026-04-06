// Speed Insights initialization
// This script will be loaded in the browser to initialize Vercel Speed Insights
(function() {
  'use strict';
  
  // Speed Insights script injection
  var script = document.createElement('script');
  script.src = '/_vercel/speed-insights/script.js';
  script.defer = true;
  
  // Add error handling
  script.onerror = function() {
    console.warn('Vercel Speed Insights: Failed to load script. Make sure Speed Insights is enabled in your Vercel dashboard.');
  };
  
  // Inject the script into the page
  var firstScript = document.getElementsByTagName('script')[0];
  if (firstScript && firstScript.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
})();
