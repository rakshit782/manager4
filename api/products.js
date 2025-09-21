import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    // ✅ Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ✅ Fetch Shopify credentials (adjusted to your schema)
    const { data, error } = await supabase
      .from("shopify_credentials")
      .select("store_name, access_token")
      .single();

    if (error) throw error;
    if (!data) return res.status(500).json({ error: "No Shopify credentials found in Supabase" });

    const { store_name, access_token } = data;
    const apiVersion = "2025-01";
    let url = `https://${store_name}/admin/api/${apiVersion}/products.json?limit=250`;

    let products = [];

    // ✅ Loop until no "next" page from Shopify
    while (url) {
      const response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": access_token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ error: text });
      }

      const pageData = await response.json();
      if (pageData.products) products = products.concat(pageData.products);

      // ✅ Check pagination in Link header
      const linkHeader = response.headers.get("link");
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }
    }

    // ✅ Return all products
    return res.status(200).json({ products, count: products.length });
  } catch (err) {
    console.error("Error fetching Shopify products:", err);
    return res.status(500).json({ error: err.message });
  }
}
