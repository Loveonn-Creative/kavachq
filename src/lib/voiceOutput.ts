// Voice output system for KAVACH
// Voice-first interaction - workers can't look at screens while riding

import { getUserLanguage } from './deviceId';

// Voice messages in multiple Indian languages
const voiceMessages: Record<string, Record<string, string>> = {
  'en-IN': {
    ride_started: 'Ride started. I am watching over you.',
    ride_ended: 'Ride ended. Stay safe.',
    speed_warning: 'Slow down. Risky road ahead.',
    heat_warning: 'Too hot. Stop for 5 minutes. Find shade.',
    unsafe_zone: 'Unsafe area ahead. Stay alert.',
    sudden_stop: 'Are you okay? Tap the screen if you are fine.',
    fall_detected: 'Fall detected. Getting help now.',
    long_idle: 'No movement detected. Are you okay?',
    wellness_check: 'How are you feeling? Take a break if tired.',
    emergency_triggered: 'Emergency activated. Sharing your location.',
    emergency_cancelled: 'Emergency cancelled. Stay safe.',
    help_coming: 'Help is on the way. Stay where you are.',
    // Weather alerts
    extreme_heat: 'Extreme heat. Stop immediately. Find shade and water.',
    rain_warning: 'Rain starting. Slow down. Roads are slippery.',
    high_wind: 'Strong winds ahead. Hold steady. Stay alert.',
    hydration_reminder: 'Time to drink water. Stay hydrated.',
    weather_caution: 'Warm conditions. Take breaks and hydrate.',
    // AQI alerts
    aqi_hazardous: 'Hazardous air quality. Stop and find shelter immediately.',
    aqi_very_unhealthy: 'Very unhealthy air. Limit outdoor riding.',
    aqi_unhealthy: 'Unhealthy air quality. Take breaks indoors.',
    aqi_sensitive: 'Air quality alert. Rest if you feel unwell.',
    // Voice confirmation
    are_you_okay: 'Are you okay?',
    alert_suppressed: 'False alarm recorded. Learning from this location.',
    danger_confirmed: 'Help is coming. Stay where you are.',
  },
  'hi-IN': {
    ride_started: 'राइड शुरू। मैं आपकी निगरानी कर रहा हूं।',
    ride_ended: 'राइड समाप्त। सुरक्षित रहें।',
    speed_warning: 'धीमा करें। आगे खतरनाक सड़क।',
    heat_warning: 'बहुत गर्मी। 5 मिनट रुकें। छाया खोजें।',
    unsafe_zone: 'आगे असुरक्षित क्षेत्र। सतर्क रहें।',
    sudden_stop: 'क्या आप ठीक हैं? ठीक हैं तो स्क्रीन टैप करें।',
    fall_detected: 'गिरावट का पता चला। मदद बुला रहा हूं।',
    long_idle: 'कोई हलचल नहीं। क्या आप ठीक हैं?',
    wellness_check: 'आप कैसा महसूस कर रहे हैं? थके हों तो आराम करें।',
    emergency_triggered: 'इमरजेंसी चालू। आपकी लोकेशन शेयर कर रहा हूं।',
    emergency_cancelled: 'इमरजेंसी रद्द। सुरक्षित रहें।',
    help_coming: 'मदद आ रही है। वहीं रहें।',
    // Weather alerts
    extreme_heat: 'अत्यधिक गर्मी। तुरंत रुकें। छाया और पानी खोजें।',
    rain_warning: 'बारिश शुरू। धीमा करें। सड़कें फिसलन भरी हैं।',
    high_wind: 'तेज़ हवाएं। स्थिर रहें। सतर्क रहें।',
    hydration_reminder: 'पानी पीने का समय। हाइड्रेटेड रहें।',
    weather_caution: 'गर्म मौसम। ब्रेक लें और पानी पिएं।',
    // AQI alerts
    aqi_hazardous: 'खतरनाक हवा। तुरंत रुकें और छत के नीचे जाएं।',
    aqi_very_unhealthy: 'बहुत खराब हवा। बाहर कम निकलें।',
    aqi_unhealthy: 'खराब हवा। अंदर आराम करें।',
    aqi_sensitive: 'हवा की चेतावनी। तबियत खराब लगे तो आराम करें।',
    // Voice confirmation
    are_you_okay: 'क्या आप ठीक हैं?',
    alert_suppressed: 'गलत अलार्म दर्ज। इस जगह से सीख रहा हूं।',
    danger_confirmed: 'मदद आ रही है। वहीं रहें।',
  },
  'ta-IN': {
    ride_started: 'பயணம் தொடங்கியது. நான் உங்களை கவனித்துக்கொள்கிறேன்.',
    ride_ended: 'பயணம் முடிந்தது. பாதுகாப்பாக இருங்கள்.',
    speed_warning: 'வேகத்தை குறையுங்கள். ஆபத்தான சாலை.',
    heat_warning: 'மிகவும் வெப்பம். 5 நிமிடம் நிறுத்துங்கள்.',
    unsafe_zone: 'முன்னால் பாதுகாப்பற்ற பகுதி. எச்சரிக்கையாக இருங்கள்.',
    sudden_stop: 'நீங்கள் நன்றாக இருக்கிறீர்களா?',
    fall_detected: 'விழுந்தது கண்டறியப்பட்டது. உதவி வருகிறது.',
    long_idle: 'இயக்கம் இல்லை. நீங்கள் நன்றாக இருக்கிறீர்களா?',
    wellness_check: 'எப்படி உணர்கிறீர்கள்?',
    emergency_triggered: 'அவசர நிலை செயல்படுத்தப்பட்டது.',
    emergency_cancelled: 'அவசர நிலை ரத்து.',
    help_coming: 'உதவி வருகிறது.',
    // Weather alerts
    extreme_heat: 'கடுமையான வெப்பம். உடனே நிறுத்துங்கள். நிழல் மற்றும் தண்ணீர் கண்டுபிடியுங்கள்.',
    rain_warning: 'மழை தொடங்குகிறது. வேகம் குறையுங்கள். சாலைகள் வழுக்கும்.',
    high_wind: 'கடும் காற்று. நிலையாக இருங்கள். விழிப்பாக இருங்கள்.',
    hydration_reminder: 'தண்ணீர் குடிக்க நேரம். நீரேற்றமாக இருங்கள்.',
    weather_caution: 'வெப்பமான நிலை. இடைவேளை எடுங்கள்.',
    // AQI alerts
    aqi_hazardous: 'ஆபத்தான காற்று. உடனே நிறுத்தி உள்ளே செல்லுங்கள்.',
    aqi_very_unhealthy: 'மிகவும் மோசமான காற்று. வெளியே குறைவாக இருங்கள்.',
    aqi_unhealthy: 'மோசமான காற்று. உள்ளே ஓய்வெடுங்கள்.',
    aqi_sensitive: 'காற்று எச்சரிக்கை. உடல்நிலை சரியில்லாவிட்டால் ஓய்வெடுங்கள்.',
    // Voice confirmation
    are_you_okay: 'நீங்கள் நன்றாக இருக்கிறீர்களா?',
    alert_suppressed: 'தவறான எச்சரிக்கை பதிவு செய்யப்பட்டது.',
    danger_confirmed: 'உதவி வருகிறது. அங்கேயே இருங்கள்.',
  },
};

