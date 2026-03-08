import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-runtime, x-supabase-client-platform, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// Prüfen ob STRIPE_SECRET_KEY existiert
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")
if (!stripeKey) {
  console.error("❌ STRIPE_SECRET_KEY ist nicht gesetzt! Bitte in Supabase Secrets eintragen.")
}

const stripe = new Stripe(stripeKey!, { apiVersion: "2023-10-16" })

function amountFromTier(tier: number): number {
  switch (tier) {
    case 1: return 100
    case 5: return 500
    case 10: return 1000
    default: throw new Error("Invalid tier")
  }
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  try {
    const { row, col, text, tier } = await req.json()

    if (
      typeof row !== "number" ||
      typeof col !== "number" ||
      typeof text !== "string" ||
      typeof tier !== "number"
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const amount = amountFromTier(tier)

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        row: String(row),
        col: String(col),
        tier: String(tier),
        text: String(text)
      },
    })

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("🔥 Edge Function Error:", err)
    return new Response(
      JSON.stringify({ error: "Server error", details: String(err) }),
      { status: 500, headers: corsHeaders }
    )
  }
})
