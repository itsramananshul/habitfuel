// ── Nutrition API: USDA FoodData Central + Open Food Facts fallback ──

const USDA_API_KEY = "3xfW4ib6a6Tg8BhxkYckndMf4HIlNgvYKe6yUrcV";

// ── USDA FoodData Central ───────────────────────────────────
async function fetchUSDA(query, isCooked) {
  const searchTerm = isCooked ? `${query} cooked` : query;

  // Foundation & SR Legacy always store nutrients per 100g — no serving-size math needed
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&dataType=Foundation,SR%20Legacy&pageSize=10&api_key=${USDA_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA request failed");
  const data = await res.json();

  let foods = data.foods || [];

  // If nothing found, fall back to all types and normalise by servingSize
  if (foods.length === 0) {
    const fbRes = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&pageSize=10&api_key=${USDA_API_KEY}`);
    if (!fbRes.ok) throw new Error("USDA request failed");
    const fbData = await fbRes.json();
    foods = fbData.foods || [];
  }

  if (foods.length === 0) throw new Error("No USDA results");

  // Pick the best match: prefer entries whose description closely matches the query
  // and avoid "breaded", "fried", "with sauce" variants unless user asked for them
  const queryLower = searchTerm.toLowerCase();
  const avoid = ["breaded", "battered", "fried", "with sauce", "stuffed", "frozen", "canned", "flavored"];

  let food = foods.find(f => {
    const desc = f.description.toLowerCase();
    return !avoid.some(word => desc.includes(word));
  }) || foods[0]; // fall back to first if everything is "avoided"

  // For Branded foods servingSize may be set (e.g. 284g); normalise to per-100g
  const servingSize = food.servingSize && food.servingSize > 0 ? food.servingSize : 100;
  const normFactor  = 100 / servingSize;

  const nutrients = {};
  (food.foodNutrients || []).forEach(n => {
    const num  = String(n.nutrientNumber || "");
    const name = (n.nutrientName || "").toLowerCase();
    const unit = (n.unitName || "").toLowerCase();

    // Energy: nutrient number 208 = kcal (confirmed from real API response)
    if (num === "208" || (name.includes("energy") && unit === "kcal")) {
      nutrients.calories = n.value;
    }
    // Protein: nutrient number 203
    if (num === "203") nutrients.protein = n.value;
    // Carbohydrate: nutrient number 205
    if (num === "205") nutrients.carbs = n.value;
    // Total fat: nutrient number 204
    if (num === "204") nutrients.fat = n.value;
  });

  return {
    source: "USDA",
    foodName: food.description,
    per100g: {
      calories: Math.round((nutrients.calories || 0) * normFactor * 10)  / 10,
      protein:  Math.round((nutrients.protein  || 0) * normFactor * 100) / 100,
      carbs:    Math.round((nutrients.carbs    || 0) * normFactor * 100) / 100,
      fat:      Math.round((nutrients.fat      || 0) * normFactor * 100) / 100,
    }
  };
}

// ── Open Food Facts ─────────────────────────────────────────
async function fetchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Open Food Facts request failed");
  const data = await res.json();

  if (!data.products || data.products.length === 0) throw new Error("No OFF results");

  const product = data.products.find(p => p.nutriments) || data.products[0];
  const n = product.nutriments || {};

  return {
    source: "Open Food Facts",
    foodName: product.product_name || query,
    per100g: {
      calories: n["energy-kcal_100g"] || (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0),
      protein:  n["proteins_100g"]      || 0,
      carbs:    n["carbohydrates_100g"] || 0,
      fat:      n["fat_100g"]           || 0,
    }
  };
}

// ── Main fetch with fallback chain ──────────────────────────
export async function fetchNutrition(query, weightG, cookingType) {
  const isCooked = cookingType === "cooked";
  let result = null;
  let warning = null;

  try {
    result = await fetchUSDA(query, isCooked);
  } catch (e) {
    console.warn("USDA failed, trying Open Food Facts:", e.message);
    try {
      result = await fetchOpenFoodFacts(query);
      warning = "Data sourced from Open Food Facts — verify for accuracy.";
    } catch (e2) {
      throw new Error("Could not find nutrition data from any source. Try a different food name.");
    }
  }

  // Cooking adjustment for OFF only (USDA cooked variants already adjusted)
  const cookMultiplier = (cookingType === "cooked" && result.source !== "USDA") ? 1.25 : 1.0;

  // Scale per-100g values to the actual weight the user entered
  const factor = (weightG / 100) * cookMultiplier;

  const totals = {
    calories: Math.round(result.per100g.calories * factor),
    protein:  Math.round(result.per100g.protein  * factor * 10) / 10,
    carbs:    Math.round(result.per100g.carbs     * factor * 10) / 10,
    fat:      Math.round(result.per100g.fat       * factor * 10) / 10,
  };

  if (isCooked) {
    warning = (warning ? warning + " " : "") + "Note: calorie values may vary based on cooking method.";
  }

  return { ...totals, foodName: result.foodName, source: result.source, warning };
}
