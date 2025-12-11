import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1sV2nkeloZIZp6uVFaO-j_1NukbC69u-nkAy_qktDEYs';
const SHEET_NAME = 'Sheet1';

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const textEncoder = new TextEncoder();
  
  const base64UrlEncode = (data: Uint8Array): string => {
    return btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerBase64 = base64UrlEncode(textEncoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const signatureInput = `${headerBase64}.${payloadBase64}`;

  // Import the private key
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .trim();

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    textEncoder.encode(signatureInput)
  );

  const signatureBase64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureBase64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  
  if (!tokenData.access_token) {
    console.error('Token response:', tokenData);
    throw new Error('Failed to get access token');
  }
  
  return tokenData.access_token;
}

async function readSheet(accessToken: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Sheets API error:', error);
    throw new Error(`Failed to read sheet: ${response.status}`);
  }

  const data = await response.json();
  return data.values || [];
}

async function updateCell(accessToken: string, range: string, value: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=RAW`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[value]],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google Sheets API update error:', error);
    throw new Error(`Failed to update cell: ${response.status}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      console.error('GOOGLE_SERVICE_ACCOUNT secret not configured');
      return new Response(
        JSON.stringify({ error: 'Google service account not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let serviceAccount: ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      console.error('Failed to parse service account JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid service account configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, email, rowIndex, data } = await req.json();
    console.log(`Processing action: ${action} for email: ${email}`);

    const accessToken = await getAccessToken(serviceAccount);
    const sheetData = await readSheet(accessToken);

    if (action === 'read') {
      // Find user's row by email (column A)
      let userRow: string[] | null = null;
      let foundRowIndex = -1;

      for (let i = 1; i < sheetData.length; i++) { // Skip header row
        if (sheetData[i][0]?.toLowerCase() === email.toLowerCase()) {
          userRow = sheetData[i];
          foundRowIndex = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }

      if (userRow) {
        return new Response(
          JSON.stringify({
            found: true,
            userData: {
              email: userRow[0] || '',
              tel: userRow[1] || '',
              topic: userRow[2] || '',
              keyword: userRow[3] || '',
              title: userRow[4] || '',
              igLink: userRow[5] || '',
              rowIndex: foundRowIndex,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ found: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'update') {
      // Verify the email matches the row
      const currentRow = sheetData[rowIndex - 1];
      if (!currentRow || currentRow[0]?.toLowerCase() !== email.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Email mismatch' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update each field (columns B-F, row is rowIndex)
      const updates = [
        { col: 'B', value: data.tel },
        { col: 'C', value: data.topic },
        { col: 'D', value: data.keyword },
        { col: 'E', value: data.title },
        { col: 'F', value: data.igLink },
      ];

      for (const update of updates) {
        await updateCell(accessToken, `${SHEET_NAME}!${update.col}${rowIndex}`, update.value || '');
      }

      console.log(`Successfully updated row ${rowIndex} for ${email}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
