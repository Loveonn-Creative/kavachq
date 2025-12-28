// Anonymous device identification for gig workers
// No login required - privacy-first approach

const DEVICE_ID_KEY = 'kavach_device_id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate a unique device ID
    deviceId = generateDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

function generateDeviceId(): string {
  // Combine timestamp with random values for uniqueness
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  
  return `kv_${timestamp}_${randomPart}${randomPart2}`;
}

// Get browser language for voice output
export function getUserLanguage(): string {
  const lang = navigator.language || 'en-IN';
  
  // Map to supported languages
  const supportedLangs: Record<string, string> = {
    'hi': 'hi-IN',
    'hi-IN': 'hi-IN',
    'en': 'en-IN',
    'en-IN': 'en-IN',
    'en-US': 'en-IN',
    'ta': 'ta-IN',
    'ta-IN': 'ta-IN',
    'te': 'te-IN',
    'te-IN': 'te-IN',
    'kn': 'kn-IN',
    'kn-IN': 'kn-IN',
    'mr': 'mr-IN',
    'mr-IN': 'mr-IN',
    'bn': 'bn-IN',
    'bn-IN': 'bn-IN',
    'gu': 'gu-IN',
    'gu-IN': 'gu-IN',
  };
  
  const langCode = lang.split('-')[0];
  return supportedLangs[lang] || supportedLangs[langCode] || 'en-IN';
}
