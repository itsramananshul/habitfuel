// ── Nutrition API: USDA FoodData Central + Open Food Facts fallback ──

const USDA_API_KEY = "3xfW4ib6a6Tg8BhxkYckndMf4HIlNgvYKe6yUrcV"; // Replace with your free key from https://fdc.nal.usda.gov/api-guide.html

// ── USDA FoodData Central ───────────────────────────────────
async function fetchUSDA(query, isCooked) {
  const searchTerm = isCooked ? `${query} cooked` : query;
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&pageSize=5&api_key=${USDA_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA request failed");
  const data = await res.json();

  if (!data.foods || data.foods.length === 0) throw new Error("No USDA results");

  const food = data.foods[0];
  const nutrients = {};
  (food.foodNutrients || []).forEach(n => {
    const name = n.nutrientName?.toLowerCase() || "";
    const unit = n.unitName?.toLowerCase() || "";
    // USDA returns energy as nutrientName "Energy" with unitName "KCAL"
    if (name.includes("energy") && (unit === "kcal" || unit === "kcal")) nutrients.calories = n.value;
    // Also catch by nutrient number 1008 (Energy in kcal)
    if (n.nutrientNumber === "1008" || n.nutrientId === 1008) nutrients.calories = n.value;
    if (name.includes("protein")) nutrients.protein = n.value;
    if (name.includes("carbohydrate")) nutrients.carbs = n.value;
    if (name.includes("total lipid") || name.includes("fat")) nutrients.fat = n.value;
  });

  return {
    source: "USDA",
    foodName: food.description,
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
      calories: n["energy-kcal_100g"] || n["energy_100g"] / 4.184 || 0,
      protein:  n["proteins_100g"]    || 0,
      carbs:    n["carbohydrates_100g"] || 0,
      fat:      n["fat_100g"]         || 0,
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

  // Cooking adjustment: cooked food is typically denser by ~25% water loss
  const cookMultiplier = (cookingType === "cooked" && result.source !== "USDA") ? 1.25 : 1.0;
  const factor = (weightG / 100) * cookMultiplier;

  const totals = {
    calories: Math.round(result.per100g.calories * factor),
    protein:  Math.round(result.per100g.protein  * factor * 10) / 10,
    carbs:    Math.round(result.per100g.carbs     * factor * 10) / 10,
    fat:      Math.round(result.per100g.fat       * factor * 10) / 10,
  };

  if (isCooked && cookingType !== "na") {
    warning = (warning || "") + " Note: calorie values may vary based on cooking method.";
  }

  return { ...totals, foodName: result.foodName, source: result.source, warning };
}
