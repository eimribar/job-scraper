/**
 * Test OpenAI API directly
 */

require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai').default;

async function testOpenAI() {
  console.log('🧪 Testing OpenAI API');
  console.log('Model:', process.env.OPENAI_MODEL);
  console.log('API Key:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 20)}...` : 'Missing');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found');
    return;
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('\n🔄 Making test request...');
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini-2025-08-07',
      messages: [
        { 
          role: 'system', 
          content: 'You must respond with ONLY valid JSON. No explanation. Just the JSON object:\n\n{"message": "Hello, test successful!", "status": "working"}' 
        },
        { role: 'user', content: 'Generate the JSON response as instructed.' }
      ],
      max_completion_tokens: 500,
    });

    console.log('\n✅ Response received:');
    console.log('Model used:', response.model);
    console.log('Content:', response.choices[0]?.message?.content);
    console.log('Full response structure:');
    console.log(JSON.stringify(response, null, 2));

  } catch (error) {
    console.error('\n❌ OpenAI API Error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testOpenAI().catch(console.error);