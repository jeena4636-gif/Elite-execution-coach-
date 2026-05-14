import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CoachResponse {
  realityCheck: string;
  exactAction: string;
  timeConstraint: string;
  command: string;
  bottleneck: "laziness" | "fear" | "confusion" | "clarity" | "distraction";
}

const SYSTEM_PROMPT = `You are an elite execution coach for high-performance individuals who struggle with procrastination.

Your role is NOT to comfort, motivate casually, or give multiple options.

Your role is to:
- Diagnose the user's situation quickly
- Identify the REAL bottleneck (laziness, fear, confusion, lack of clarity, distraction)
- Give ONE clear, specific, actionable instruction
- Push the user toward immediate execution

STRICT RULES:
1. Never give multiple options. Give only ONE best action.
2. No vague advice. Every answer must be specific and time-bound.
3. No over-explaining. Be sharp, direct, and slightly intimidating.
4. Do not allow excuses. Call them out logically.
5. Focus on execution, not theory.
6. If the user is confused, simplify the task into the smallest possible step.
7. Always end with a command or challenge.

TONE:
- Ruthless but intelligent
- Direct, no sugarcoating
- Confident and authoritative
- Never abusive, but confrontational when needed

The output MUST be in JSON format matching the schema provided.`;

export async function getCoachingResponse(situation: string, tasks: string): Promise<CoachResponse> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ 
        parts: [{ 
          text: `User situation: ${situation}\n\nPending Tasks (one per line):\n${tasks}` 
        }] 
      }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            realityCheck: { type: Type.STRING, description: "1-2 lines calling out the truth of their situation." },
            exactAction: { type: Type.STRING, description: "Clear, step-by-step instruction for ONE action." },
            timeConstraint: { type: Type.STRING, description: "Deadline or urgency (e.g., '10 minutes', '30 minutes')." },
            command: { type: Type.STRING, description: "A final push or challenge." },
            bottleneck: { 
              type: Type.STRING, 
              enum: ["laziness", "fear", "confusion", "clarity", "distraction"],
              description: "The diagnosed bottleneck."
            }
          },
          required: ["realityCheck", "exactAction", "timeConstraint", "command", "bottleneck"]
        }
      }
    });

    const text = response.text;
    
    if (!text) {
      // Check if safety ratings blocked it
      const safetyRatings = response.promptFeedback?.safetyRatings;
      if (safetyRatings?.some(r => r.probability !== "NEGLIGIBLE" && r.probability !== "LOW")) {
        throw new Error("SITUATION_BLOCKED: Content flagged by safety protocols.");
      }
      throw new Error("EMPTY_RESPONSE: The coach remained silent.");
    }

    try {
      return JSON.parse(text) as CoachResponse;
    } catch (e) {
      console.error("JSON Parse Error:", text);
      throw new Error("MALFORMED_INTEL: Failed to process intelligence report.");
    }
  } catch (err: any) {
    if (err.message?.includes("SITUATION_BLOCKED") || err.message?.includes("MALFORMED_INTEL") || err.message?.includes("EMPTY_RESPONSE")) {
      throw err;
    }
    
    // API Errors
    if (err.status === 429) throw new Error("OVERLOADED: Too many requests. Cool down.");
    if (err.status === 503) throw new Error("UNAVAILABLE: Satellite link down. Try later.");
    
    throw new Error(`COMLINK_ERROR: ${err.message || "Unknown tactical failure."}`);
  }
}
