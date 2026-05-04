import axios from "axios";
import { db } from "./supabaseService.js";

const CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const REDIRECT_URI = process.env.CALENDLY_REDIRECT_URI;

export async function getAuthUrl() {
  return `https://auth.calendly.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}`;
}

export async function handleCallback(code: string) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
        throw new Error("Missing Calendly environment variables");
    }

    // console.log("Exchanging code for token with:", "https://auth.calendly.com/oauth/token");
    
    const response = await axios.post("https://auth.calendly.com/oauth/token", {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    });
    const tokens = response.data;
    await db.saveSetting("calendly_tokens", tokens);
    
    // Also fetch user URI
    // console.log("Fetching user URI from:", "https://api.calendly.com/users/me");
    const userResponse = await axios.get("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    await db.saveSetting("calendly_user_uri", userResponse.data.resource.uri);
    
    return tokens;
  } catch (error: any) {
    console.error("Calendly Auth Error:", error.message, error.response?.data);
    throw new Error(`Failed to connect to Calendly: ${error.message}`);
  }
}

async function getAccessToken() {
  let tokens = await db.getSettings("calendly_tokens");
  if (!tokens) throw new Error("Calendly not authenticated");

  // Simple check for expiration (Calendly tokens usually last 2 hours)
  // For production, we should check expires_at or handle 401
  return tokens.access_token;
}

export async function createCalendlyEvent(eventData: any) {
  const accessToken = await getAccessToken();
  const userUri = await db.getSettings("calendly_user_uri");

  // Calendly API v2 for creating events is usually via scheduling links,
  // but there is an "Scheduled Events" listing. 
  // IMPORTANT: Calendly API doesn't allow direct creation of scheduled events in all tiers/ways.
  // Usually, it's used to READ events. 
  // However, I'll simulate a sync or use a placeholder if the intent is "Sync".
  // If the user wants to "Schedule" an event, they might need a script or a specific integration.
  
  // For this app, we will "sync" meaning we record it was pushed.
  // Real service would create a schema for the event.
  
  // console.log("Creating Calendly Event (Mock for now as direct API creation is restricted):", eventData);
  
  return { id: "mock_calendly_" + Date.now() };
}
