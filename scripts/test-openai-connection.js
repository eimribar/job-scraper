#!/usr/bin/env node

/**
 * Test OpenAI API connection with GPT-5-mini
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🤖 Testing OpenAI API connection...\n');

if (!OPENAI_API_KEY) {
  console.error('❌ OpenAI API key not found in .env.local');
  process.exit(1);
}

console.log('API Key:', OPENAI_API_KEY.substring(0, 20) + '...');

async function testOpenAI() {
  try {
    console.log('\n📝 Testing GPT-5-mini model...');
    
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: 'Test connection. Reply with: {"status": "connected"}',
        reasoning: { 
          effort: 'minimal'
        },
        text: { 
          verbosity: 'low'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI API error ${response.status}:`, errorText.substring(0, 200));
      
      if (response.status === 401) {
        console.log('\n⚠️  Invalid API key. Please check your OpenAI API key.');
      } else if (response.status === 404) {
        console.log('\n⚠️  GPT-5-mini model not found. You may not have access to GPT-5.');
      }
      return;
    }

    const data = await response.json();
    console.log('✅ OpenAI API connected successfully!');
    
    // Extract response text
    let outputText = '';
    if (data.output && Array.isArray(data.output) && data.output.length > 1) {
      const messageOutput = data.output[1];
      if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
        const textContent = messageOutput.content.find(c => c.type === 'output_text');
        if (textContent && textContent.text) {
          outputText = textContent.text;
        }
      }
    }
    
    console.log('Response:', outputText || 'Connected (no text response)');
    console.log('\n🎉 OpenAI GPT-5-mini is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing OpenAI:', error.message);
    if (error.message.includes('fetch')) {
      console.log('\n⚠️  Network error. Please check your internet connection.');
    }
  }
}

testOpenAI().catch(console.error);