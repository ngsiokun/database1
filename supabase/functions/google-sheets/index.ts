import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1sV2nkeloZIZp6uVFaO-j_1NukbC69u-nkAy_qktDEYs';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw_x8sPwzp1AJM-gUQyhJ5IjeCiMIH6YWG999eMrtr9fNC4mGFqCQQ53Zy_BtPUu9CMhA/exec';

async function readPublicSheet(): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
  
  console.log('Fetching spreadsheet from:', url);
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error('Failed to fetch spreadsheet:', response.status);
    throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
  }

  const csvText = await response.text();
  console.log('CSV content length:', csvText.length);
  
  // Parse CSV
  const rows: string[][] = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      rows.push(cells);
    }
  }
  
  console.log('Parsed rows:', rows.length);
  return rows;
}

async function updateGoogleSheet(data: {
  email: string;
  tel: string;
  topic: string;
  keyword: string;
  title: string;
  igLink: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('Updating Google Sheet via Apps Script:', data);
  
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    console.log('Apps Script response:', result);
    return result;
  } catch (error) {
    console.error('Error calling Apps Script:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email, data } = await req.json();
    console.log(`Processing action: ${action} for email: ${email}`);

    if (action === 'read') {
      const sheetData = await readPublicSheet();
      console.log('Sheet data rows:', sheetData.length);
      
      // Find user's row by email (column A)
      let userRow: string[] | null = null;
      let foundRowIndex = -1;

      for (let i = 1; i < sheetData.length; i++) {
        const rowEmail = sheetData[i][0]?.toLowerCase().trim();
        console.log(`Row ${i} email: "${rowEmail}" vs "${email.toLowerCase().trim()}"`);
        if (rowEmail === email.toLowerCase().trim()) {
          userRow = sheetData[i];
          foundRowIndex = i + 1;
          console.log('Found matching row:', userRow);
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
        console.log('No matching row found for email:', email);
        return new Response(
          JSON.stringify({ found: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'update') {
      const result = await updateGoogleSheet({
        email,
        tel: data.tel || '',
        topic: data.topic || '',
        keyword: data.keyword || '',
        title: data.title || '',
        igLink: data.igLink || '',
      });
      
      return new Response(
        JSON.stringify(result),
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
