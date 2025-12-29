import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language = 'en' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // System prompt for KAVACH Guardian AI
    const systemPrompt = language === 'hi' ? 
      `आप KAVACH हैं - भारत के गिग वर्कर्स के लिए एक AI सुरक्षा गार्जियन।
      
      आपकी भूमिका:
      - संक्षिप्त, स्पष्ट हिंदी में बोलें (2-3 वाक्य अधिकतम)
      - सुरक्षा सलाह, मौसम की चेतावनी, और आराम की याद दिलाएं
      - आपातकाल में तुरंत मदद करें
      - कभी व्याख्यान न दें - बस मददगार बनें
      - वर्कर की सुरक्षा और स्वास्थ्य सबसे पहले
      
      उत्तर हमेशा बोलने योग्य रखें - छोटे, स्पष्ट, कार्रवाई योग्य।` :
      
      `You are KAVACH - an AI safety guardian for India's gig workers.
      
      Your role:
      - Speak in brief, clear sentences (2-3 max)
      - Give safety tips, weather warnings, rest reminders
      - Help immediately in emergencies
      - Never lecture - just be helpful
      - Worker safety and health comes first
      
      Keep responses speakable - short, clear, actionable.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Usage limit reached.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI service temporarily unavailable');
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Voice guardian error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
