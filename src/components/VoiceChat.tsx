import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  initSpeechRecognition, 
  startListening, 
  stopListening, 
  speakText,
  askGuardian 
} from '@/lib/voiceAI';
import { getLanguage } from '@/lib/deviceId';
import { vibrateConfirm } from '@/lib/voiceOutput';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function VoiceChat({ isOpen, onClose }: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  
  const lang = getLanguage();
  
  // Initialize speech recognition
  useEffect(() => {
    if (isOpen) {
      const supported = initSpeechRecognition();
      setIsSupported(supported);
    }
  }, [isOpen]);
  
  // Handle listening
  const handleStartListening = useCallback(async () => {
    setError(null);
    setIsListening(true);
    vibrateConfirm();
    
    try {
      const transcript = await startListening();
      setCurrentTranscript(transcript);
      setIsListening(false);
      
      // Process the message
      await handleSendMessage(transcript);
    } catch (e) {
      console.error('Listening error:', e);
      setIsListening(false);
      setError(lang === 'hi' ? 'सुनने में समस्या। फिर से बोलें।' : 'Could not hear. Try again.');
    }
  }, [lang]);
  
  const handleStopListening = useCallback(() => {
    stopListening();
    setIsListening(false);
  }, []);
  
  // Send message to AI
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setCurrentTranscript('');
    setIsProcessing(true);
    
    try {
      const response = await askGuardian(text, messages);
      
      const assistantMessage: Message = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak the response
      setIsSpeaking(true);
      await speakText(response);
      setIsSpeaking(false);
      
    } catch (e) {
      console.error('AI error:', e);
      setError(lang === 'hi' ? 'जवाब नहीं मिला। फिर से कोशिश करें।' : 'No response. Try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/90 z-50 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 safe-area-top">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">
              {lang === 'hi' ? 'गार्जियन से बात करें' : 'Talk to Guardian'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-white/60 pt-8">
              {lang === 'hi' 
                ? 'माइक दबाएं और बोलें' 
                : 'Press mic and speak'}
            </p>
          )}
          
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white/10 text-white rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          
          {/* Current transcript */}
          {currentTranscript && (
            <motion.div
              className="flex justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="max-w-[80%] p-3 rounded-2xl bg-primary/50 text-white rounded-br-sm">
                {currentTranscript}
              </div>
            </motion.div>
          )}
          
          {/* Processing indicator */}
          {isProcessing && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="p-3 rounded-2xl bg-white/10 text-white rounded-bl-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </motion.div>
          )}
        </div>
        
        {/* Error */}
        {error && (
          <p className="text-center text-destructive text-sm px-4 pb-2">
            {error}
          </p>
        )}
        
        {/* Not supported warning */}
        {!isSupported && (
          <p className="text-center text-yellow-500 text-sm px-4 pb-2">
            {lang === 'hi' 
              ? 'वॉइस इनपुट इस ब्राउज़र में उपलब्ध नहीं है'
              : 'Voice input not available in this browser'}
          </p>
        )}
        
        {/* Mic Button */}
        <div className="p-6 pb-safe-area-bottom flex justify-center">
          <motion.button
            className={`w-20 h-20 rounded-full flex items-center justify-center ${
              isListening 
                ? 'bg-destructive' 
                : isSpeaking 
                  ? 'bg-primary/50' 
                  : 'bg-primary'
            } ${!isSupported || isProcessing ? 'opacity-50' : ''}`}
            whileTap={{ scale: 0.95 }}
            onClick={isListening ? handleStopListening : handleStartListening}
            disabled={!isSupported || isProcessing || isSpeaking}
          >
            {isListening ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <MicOff className="w-8 h-8 text-white" />
              </motion.div>
            ) : isSpeaking ? (
              <Volume2 className="w-8 h-8 text-white animate-pulse" />
            ) : isProcessing ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </motion.button>
        </div>
        
        {/* Status text */}
        <p className="text-center text-white/40 text-sm pb-4 safe-area-bottom">
          {isListening 
            ? (lang === 'hi' ? 'सुन रहा हूं...' : 'Listening...')
            : isSpeaking
              ? (lang === 'hi' ? 'बोल रहा हूं...' : 'Speaking...')
              : isProcessing
                ? (lang === 'hi' ? 'सोच रहा हूं...' : 'Thinking...')
                : (lang === 'hi' ? 'माइक दबाएं' : 'Tap to speak')}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
