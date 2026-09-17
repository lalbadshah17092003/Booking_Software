import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId:"2f150bf0-1149-4cd6-80b9-50d26b079033",
    authority: `https://login.microsoftonline.com/ba498b70-63f6-4c40-bc3e-c5eba89dcacc`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case 0:
            console.error(message);
            return;
          case 1:
            console.warn(message);
            return;
          case 2:
            console.info(message);
            return;
          case 3:
            console.debug(message);
            return;
          default:
            console.log(message);
            return;
        }
      }
    }
  }
};

export const loginRequest = {
  scopes: [
    "openid", 
    "profile", 
    "User.Read",
    "Calendars.ReadWrite",
    "OnlineMeetings.ReadWrite"
  ],
};

// Create MSAL instance with error handling
let msalInstance = null;

try {
  // Check if we're in a secure context (HTTPS)
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    msalInstance = new PublicClientApplication(msalConfig);
    
  } else {
    console.warn("⚠️ MSAL requires HTTPS. Please run the app with HTTPS enabled.");
    // Create a mock instance for development
    msalInstance = {
      initialize: () => Promise.resolve(),
      acquireTokenSilent: () => Promise.reject(new Error("MSAL not available - HTTPS required")),
      loginPopup: () => Promise.reject(new Error("MSAL not available - HTTPS required")),
      logout: () => Promise.resolve(),
      getActiveAccount: () => null,
      getAllAccounts: () => [],
    };
  }
} catch (error) {
  console.error("❌ Failed to create MSAL instance:", error);
  // Create a mock instance as fallback
  msalInstance = {
    initialize: () => Promise.resolve(),
    acquireTokenSilent: () => Promise.reject(new Error("MSAL not available")),
    loginPopup: () => Promise.reject(new Error("MSAL not available")),
    logout: () => Promise.resolve(),
    getActiveAccount: () => null,
    getAllAccounts: () => [],
  };
}

export { msalInstance };
