import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1sV2nkeloZIZp6uVFaO-j_1NukbC69u-nkAy_qktDEYs';

async function readPublicSheet(): Promise<string[][]> {
  // Use the public CSV export URL
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error('Failed to fetch spreadsheet:', response.status);
    throw new Error(`Failed to fetch spreadsheet: ${response.status}`);
  }

  const csvText = await response.text();
  
  // Parse CSV
  const rows: string[][] = [];
  const lines = csvText.split('\n');
  
  for (const line of lines) {
    if (line.trim()) {
      // Simple CSV parsing (handles basic cases)
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
  
  return rows;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email } = await req.json();
    console.log(`Processing action: ${action} for email: ${email}`);

    if (action === 'read') {
      const sheetData = await readPublicSheet();
      
      // Find user's row by email (column A)
      let userRow: string[] | null = null;
      let foundRowIndex = -1;

      for (let i = 1; i < sheetData.length; i++) { // Skip header row
        if (sheetData[i][0]?.toLowerCase() === email.toLowerCase()) {
          userRow = sheetData[i];
          foundRowIndex = i + 1; // 1-indexed
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
