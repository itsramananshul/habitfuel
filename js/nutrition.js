// ── Nutrition API: USDA FoodData Central + Open Food Facts fallback ──

const USDA_API_KEY = "3xfW4ib6a6Tg8BhxkYckndMf4HIlNgvYKe6yUrcV"; // Replace with your free key from https://fdc.nal.usda.gov/api-guide.html

// ── USDA FoodData Central ───────────────────────────────────
async function fetchUSDA(query, isCooked) {
  const searchTerm = isCooked ? `${query} cooked` : query;

  // Foundation & SR Legacy data types store all nutrients per 100g by definition.
  // Branded foods store per-serving — excluding them avoids the scaling bug.
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&dataType=Foundation,SR%20Legacy&pageSize=5&api_key=${USDA_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("USDA request failed");
  const data = await res.json();

  // If Foundation/SR Legacy returns nothing, fall back to all types (branded etc.)
  // but normalise by servingSize so values are always per-100g.
  let foods = data.foods || [];
  if (foods.length === 0) {
    const fallbackUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&pageSize=5&api_key=${USDA_API_KEY}`;
    const fallbackRes = await fetch(fallbackUrl);
    if (!fallbackRes.ok) throw new Error("USDA request failed");
    const fallbackData = await fallbackRes.json();
    foods = fallbackData.foods || [];
  }

  if (foods.length === 0) throw new Error("No USDA results");

  const food = foods[0];

  // servingSize is populated for Branded items (e.g. 28g per serving).
  // For Foundation/SR Legacy it is absent, meaning values are already per 100g.
  const servingSize = food.servingSize && food.servingSize > 0 ? food.servingSize : 100;
  const normFactor  = 100 / servingSize; // = 1.0 for Foundation/SR Legacy

  const nutrients = {};
  (food.foodNutrients || []).forEach(n => {
    const name = n.nutrientName?.toLowerCase() || "";
    const unit = n.unitName?.toLowerCase() || "";
    const num  = String(n.nutrientNumber || "");

    // Energy — USDA nutrient number 1008 = Energy (kcal)
    if (num === "1008" || (name.includes("energy") && unit === "kcal")) {
      nutrients.calories = n.value;
    }
    // Protein — nutrient number 1003
    if (num === "1003" || (name.includes("protein") && !name.includes("non-protein"))) {
      nutrients.protein = n.value;
    }
    // Carbohydrate — nutrient number 1005
    if (num === "1005" || name.includes("carbohydrate")) {
      nutrients.carbs = n.value;
    }
    // Total fat — nutrient number 1004
    if (num === "1004" || name.includes("total lipid")) {
      nutrients.fat = n.value;
    }
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

  // OFF _100g fields are always per 100g — no normalization needed
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

  // Cooking adjustment: cooked food loses ~20-25% water, concentrating nutrients.
  // Only apply to OFF results since USDA cooked variants are already adjusted.
  const cookMultiplier = (cookingType === "cooked" && result.source !== "USDA") ? 1.25 : 1.0;

  // factor scales all per-100g values to the actual weight entered by the user
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