let speechSynthesis: SpeechSynthesis | null = null;
let currentVoice: SpeechSynthesisVoice | null = null;

export function initVoice(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    speechSynthesis = window.speechSynthesis;
    
    // Load voices
    const loadVoices = () => {
      const voices = speechSynthesis?.getVoices() || [];
      const userLang = getUserLanguage();
      
      // Try to find a voice matching user's language
      currentVoice = voices.find(v => v.lang === userLang) ||
                     voices.find(v => v.lang.startsWith(userLang.split('-')[0])) ||
                     voices.find(v => v.lang.includes('IN')) ||
                     voices[0] || null;
    };
    
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export function speak(messageKey: string, forceLang?: string): void {
  if (!speechSynthesis) {
    console.warn('Speech synthesis not available');
    return;
  }
  
  const lang = forceLang || getUserLanguage();
  const messages = voiceMessages[lang] || voiceMessages['en-IN'];
  const text = messages[messageKey] || voiceMessages['en-IN'][messageKey];
  
  if (!text) {
    console.warn(`No voice message for key: ${messageKey}`);
    return;
  }
  
  // Cancel any ongoing speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1;
  utterance.volume = 1;
  
  if (currentVoice) {
    utterance.voice = currentVoice;
  }
  
  speechSynthesis.speak(utterance);
  
  // Also trigger vibration for tactile feedback
  if ('vibrate' in navigator) {
    navigator.vibrate(200);
  }
}

export function speakCustom(text: string): void {
  if (!speechSynthesis) return;
  
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getUserLanguage();
  utterance.rate = 0.9;
  
  if (currentVoice) {
    utterance.voice = currentVoice;
  }
  
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  speechSynthesis?.cancel();
}

// Vibration patterns
export function vibrateAlert(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

export function vibrateEmergency(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
  }
}

export function vibrateConfirm(): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(100);
  }
}
