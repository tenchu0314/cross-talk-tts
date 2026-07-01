import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const TTS_SERVER_URL = process.env.TTS_SERVER_URL || 'http://localhost:8088';

app.use(cors());
app.use(express.json());

// TTS Server Health Check
app.get('/api/tts/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check connection by sending a small probe or checking server status
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout

    // We can probe the server root or health if exists, or just catch fetch connection errors
    const response = await fetch(TTS_SERVER_URL, {
      method: 'GET',
      signal: controller.signal,
    }).catch((err) => {
      // If it's a 404/405/etc but reached the server, that's fine.
      // But connection refused will throw.
      if (err.name === 'AbortError') {
        throw new Error('Timeout connecting to TTS Server');
      }
      throw err;
    });

    clearTimeout(timeoutId);
    res.json({ status: 'ok', url: TTS_SERVER_URL });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: `Irodori-TTS-Server is not responding. Please make sure it is running at ${TTS_SERVER_URL}.`,
      details: error.message
    });
  }
});

// Get Speaker Configuration
app.get('/api/config', (req: Request, res: Response): void => {
  res.json({
    speaker1Name: process.env.SPEAKER1_NAME || 'Speaker1',
    speaker2Name: process.env.SPEAKER2_NAME || 'Speaker2',
  });
});

// Debate Script Generator via Gemini API
app.post('/api/debate', async (req: Request, res: Response): Promise<void> => {
  const { topic } = req.body;
  if (!topic) {
    res.status(400).json({ error: 'Topic is required' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not set in backend .env file' });
    return;
  }

  const speaker1Name = process.env.SPEAKER1_NAME || 'Speaker1';
  const speaker1Prompt = process.env.SPEAKER1_PROMPT || '';
  const speaker2Name = process.env.SPEAKER2_NAME || 'Speaker2';
  const speaker2Prompt = process.env.SPEAKER2_PROMPT || '';

  // 討論ルールの文章全体。DEBATE_RULES が設定されていればそちらを使う。
  const defaultDebateRules = `
1. 討論はフリートークではなく、議題に対する本格的な討論としてください。
2. 客観的で正確な討論にするため、必ず検索機能（Google Search Grounding）を利用して、データや論拠となる情報を取得・引用してください。
3. 2人は交互に話します。議論が深まるように、お互いの主張に論理的かつ説得力のある応答をさせてください。
4. 会話は可能な限り長く（各発言者が最低4〜5回発言するよう、合計8〜10ターン以上）作成してください。`;
  const rulesText = process.env.DEBATE_RULES || defaultDebateRules;

  const systemPrompt = `
あなたは討論の台本を生成するアシスタントです。
以下の議題に基づいて、2人のキャラクター（Speaker1: ${speaker1Name}, Speaker2: ${speaker2Name}）による対談形式の討論台本を作成してください。

議題: 「${topic}」

キャラクターの性格・話し方設定:
- Speaker1 (${speaker1Name}): ${speaker1Prompt}
- Speaker2 (${speaker2Name}): ${speaker2Prompt}

討論ルール:
${rulesText}

出力形式:
以下のフォーマットのように、発言者、発言時の感情(emotion: default / serious / angry のいずれか)、発言名、そして発言内容を記述してください。

Speaker1 [emotion: serious] (${speaker1Name}): 発言内容...
Speaker2 [emotion: default] (${speaker2Name}): 発言内容...
`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    console.log('Gemini Step 1: Generating script with Google Search...');
    
    // Step 1: Text Generation with Google Search enabled
    const step1Response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: systemPrompt
              }
            ]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ]
      }),
    });

    if (!step1Response.ok) {
      const errorText = await step1Response.text();
      throw new Error(`Gemini Step 1 error: ${step1Response.status} - ${errorText}`);
    }

    const step1Data: any = await step1Response.json();
    const rawText = step1Data.candidates?.[0]?.content?.parts?.[0]?.text;
    const searchQueries: string[] = step1Data.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];
    
    if (!rawText) {
      throw new Error('Gemini Step 1 did not return generated text');
    }

    console.log('Gemini Step 1 complete. Search queries:', searchQueries);
    console.log('Gemini Step 2: Structuring script to JSON...');

    // Step 2: Parse and format to JSON schema (without tools, with responseSchema)
    const step2Prompt = `
以下の討論テキストを解析し、指定されたJSONスキーマに完全に従って構造化されたJSONに変換してください。
会話のテキスト、発言者(Speaker1/Speaker2)、感情指定(default/serious/angry)を正確に抽出してください。

討論テキスト:
${rawText}
`;

    const step2Response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: step2Prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              topic: { type: 'STRING' },
              turns: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    speaker: { type: 'STRING', enum: ['Speaker1', 'Speaker2'] },
                    text: { type: 'STRING', description: 'キャラクターのセリフ（日本語、1〜3文程度）' },
                    emotion: { type: 'STRING', enum: ['default', 'serious', 'angry'] }
                  },
                  required: ['speaker', 'text', 'emotion']
                }
              }
            },
            required: ['topic', 'turns']
          }
        }
      }),
    });

    if (!step2Response.ok) {
      const errorText = await step2Response.text();
      throw new Error(`Gemini Step 2 error: ${step2Response.status} - ${errorText}`);
    }

    const step2Data: any = await step2Response.json();
    const jsonText = step2Data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) {
      throw new Error('Gemini Step 2 did not return valid JSON text');
    }

    // Parse and merge search queries
    const debateData = JSON.parse(jsonText);
    debateData.search_queries = searchQueries;
    
    console.log('Gemini Step 2 complete. Successfully structured debate script.');
    res.json(debateData);
  } catch (error: any) {
    console.error('Debate generation failed:', error);
    res.status(500).json({ error: 'Failed to generate debate script', details: error.message });
  }
});

// Proxy to Irodori-TTS-Server
app.post('/api/tts', async (req: Request, res: Response): Promise<void> => {
  const { text, speaker, speed } = req.body;
  if (!text || !speaker) {
    res.status(400).json({ error: 'text and speaker are required' });
    return;
  }

  try {
    const ttsUrl = `${TTS_SERVER_URL}/v1/audio/speech`;
    
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'irodori-tts',
        input: text,
        voice: speaker, // Speaker1 or Speaker2
        response_format: 'wav',
        speed: speed !== undefined ? speed : 1.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS server error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/wav');
    res.send(buffer);
  } catch (error: any) {
    console.error('TTS request failed:', error);
    res.status(500).json({ error: 'Failed to generate speech', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
