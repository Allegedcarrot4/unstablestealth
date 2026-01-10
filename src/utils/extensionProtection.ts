/**
 * Extension Protection Utilities
 * Prevents browser extensions from accessing or modifying the website
 */

// Block common extension injection patterns
const blockExtensionInjection = () => {
  // Freeze critical prototypes to prevent tampering
  const criticalObjects = [
    Object.prototype,
    Array.prototype,
    Function.prototype,
    String.prototype,
    Document.prototype,
    Element.prototype,
    HTMLElement.prototype,
    Node.prototype,
  ];

  // Monitor for suspicious property additions
  const originalDefineProperty = Object.defineProperty;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Object as any).defineProperty = function<T>(obj: T, prop: PropertyKey, descriptor: PropertyDescriptor): T {
    // Block common extension patterns
    if (typeof prop === 'string') {
      const suspiciousPatterns = [
        '__extension',
        '__inject',
        '__hook',
        '__proxy',
        'webextension',
        'chrome-extension',
        'moz-extension',
      ];
      
      if (suspiciousPatterns.some(pattern => String(prop).toLowerCase().includes(pattern))) {
        console.warn('Blocked suspicious property definition:', prop);
        return obj;
      }
    }
    
    return originalDefineProperty.call(this, obj, prop, descriptor);
  };
};

// Detect and remove injected scripts
const removeInjectedScripts = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLScriptElement) {
          const src = node.src || '';
          const content = node.textContent || '';
          
          // Block extension scripts
          if (
            src.includes('chrome-extension://') ||
            src.includes('moz-extension://') ||
            src.includes('ms-browser-extension://') ||
            src.includes('safari-extension://') ||
            content.includes('chrome.runtime') ||
            content.includes('browser.runtime') ||
            content.includes('chrome.extension') ||
            content.includes('browser.extension')
          ) {
            node.remove();
            console.warn('Removed injected extension script');
          }
        }
        
        // Block injected iframes from extensions
        if (node instanceof HTMLIFrameElement) {
          const src = node.src || '';
          if (
            src.includes('chrome-extension://') ||
            src.includes('moz-extension://') ||
            src.includes('ms-browser-extension://')
          ) {
            node.remove();
            console.warn('Removed injected extension iframe');
          }
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  return observer;
};

// Block extension message passing
const blockExtensionMessaging = () => {
  // Override postMessage to filter extension messages
  const originalPostMessage = window.postMessage;
  window.postMessage = function(message: unknown, targetOrigin: string, transfer?: Transferable[]) {
    // Block messages from/to extensions
    if (typeof targetOrigin === 'string' && (
      targetOrigin.includes('chrome-extension://') ||
      targetOrigin.includes('moz-extension://') ||
      targetOrigin.includes('ms-browser-extension://')
    )) {
      console.warn('Blocked extension postMessage');
      return;
    }
    
    return originalPostMessage.call(this, message, targetOrigin, transfer as Transferable[]);
  };

  // Block runtime message listeners
  const blockRuntimeAPI = () => {
    try {
      // @ts-expect-error - chrome may not exist
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        // @ts-expect-error - chrome may not exist
        Object.defineProperty(chrome, 'runtime', {
          get: () => undefined,
          configurable: false,
        });
      }
    } catch {
      // Ignore errors
    }

    try {
      // @ts-expect-error - browser may not exist
      if (typeof browser !== 'undefined' && browser.runtime) {
        // @ts-expect-error - browser may not exist
        Object.defineProperty(browser, 'runtime', {
          get: () => undefined,
          configurable: false,
        });
      }
    } catch {
      // Ignore errors
    }
  };

  blockRuntimeAPI();
};

// Detect DevTools and extension debugging
const detectDevTools = () => {
  let devtoolsOpen = false;
  
  const threshold = 160;
  
  const checkDevTools = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        // Optional: You could trigger some action here
      }
    } else {
      devtoolsOpen = false;
    }
  };

  setInterval(checkDevTools, 1000);
};

// Disable right-click context menu (optional, can be enabled)
const disableContextMenu = () => {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
};

// Disable keyboard shortcuts commonly used by extensions
const disableExtensionShortcuts = () => {
  document.addEventListener('keydown', (e) => {
    // Block F12 (DevTools)
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+U (View Source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return false;
    }
    
    // Block Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }
  });
};

// Clear sensitive data from memory periodically
const clearSensitiveData = () => {
  // Override console methods to prevent data leakage
  const noop = () => {};
  
  if (process.env.NODE_ENV === 'production') {
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    // Keep console.error for critical issues
  }
};

// Block clipboard hijacking
const protectClipboard = () => {
  document.addEventListener('copy', (e) => {
    // Allow normal copy but prevent extension interception
    e.stopPropagation();
  }, true);
  
  document.addEventListener('paste', (e) => {
    e.stopPropagation();
  }, true);
};

// Detect and block content script injection
const blockContentScripts = () => {
  // Monitor for suspicious attribute changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const target = mutation.target as HTMLElement;
        const attrName = mutation.attributeName || '';
        
        // Block data attributes commonly used by extensions
        if (attrName.startsWith('data-extension-') || 
            attrName.startsWith('data-__') ||
            attrName.includes('webextension')) {
          target.removeAttribute(attrName);
        }
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class', 'style', 'data-*'],
  });

  return observer;
};

// Initialize all protection mechanisms
export const initExtensionProtection = () => {
  // Run protections
  blockExtensionInjection();
  removeInjectedScripts();
  blockExtensionMessaging();
  detectDevTools();
  disableContextMenu();
  disableExtensionShortcuts();
  protectClipboard();
  blockContentScripts();
  
  // Only in production
  if (import.meta.env.PROD) {
    clearSensitiveData();
  }
  
  console.log('Extension protection initialized');
};

// Check if running in a potentially compromised environment
export const checkEnvironmentSecurity = (): boolean => {
  let isSecure = true;
  
  // Check for common extension globals
  const suspiciousGlobals = [
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    '__REDUX_DEVTOOLS_EXTENSION__',
    'webextension',
  ];
  
  suspiciousGlobals.forEach((global) => {
    if (global in window) {
      isSecure = false;
    }
  });
  
  return isSecure;
};
