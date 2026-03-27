// ── Nutrition API: USDA FoodData Central + Open Food Facts fallback ──

const USDA_API_KEY = "3xfW4ib6a6Tg8BhxkYckndMf4HIlNgvYKe6yUrcV";

// ── USDA FoodData Central ───────────────────────────────────
async function fetchUSDA(query, isCooked) {
  const searchTerm = isCooked ? `${query} cooked` : query;
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&dataType=Foundation,SR%20Legacy&pageSize=5&api_key=${USDA_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA request failed");
  const data = await res.json();

  const foods = data.foods || [];
  if (foods.length === 0) throw new Error("No USDA results");

  const food = foods[0];

  // USDA Foundation/SR Legacy always reports nutrients per 100g serving.
  // So serving size = 100g. Divide by 100 to get per-gram, then user multiplies by their weight.
  const servingSize = food.servingSize && food.servingSize > 0 ? food.servingSize : 100;

  const raw = {};
  (food.foodNutrients || []).forEach(n => {
    const num = String(n.nutrientNumber || "");
    if (num === "208") raw.calories = n.value;
    if (num === "203") raw.protein  = n.value;
    if (num === "205") raw.carbs    = n.value;
    if (num === "204") raw.fat      = n.value;
  });

  // Per-gram values = nutrient value / serving size
  return {
    source: "USDA",
    foodName: food.description,
    perGram: {
      calories: (raw.calories || 0) / servingSize,
      protein:  (raw.protein  || 0) / servingSize,
      carbs:    (raw.carbs    || 0) / servingSize,
      fat:      (raw.fat      || 0) / servingSize,
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

  // OFF always provides _100g fields — divide by 100 to get per-gram
  return {
    source: "Open Food Facts",
    foodName: product.product_name || query,
    perGram: {
      calories: (n["energy-kcal_100g"] || (n["energy_100g"] ? n["energy_100g"] / 4.184 : 0)) / 100,
      protein:  (n["proteins_100g"]      || 0) / 100,
      carbs:    (n["carbohydrates_100g"] || 0) / 100,
      fat:      (n["fat_100g"]           || 0) / 100,
    }
  };
}

// ── Main fetch ───────────────────────────────────────────────
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

  // Multiply per-gram values by the user's weight to get final totals
  const totals = {
    calories: Math.round(result.perGram.calories * weightG),
    protein:  Math.round(result.perGram.protein  * weightG * 10) / 10,
    carbs:    Math.round(result.perGram.carbs     * weightG * 10) / 10,
    fat:      Math.round(result.perGram.fat       * weightG * 10) / 10,
  };

  if (isCooked) {
    warning = (warning ? warning + " " : "") + "Note: calorie values may vary based on cooking method.";
  }

  return { ...totals, foodName: result.foodName, source: result.source, warning };
}
