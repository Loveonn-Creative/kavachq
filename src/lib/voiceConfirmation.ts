// Simple voice confirmation system for 1-2 word commands
// Supports multilingual recognition (English, Hindi, Tamil)

import { speak, vibrateAlert, vibrateConfirm } from './voiceOutput';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type ConfirmationResult = 'ok' | 'danger' | 'timeout' | 'cancelled';

export interface VoiceConfirmationOptions {
  onResult: (result: ConfirmationResult, responseTimeMs: number) => void;
  onListening?: (isListening: boolean) => void;
  onTranscript?: (text: string) => void;
  timeoutMs?: number;
  language?: string;
}

// Keyword dictionaries for each intent
const OK_KEYWORDS: Record<string, string[]> = {
  'en-IN': ['okay', 'ok', 'fine', 'good', 'safe', 'alright', "i'm fine", 'im fine', 'all good', 'no problem', 'yes'],
  'hi-IN': ['theek', 'theek hai', 'sahi', 'accha', 'acha', 'mast', 'okay', 'thik', 'haan', 'ha'],
  'ta-IN': ['nalla', 'sari', 'paravala', 'okay', 'nandraga', 'nallam', 'aamaa', 'aama'],
};

const DANGER_KEYWORDS: Record<string, string[]> = {
  'en-IN': ['help', 'danger', 'emergency', 'accident', 'stop', 'call', 'hurt', 'injured', 'no', 'not okay', 'bad'],
  'hi-IN': ['madad', 'bachao', 'khatara', 'khatre', 'emergency', 'durghatna', 'ruko', 'nahi', 'na'],
  'ta-IN': ['udavi', 'aabathu', 'apatthu', 'emergency', 'accident', 'nillu', 'illa', 'vendam'],
};

// Get user's preferred language
function getUserLanguage(): string {
  try {
    const stored = localStorage.getItem('kavach_language');
    if (stored) return stored;
  } catch {
    // Ignore
  }
  return 'en-IN';
}

// Fuzzy match keywords (handles accents and variations)
function fuzzyMatch(input: string, keywords: string[]): boolean {
  const normalized = input.toLowerCase().trim();
  
  for (const keyword of keywords) {
    // Exact match
    if (normalized === keyword) return true;
    
    // Contains match for short keywords
    if (keyword.length <= 4 && normalized.includes(keyword)) return true;
    
    // Fuzzy match: allow 1 character difference for longer words
    if (keyword.length > 4) {
      const distance = levenshteinDistance(normalized, keyword);
      if (distance <= 1) return true;
    }
    
    // Word boundary match
    const words = normalized.split(/\s+/);
    if (words.some(w => w === keyword || levenshteinDistance(w, keyword) <= 1)) return true;
  }
  
  return false;
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Classify speech input
function classifyInput(text: string, language: string): 'ok' | 'danger' | null {
  // Check all languages for better recognition
  const languages = [language, 'en-IN', 'hi-IN', 'ta-IN'];
  
  for (const lang of languages) {
    const okWords = OK_KEYWORDS[lang] || [];
    const dangerWords = DANGER_KEYWORDS[lang] || [];
    
    // Check danger first (higher priority for safety)
    if (fuzzyMatch(text, dangerWords)) return 'danger';
    if (fuzzyMatch(text, okWords)) return 'ok';
  }
  
  return null;
}

// Voice confirmation listener class
class VoiceConfirmationListener {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private startTime = 0;
  private timeoutId: number | null = null;
  private options: VoiceConfirmationOptions | null = null;
  private cancelled = false;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.options?.onListening?.(true);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.options?.onListening?.(false);
      
      // If still waiting and not cancelled, restart listening
      if (this.options && !this.cancelled && this.timeoutId) {
        try {
          this.recognition?.start();
        } catch {
          // Already started or stopped
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      
      // Don't treat no-speech as fatal error
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.handleResult('timeout');
      }
    };

    this.recognition.onresult = (event) => {
      // Check all results and alternatives
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        for (let j = 0; j < result.length; j++) {
          const transcript = result[j].transcript;
          this.options?.onTranscript?.(transcript);
          
          const language = getUserLanguage();
          const classification = classifyInput(transcript, language);
          
          if (classification) {
            this.handleResult(classification);
            return;
          }
        }
      }
    };
  }

  private handleResult(result: ConfirmationResult): void {
    if (this.cancelled) return;
    
    const responseTime = Date.now() - this.startTime;
    
    this.stop();
    
    if (result === 'ok') {
      vibrateConfirm();
    } else if (result === 'danger') {
      vibrateAlert();
    }
    
    this.options?.onResult(result, responseTime);
  }

  start(options: VoiceConfirmationOptions): boolean {
    if (!this.recognition) {
      // Fallback: just use timeout
      options.onResult('timeout', options.timeoutMs || 5000);
      return false;
    }

    this.options = options;
    this.cancelled = false;
    this.startTime = Date.now();

    // Set language
    const language = options.language || getUserLanguage();
    this.recognition.lang = language;

    // Start timeout
    const timeoutMs = options.timeoutMs || 5000;
    this.timeoutId = window.setTimeout(() => {
      this.handleResult('timeout');
    }, timeoutMs);

    // Speak prompt
    speak('are_you_okay');

    // Start listening after a short delay for the prompt to play
    setTimeout(() => {
      try {
        this.recognition?.start();
      } catch (e) {
        console.warn('Failed to start recognition:', e);
      }
    }, 500);

    return true;
  }

  stop(): void {
    this.cancelled = true;
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    try {
      this.recognition?.stop();
    } catch {
      // Already stopped
    }

    this.isListening = false;
    this.options?.onListening?.(false);
    this.options = null;
  }

  cancel(): void {
    this.handleResult('cancelled');
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

// Singleton instance
export const voiceConfirmation = new VoiceConfirmationListener();

// Convenience function for one-shot confirmation
export function requestVoiceConfirmation(
  onResult: (result: ConfirmationResult, responseTimeMs: number) => void,
  timeoutMs = 5000
): () => void {
  voiceConfirmation.start({
    onResult,
    timeoutMs,
  });

  // Return cancel function
  return () => voiceConfirmation.stop();
}
