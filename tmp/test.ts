import { createClient } from "@supabase/supabase-js";

// Hardcoded for testing since process.env requires dotenv
const supabase = createClient(
  "https://hchyoyctxrxmxpdkjqyp.supabase.co",
  "sb_publishable_C4pdiWyhducTjDO8FHMkIA_57jEWOKO"
);

async function main() {
  console.log("Invoking edge function sync-google-sheets...");
  // Pass dummy login token or try without, the edge function will reject but we want to see the error payload
  try {
    const { data, error } = await supabase.functions.invoke('sync-google-sheets', {
      body: { spreadsheetId: "1Y0KEaFKapkRpzuKDGIF_KPzbFi9LAbIdCZ2q8qX6HeY" }
    });
    
    if (error) {
      console.error("Function returned an error object:");
      console.error(error);
      if (error.context) {
        try {
          const body = await error.context.json();
          console.error("Exact JSON error body:");
          console.error(body);
        } catch (e) {
          const text = await error.context.text();
          console.error("Exact Text error body:");
          console.error(text);
        }
      }
    } else {
      console.log("Success:", data);
    }
  } catch (err) {
    console.error("Caught exception:");
    console.error(err);
  }
}

main();
