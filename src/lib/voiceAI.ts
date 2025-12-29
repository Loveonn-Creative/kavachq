// Two-way voice AI communication with Gemini
import { getLanguage } from './deviceId';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-guardian`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Speech recognition setup
let recognition: any = null;

export function initSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  
  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    console.warn('Speech recognition not supported');
    return false;
  }
  
  recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = getLanguage() === 'hi' ? 'hi-IN' : 'en-IN';
  
  return true;
}

// Start listening for voice input
export function startListening(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!recognition) {
      if (!initSpeechRecognition()) {
        reject(new Error('Speech recognition not available'));
        return;
      }
    }
    
    recognition!.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };
    
    recognition!.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      reject(new Error(event.error));
    };
    
    recognition!.onend = () => {
      // If no result was captured
    };
    
    try {
      recognition!.start();
    } catch (e) {
      reject(e);
    }
  });
}

// Stop listening
export function stopListening(): void {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Ignore errors when stopping
    }
  }
}

// Speak text using TTS
export function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not available');
      resolve();
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = getLanguage();
    
    // Set language based on user preference
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to find a suitable voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(lang === 'hi' ? 'hi' : 'en') && v.localService
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    
    window.speechSynthesis.speak(utterance);
  });
}

// Stream chat response from Gemini AI
export async function streamChat(
  messages: Message[],
  onDelta: (text: string) => void,
  onDone: () => void
): Promise<void> {
  const language = getLanguage();
  
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, language }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to connect to guardian');
    }
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process SSE lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;
        
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // Incomplete JSON, continue
        }
      }
    }
    
    onDone();
  } catch (error) {
    console.error('Voice AI error:', error);
    throw error;
  }
}

// Have a conversation with the AI guardian
export async function askGuardian(
  userMessage: string,
  conversationHistory: Message[] = []
): Promise<string> {
  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];
  
  let response = '';
  
  await streamChat(
    messages,
    (delta) => { response += delta; },
    () => {}
  );
  
  return response;
}
