// ── Nutrition API: USDA FoodData Central + Open Food Facts fallback ──

const USDA_API_KEY = "3xfW4ib6a6Tg8BhxkYckndMf4HIlNgvYKe6yUrcV";

// ── USDA FoodData Central ───────────────────────────────────
async function fetchUSDA(query, isCooked) {
  const searchTerm = isCooked ? `${query} cooked` : query;
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&dataType=Foundation,SR%20Legacy&pageSize=10&api_key=${USDA_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA request failed");
  const data = await res.json();

  let foods = data.foods || [];
  if (foods.length === 0) throw new Error("No USDA results");

  // Pick the food whose description best matches the user's query.
  // Score = number of query words found in the food description.
  // This prevents e.g. "chicken breast" from matching "chicken breast tenders, breaded".
  const queryWords = query.toLowerCase().split(/\s+/);
  let bestFood = foods[0];
  let bestScore = -1;

  for (const food of foods) {
    const desc = food.description.toLowerCase();
    const wordMatches = queryWords.filter(w => desc.includes(w)).length;
    // Penalise results that add extra unwanted words (shorter description = closer match)
    const score = wordMatches - desc.split(/[\s,]+/).length * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestFood = food;
    }
  }

  const nutrients = {};
  (bestFood.foodNutrients || []).forEach(n => {
    const num = String(n.nutrientNumber || "");
    // Use USDA nutrient numbers directly (confirmed from real API response)
    if (num === "208") nutrients.calories = n.value; // Energy (kcal)
    if (num === "203") nutrients.protein  = n.value; // Protein
    if (num === "205") nutrients.carbs    = n.value; // Carbohydrate, by difference
    if (num === "204") nutrients.fat      = n.value; // Total lipid (fat)
  });

  return {
    source: "USDA",
    foodName: bestFood.description,
    per100g: {
      calories: nutrients.calories || 0,
      protein:  nutrients.protein  || 0,
      carbs:    nutrients.carbs    || 0,
      fat:      nutrients.fat      || 0,
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
