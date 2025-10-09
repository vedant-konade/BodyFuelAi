const dotenv = require('dotenv');
dotenv.config();
const fetch = require("node-fetch");

const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
if (!NEBIUS_API_KEY) {
  throw new Error("Missing API Key. Set NEBIUS_API_KEY in the environment.");
}

// Helper function to extract JSON from AI response
function extractJsonFromText(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return jsonMatch[0]; // Extract valid JSON
  }
  
  console.warn("⚠️ No valid JSON found in AI response. Returning fallback.");
  return JSON.stringify({
    days: [
      {
        day: "Day 1",
        meals: [
          { 
            type: "Breakfast", 
            name: "Default breakfast", 
            ingredients: ["Ingredients not parsed"], 
            instructions: text,
            prepTime: 30,
            calories: 300,
            protein: 15,
            carbs: 30,
            fat: 10
          }
        ]
      }
    ]
  });
}

// -------------------- GENERATE MEAL PLAN --------------------
const generateMealPlan = async (preferences, allergies, pantryItems, calorieTarget, additionalInstructions = '') => {
  try {
    const prompt = `
      Generate a 3-day meal plan (breakfast, lunch, and dinner) based on:
      
      - Dietary preferences: ${preferences.join(', ') || 'None'}
      - Allergies to avoid: ${allergies.join(', ') || 'None'}
      - Available pantry items: ${pantryItems.join(', ') || 'None'}
      - Daily calorie target: ${calorieTarget || 2000} calories
      
      ${additionalInstructions ? `Additional instructions: ${additionalInstructions}` : ''}

      Output format:
      {
        "days": [
          {
            "day": "Day 1",
            "meals": [
              {
                "type": "Breakfast",
                "name": "Meal name",
                "ingredients": ["ingredient 1", "ingredient 2"],
                "instructions": "Cooking instructions",
                "prepTime": 15,
                "calories": 400,
                "protein": 20,
                "carbs": 30,
                "fat": 15
              }
            ]
          }
        ]
      }
    `;

    console.log('🔹 Sending Prompt to Nebius:', prompt);

    const response = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEBIUS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
        messages: [
          { role: "system", content: "You are a helpful meal planning assistant that creates personalized meal plans." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const data = await response.json();

    console.log("🔹 Raw Nebius Response:", data);

    // Now check the correct structure
    if (!data?.choices || !data.choices.length || !data.choices[0]?.message?.content) {
      throw new Error("Invalid response from Nebius API: Missing choices/message/content");
    }

    const rawResponse = data.choices[0].message.content;

    const jsonStr = extractJsonFromText(rawResponse);
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('❌ Error generating meal plan:', error);
    throw new Error('Failed to generate meal plan: ' + error.message);
  }
};

// -------------------- GENERATE CHATBOT RESPONSE --------------------
const generateChatbotResponse = async (userMessage, history = [], userPreferences = null) => {
  try {
    // Prepare conversation history
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      content: msg.content
    })).slice(-6);

    // Personalized system message
    let systemMessage = "You are Chef Byte, an energetic, funny, and optimistic AI assistant specializing in dietary advice, nutrition, and meal planning.";

    if (userPreferences) {
      if (userPreferences.dietaryPreferences?.length) {
        systemMessage += ` Dietary preferences: ${userPreferences.dietaryPreferences.join(', ')}.`;
      }
      if (userPreferences.allergies?.length) {
        systemMessage += ` Allergies: ${userPreferences.allergies.join(', ')}.`;
      }
      if (userPreferences.calorieTarget) {
        systemMessage += ` Daily calorie target: ${userPreferences.calorieTarget} calories.`;
      }
    }

    // Personality & formatting instructions
    systemMessage += `
    Response style:
    - Concise (under 120 words)
    - Friendly, humorous, positive
    - Markdown formatting
    - Bullet points for lists
    `;

    // Build messages array
    const messages = [
      { role: "system", content: systemMessage },
      ...formattedHistory,
      { role: "user", content: userMessage }
    ];

    // Send request to Nebius
    const response = await fetch("https://api.studio.nebius.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEBIUS_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
        messages: messages,
        max_tokens: 250,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const data = await response.json();
    console.log("🔹 Raw Nebius Chatbot Response:", data);

    if (!data?.choices?.length || !data.choices[0]?.message?.content) {
      throw new Error("Invalid response from Nebius API: Missing choices/message/content");
    }

    return data.choices[0].message.content;

  } catch (error) {
    console.error('❌ Error generating chatbot response:', error);
    throw new Error('Failed to generate chatbot response: ' + error.message);
  }
};

module.exports = { 
  generateMealPlan,
  generateChatbotResponse
};
